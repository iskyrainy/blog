---
title: JavaでのMySQLへの挿入
category: Tech
tag: [Java, MySQL]
date: 2025-04-22T18:59:59+08:00
---

# JavaでのMySQLへの挿入
> csv/xlsx/txtなどのファイルからMySQLにデータをロードする必要があるとき、誰もがそのプロセスを高速に動作させたいと考えるはずです。

ここでは、状況に応じて異なる方法で解決すべきいくつかのケースを紹介します。
データの挿入には、以下のフレームワークを使用できます：
1. JDBC Template；
2. Mybatis；
3. JPA/Mybatis-plus；

また、データベースへの挿入方法としては：
1. 各行を挿入するたびにフラッシュする；
2. バッチ挿入後にフラッシュする；
   
データベース操作はI/O操作の一種であるため、CPU処理よりもI/Oに時間がかかります。したがって、挿入ジョブではスレッドを利用してI/Oを効率化することが有効です：
1. シングルスレッド；
2. プラットフォームスレッド；
3. 仮想スレッド（jdk21以降のみ）；

具体的なテスト項目は以下の通りです：
| ID | Framework | Insert | Thread |
| :-: | :-: | :-: | :-: |
| 1 | JdbcTemplate | Batch | Single |
| 2 | JdbcTemplate | Batch | Platform |
| 3 | JdbcTemplate | Batch | Virtual |
| 4 | Mybatis | Batch | Single |
| 5 | Mybatis | Batch | Platform |
| 6 | Mybatis | Batch | Virtual |
| 7 | JPA | Batch | Single |
| 8 | JPA | Batch | Platform |
| 9 | JPA | Batch | Virtual |

テスト環境は以下の通りです：
- CPU: 12th Gen Intel(R) Core(TM) i5-12400F @2.50 GHz
- Arch: x86_64
- Memory: limit 8G
- OS: Windows 11 24H2 26100.3775
- MySQL: 8.4, rewriteBatchedStatements=true
- OpenJDK: 21.0.5
- Run env:
    ```bash
    # jvm config
    -Xms8g
    -Xmx8g
    -XX:+UseZGC
    -XX:+ZGenerational
    -XX:ZUncommitDelay=300
    -XX:+OptimizeStringConcat
    -XX:+UseTLAB
    -XX:ParallelGCThreads=8

    # Druid connector pool
    druid:
      initial-size: 16
      min-idle: 32
      max-active: 64
    ```

テストデータは以下の通りです：
- Row num: 700w
- Row fields num: 30

## 1 JdbcTemplate
### 1.1 単一挿入、シングルスレッド
この方法は時間がかかりすぎるため、このテストは完了を断念しました。😅

```java
public void insert(String dataPath) {
    try(var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        while (line != null) {
            var params = Arrays.stream(line.split("\t", -2)).map(s -> s.isEmpty() ? (Object) null : s).toList();
            jdbcTemplate.execute(INSERT_SQL, (PreparedStatementCallback<Boolean>) ps -> {
                for (var i = 0; i < params.size(); i++) {
                    ps.setObject(i + 1, params.get(i));
                }
                return ps.execute();
            });
            line = f.readLine();
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}
```

### 1.2 バッチ挿入、シングルスレッド
バッチ挿入は単一挿入よりも大幅に優れた性能を発揮します。考えられる原因は以下の通りです：
1. バッチ挿入をトランザクションとして扱うことで、頻繁なコミットを回避できる
2. rewriteBatchedStatements=true の場合、同じパラメータの挿入がMySQLによって処理され、単一の文にマージされるため、ログレコード数が削減される

```java
public void insertBatch(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        var list = new ArrayList<List<Object>>();
        while (line != null) {
            var params = Arrays.stream(line.split("\t", -2)).map(s -> s.isEmpty() ? (Object) null : s).toList();
            list.add(params);
            if (list.size() >= batchSize) {
                var temp = new ArrayList<>(list);
                batch(temp);
                list.clear();
            }
            line = f.readLine();
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}

private void batch(ArrayList<List<Object>> temp) {
    if (Boolean.FALSE.equals(jdbcTemplate.execute(INSERT_SQL, (PreparedStatementCallback<Boolean>) ps -> {
        for (var object : temp) {
            for (var j = 0; j < object.size(); j++) {
                ps.setObject(j + 1, object.get(j));
            }
            ps.addBatch();
        }
        return ps.executeBatch().length > 0;
    }))) {
        log.error("Insert failed");
    }
}
```
*結果*: 
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 992.58s |
| 2 | 4096 | 1123.42s |

### 1.3 バッチ挿入、プラットフォームスレッド
マルチスレッドを使用して、ファイル読み取りとMySQL挿入という2つのI/O操作を分離します。
```java
public void insertBatchParallelPlatform(String dataPath, int batchSize) {
    try(var executor = Executors.newFixedThreadPool(32);
        var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        var list = new ArrayList<List<Object>>();
        while (line != null) {
            var memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            while (memoryRate < 0.1) {
                LockSupport.parkNanos(TimeUnit.SECONDS.toNanos(1));
                memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            }
            var params = Arrays.stream(line.split("\t", -2)).map(s -> s.isEmpty() ? (Object) null : s).toList();
            list.add(params);
            if (list.size() >= batchSize) {
                var temp = new ArrayList<>(list);
                executor.submit(() -> batch(temp), true);
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            executor.submit(() -> batch(list));
        }
        executor.shutdown();
        if (!executor.awaitTermination(10, TimeUnit.MINUTES)) {
            log.error("TIMEOUT. Task execute too long.");
        }
    } catch (IOException | InterruptedException e) {
        log.error(e.getMessage(), e);
    }
}

private void batch(ArrayList<List<Object>> temp) {
    if (Boolean.FALSE.equals(jdbcTemplate.execute(INSERT_SQL, (PreparedStatementCallback<Boolean>) ps -> {
        for (var object : temp) {
            for (var j = 0; j < object.size(); j++) {
                ps.setObject(j + 1, object.get(j));
            }
            ps.addBatch();
        }
        return ps.executeBatch().length > 0;
    }))) {
        log.error("Insert failed");
    }
}
```
visualvmによるCPU/GC、メモリ使用量、スレッドは以下の通りです：
![Jdbc-PT-1024](https://i.postimg.cc/s2DqJyXq/Jdbc-PT-1024.jpg)
CPU、メモリ使用量は非常に安定しています。

*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 341.73s |
| 2 | 4096 | 416.27s |

### 1.4 バッチ挿入、仮想スレッド
```java
public void insertBatchParallelVirtual(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath));
        var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        var line = f.readLine();
        var list = new ArrayList<List<Object>>();
        while (line != null) {
            var memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            while (memoryRate < 0.1) {
                LockSupport.parkNanos(TimeUnit.SECONDS.toNanos(1));
                memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            }
            var params = Arrays.stream(line.split("\t", -2))
                                .map(s -> s.isEmpty() ? (Object) null : s)
                                .toList();
            list.add(params);
            if (list.size() >= batchSize) {
                var temp = new ArrayList<>(list);
                executor.submit(() -> batch(temp));
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            executor.submit(() -> batch(list));
        }
        executor.shutdown();
        if (!executor.awaitTermination(10, TimeUnit.MINUTES)) {
            log.error("TIMEOUT. Task execute too long.");
        }
    } catch (IOException | InterruptedException e) {
        log.error(e.getMessage(), e);
    }
}

private void batch(ArrayList<List<Object>> temp) {
    if (Boolean.FALSE.equals(jdbcTemplate.execute(INSERT_SQL, (PreparedStatementCallback<Boolean>) ps -> {
        for (var object : temp) {
            for (var j = 0; j < object.size(); j++) {
                ps.setObject(j + 1, object.get(j));
            }
            ps.addBatch();
        }
        return ps.executeBatch().length > 0;
    }))) {
        log.error("Insert failed");
    }
}
```
visualvmによるCPU/GC、メモリ使用量、スレッドは以下の通りです：
![Jdbc-VT-1024](https://i.postimg.cc/kMtZsTJJ/Jdbc-VT-1024.jpg)
CPUとメモリの変動はどちらもプラットフォームスレッドよりも大きくなっています。

*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 369.47s |
| 2 | 4096 | 433.68s |

## 2 Mybatis
### 2.1 単一挿入、シングルスレッド
[1.1](#11-single-insert-single-thread)と同様、時間がかかりすぎるため試しませんでした。
```java
public void insert(String dataPath) {
    try(var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        while (line != null) {
            var params = Arrays.stream(line.split("\t", -2))
                                .map(s -> s.isEmpty() ? (Object) null : s)
                                .toList();
            insertMapper.insert(params);
            line = f.readLine();
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}
```

### 2.2 バッチ挿入、シングルスレッド
`<foreach>`を使用してSQL文をローカルで連結し、バッチ挿入します。
```java
public void insertBatch(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        List<List<Object>> list = new ArrayList<>();
        while (line != null) {
            var params = Arrays.stream(line.split("\t", -2))
                                .map(s -> s.isEmpty() ? (Object) null : s)
                                .toList();
            list.add(params);
            if (list.size() % batchSize == 0) {
                var temp = new ArrayList<>(list);
                insertMapper.insertBatch(temp); // implement within `<foreach>` of mybatis
                list.clear();
            }
            line = f.readLine();
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}
```
*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1803.51s |
| 2 | 4096 |  |

### 2.3 バッチ挿入、プラットフォームスレッド
```java
public void insertBatchParallelPlatform(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath));
        var executor = Executors.newFixedThreadPool(32)) {
        var line = f.readLine();
        List<List<Object>> list = new ArrayList<>();
        while (line != null) {
            var memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            while (memoryRate < 0.1) {
                LockSupport.parkNanos(TimeUnit.SECONDS.toNanos(1));
                memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            }
            var params = Arrays.stream(line.split("\t", -2))
                    .map(s -> s.isEmpty() ? (Object) null : s)
                    .toList();
            list.add(params);
            if (list.size() % batchSize == 0) {
                var temp = new ArrayList<>(list);
                executor.submit(() -> insertMapper.insertBatch(temp));
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            executor.submit(() -> insertMapper.insertBatch(list));
        }
        executor.shutdown();
        if (!executor.awaitTermination(100, TimeUnit.MINUTES)) {
            log.error("TIMEOUT. Task execute too long.");
        }
    } catch (IOException | InterruptedException e) {
        log.error(e.getMessage(), e);
    }
}
```
visualvmによるCPU/GC、メモリ使用量、スレッドは以下の通りです：
![Mybatis-PT-1024](https://i.postimg.cc/W3dyQn07/Mybats-PT-1024.jpg)
MybatisはSQLをローカルで連結するため、CPUとメモリ使用量が高く、変動も激しくなっています。

*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 513.22s |
| 2 | 4096 | 705.44s |

### 2.4 バッチ挿入、仮想スレッド
```java
public void insertBatchParallelVirtual(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath));
        var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        var line = f.readLine();
        List<List<Object>> list = new ArrayList<>();
        while (line != null) {
            var memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            while (memoryRate < 0.1) {
                LockSupport.parkNanos(TimeUnit.SECONDS.toNanos(1));
                memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            }
            var params = Arrays.stream(line.split("\t", -2))
                                .map(s -> s.isEmpty() ? (Object) null : s)
                                .toList();
            list.add(params);
            if (list.size() % batchSize == 0) {
                var temp = new ArrayList<>(list);
                executor.submit(() -> insertMapper.insertBatch(temp));
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            executor.submit(() -> insertMapper.insertBatch(list));
        }
        executor.shutdown();
        if (!executor.awaitTermination(100, TimeUnit.MINUTES)) {
            log.error("TIMEOUT. Task execute too long.");
        }
    } catch (IOException | InterruptedException e) {
        log.error(e.getMessage(), e);
    }
}
```
visualvmによるCPU/GC、メモリ使用量、スレッドは以下の通りです：
![Mybatis-VT-1024](https://i.postimg.cc/sXbLyhcC/Mybatis-VT-1024.jpg)
プラットフォームスレッドと比較して、変動は小さくなっています。

*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 752.42s |
| 2 | 4096 | 687.05s |

## 3 JPA/Mybatis-plus
### 3.1 単一挿入、シングルスレッド
[1.1](#11-single-insert-single-thread)および[2.1](#21-single-insert-single-thread)と同様です。
```java
public void insert(String dataPath) {
    try(var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        while (line != null) {
            insertRepository.saveAndFlush(convert(line));
            line = f.readLine();
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}
```

### 3.2 バッチ挿入、シングルスレッド
JPAの主キーが`IDENTITY`ポリシーに設定されているため、バッチ処理が無効となり、`rewriteBatchedStatements`による最適化もできません。遅すぎたため、テストは行いませんでした。😓
```java
public void insertBatch(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath))) {
        var line = f.readLine();
        var list = new ArrayList<Model>();
        while (line != null) {
            list.add(convert(line));
            if (list.size() % batchSize == 0) {
                var temp = new ArrayList<>(list);
                insertRepository.saveAllAndFlush(temp);
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            insertRepository.saveAllAndFlush(list);
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}
```
### 3.3 バッチ挿入、プラットフォームスレッド
```java
public void insertBatchParallelPlatform(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath));
        var executor = Executors.newFixedThreadPool(32)) {
        var line = f.readLine();
        var list = new ArrayList<Model>();
        while (line != null) {
            var memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            while (memoryRate < 0.1) {
                LockSupport.parkNanos(TimeUnit.SECONDS.toNanos(1));
                memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            }
            list.add(convert(line));
            if (list.size() % batchSize == 0) {
                var temp = new ArrayList<>(list);
                executor.submit(() -> insertRepository.saveAllAndFlush(temp));
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            insertRepository.saveAllAndFlush(list);
        }
        executor.shutdown();
        if (!executor.awaitTermination(100, TimeUnit.MINUTES)) {
            log.error("TIMEOUT. Task execute too long.");
        }
    } catch (IOException | InterruptedException e) {
        log.error(e.getMessage(), e);
    }
}
```
visualvmによるCPU/GC、メモリ使用量、スレッドは以下の通りです：
![Jpa-PT-1024](https://i.postimg.cc/X7fPSXBt/Jpa-PT-1024.jpg)
こちらも`IDENTITY`ポリシーのため、より時間がかかっています。主キーを手動で設定すれば、もっと速くなるでしょう。CPU、メモリ使用量は非常に良好で安定しています。

*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1285.88s |
| 2 | 4096 | 1263.79s |

### 3.4 バッチ挿入、仮想スレッド
```java
public void insertBatchParallel(String dataPath, int batchSize) {
    try(var f = Files.newBufferedReader(Path.of(dataPath));
        var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        var line = f.readLine();
        var list = new ArrayList<Model>();
        while (line != null) {
            var memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            while (memoryRate < 0.1) {
                LockSupport.parkNanos(TimeUnit.SECONDS.toNanos(1));
                memoryRate = (double) Runtime.getRuntime().freeMemory() / Runtime.getRuntime().maxMemory();
            }
            list.add(convert(line));
            if (list.size() % batchSize == 0) {
                var temp = new ArrayList<>(list);
                executor.submit(() -> insertRepository.saveAllAndFlush(temp));
                list.clear();
            }
            line = f.readLine();
        }
        if (!list.isEmpty()) {
            insertRepository.saveAllAndFlush(list);
        }
        executor.shutdown();
        if (!executor.awaitTermination(100, TimeUnit.MINUTES)) {
            log.error("TIMEOUT. Task execute too long.");
        }
    } catch (IOException | InterruptedException e) {
        log.error(e.getMessage(), e);
    }
}
```
visualvmによるCPU/GC、メモリ使用量、スレッドは以下の通りです：
![Jpa-VT-1024](https://i.postimg.cc/Hn5hLkZc/Jpa-VT-1024.jpg)
おそらく仮想スレッドとJPAの適応によるものと思われますが、途中で20分近くの空白期間がありました（多くのテストでこのようなことが起こりました）。🤔
デッドロック<sup>[1]</sup>が発生します：
- 仮想スレッドが`synchronized`コードでブロックされると、仮想スレッドはキャリアスレッドとpinされます<sup>[2]</sup>。そしてすべてのキャリアスレッドがpinされます。
- `lock`がオーナーによって解放されます。
- `synchronized`コードでブロックされていない別の仮想スレッド（Aとします）が、`lock`を待っています。`lock`が解放されると、Aは通知され`lock`を取得しようとしますが、利用可能なキャリアスレッドがないため、Aは`lock`を取得できません。

*結果*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 2724.81s |
| 2 | 4096 |  |

## 4 まとめ
1. 速度: 
   - JdbcTemplate    >   Mybatis         >>   JPA
   - Platform Thread >=  Virtual Thread  >>   Single Thread
2. CPU/GC使用量: 
   - JdbcTemplate < JPA < Mybttis
3. メモリ使用量:
   - JdbcTemplate < JPA << Mybttis

[1]: [Java 21 Virtual Threads - Dude, Where’s My Lock?](https://netflixtechblog.com/java-21-virtual-threads-dude-wheres-my-lock-3052540e231d)
[2]: [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491)