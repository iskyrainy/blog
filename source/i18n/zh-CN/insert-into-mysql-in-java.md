---
title: 在 Java 中插入 MySQL
category: Tech
tag: [Java, MySQL]
date: 2025-04-22T18:59:59+08:00
---

# 在 Java 中插入 MySQL
> 当我们需要从 csv/xlsx/txt 等文件向 MySQL 中加载数据时，我相信每个人都希望这个过程能够快速完成。

我们会遇到以下几种场景，需要用不同的方式来解决。
可以通过以下框架来插入数据：
1. JDBC Template；
2. Mybatis；
3. JPA/Mybatis-plus；

向数据库插入数据：
1. 每插入单行后刷新；
2. 批量插入多行后刷新；
   
因为数据库操作是一种 I/O 操作，在 I/O 上花费的时间会比 CPU 处理更多。因此，对于插入任务来说，通过多线程提升 I/O 是很有用的：
1. 单线程；
2. 平台线程；
3. 虚拟线程（仅限 jdk21+）；

具体测试项如下：
| ID | 框架 | 插入方式 | 线程 |
| :-: | :-: | :-: | :-: |
| 1 | JdbcTemplate | 批量 | 单线程 |
| 2 | JdbcTemplate | 批量 | 平台线程 |
| 3 | JdbcTemplate | 批量 | 虚拟线程 |
| 4 | Mybatis | 批量 | 单线程 |
| 5 | Mybatis | 批量 | 平台线程 |
| 6 | Mybatis | 批量 | 虚拟线程 |
| 7 | JPA | 批量 | 单线程 |
| 8 | JPA | 批量 | 平台线程 |
| 9 | JPA | 批量 | 虚拟线程 |

测试环境如下：
- CPU：12th Gen Intel(R) Core(TM) i5-12400F @2.50 GHz
- 架构：x86_64
- 内存：限制 8G
- 操作系统：Windows 11 24H2 26100.3775
- MySQL：8.4，rewriteBatchedStatements=true
- OpenJDK：21.0.5
- 运行环境：
    ```bash
    # jvm 配置
    -Xms8g
    -Xmx8g
    -XX:+UseZGC
    -XX:+ZGenerational
    -XX:ZUncommitDelay=300
    -XX:+OptimizeStringConcat
    -XX:+UseTLAB
    -XX:ParallelGCThreads=8

    # Druid 连接池
    druid:
      initial-size: 16
      min-idle: 32
      max-active: 64
    ```

测试数据如下：
- 行数：700 万
- 行字段数：30

## 1 JdbcTemplate
### 1.1 单条插入，单线程
这种方式耗时太长，我放弃了完成这个测试。😅

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

### 1.2 批量插入，单线程
批量插入的效果明显好于单条插入。可能的原因如下：
1. 批量插入作为一个事务，避免了频繁提交
2. 在 rewriteBatchedStatements=true 下，相同参数的插入被 MySQL 处理并合并为一条语句，减少了日志记录的数量

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
*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 992.58s |
| 2 | 4096 | 1123.42s |

### 1.3 批量插入，平台线程
使用多线程将读取文件和插入 MySQL 这两个 I/O 操作解耦。
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
通过 visualvm 查看 CPU/GC、内存使用、线程情况如下：
![Jdbc-PT-1024](https://i.postimg.cc/s2DqJyXq/Jdbc-PT-1024.jpg)
CPU、内存使用非常稳定。

*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 341.73s |
| 2 | 4096 | 416.27s |

### 1.4 批量插入，虚拟线程
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
通过 visualvm 查看 CPU/GC、内存使用、线程情况如下：
![Jdbc-VT-1024](https://i.postimg.cc/kMtZsTJJ/Jdbc-VT-1024.jpg)
CPU 和内存的波动都大于平台线程。

*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 369.47s |
| 2 | 4096 | 433.68s |

## 2 Mybatis
### 2.1 单条插入，单线程
与 [1.1](#11-single-insert-single-thread) 相同，耗时也太长，因此我不再尝试。
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

### 2.2 批量插入，单线程
使用 `<foreach>` 在本地拼接并批量插入 SQL 语句。
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
                insertMapper.insertBatch(temp); // 在 mybatis 的 `<foreach>` 中实现
                list.clear();
            }
            line = f.readLine();
        }
    } catch (IOException e) {
        log.error(e.getMessage(), e);
    }
}
```
*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1803.51s |
| 2 | 4096 |  |

### 2.3 批量插入，平台线程
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
通过 visualvm 查看 CPU/GC、内存使用、线程情况如下：
![Mybatis-PT-1024](https://i.postimg.cc/W3dyQn07/Mybats-PT-1024.jpg)
由于 Mybatis 拼接 SQL 是在本地执行的，因此 CPU 和内存使用率较高且波动剧烈。

*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 513.22s |
| 2 | 4096 | 705.44s |

### 2.4 批量插入，虚拟线程
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
通过 visualvm 查看 CPU/GC、内存使用、线程情况如下：
![Mybatis-VT-1024](https://i.postimg.cc/sXbLyhcC/Mybatis-VT-1024.jpg)
与平台线程相比，波动更小。

*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 752.42s |
| 2 | 4096 | 687.05s |

## 3 JPA/Mybatis-plus
### 3.1 单条插入，单线程
与 [1.1](#11-single-insert-single-thread) 和 [2.1](#21-single-insert-single-thread) 相同。
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

### 3.2 批量插入，单线程
因为 JPA 主键设置了 `IDENTITY` 策略，批量处理失效，无法通过 `rewriteBatchedStatements` 进行优化。速度太慢，所以我没有测试。😓
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
### 3.3 批量插入，平台线程
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
通过 visualvm 查看 CPU/GC、内存使用、线程情况如下：
![Jpa-PT-1024](https://i.postimg.cc/X7fPSXBt/Jpa-PT-1024.jpg)
同样由于 `IDENTITY` 策略，耗时更多。如果我们手动设置主键，速度会快很多。CPU、内存使用非常良好且稳定。

*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1285.88s |
| 2 | 4096 | 1263.79s |

### 3.4 批量插入，虚拟线程
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
通过 visualvm 查看 CPU/GC、内存使用、线程情况如下：
![Jpa-VT-1024](https://i.postimg.cc/Hn5hLkZc/Jpa-VT-1024.jpg)
也许是因为虚拟线程与 JPA 的适配问题，中间出现了近 20 分钟的空档期（很多测试都是如此）。🤔
会出现死锁<sup>[1]</sup>：
- 虚拟线程阻塞在 `synchronized` 代码中，然后虚拟线程会与载体线程绑定<sup>[2]</sup>。所有载体线程都被绑定。
- 一个 `lock` 被持有者释放。
- 另一个没有阻塞在 `synchronized` 代码中的虚拟线程（称为 A）（不会与载体线程绑定），正在等待一个 `lock`。`lock` 被释放后，A 被通知并尝试获取 `lock`，但没有可用的载体线程，因此 A 永远无法获取 `lock`。

*结果*：
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 2724.81s |
| 2 | 4096 |  |

## 4 总结
1. 速度：
   - JdbcTemplate    >   Mybatis         >>   JPA
   - 平台线程 >=  虚拟线程  >>   单线程
2. CPU/GC 使用：
   - JdbcTemplate < JPA < Mybttis
3. 内存使用：
   - JdbcTemplate < JPA << Mybttis

[1]: [Java 21 Virtual Threads - Dude, Where's My Lock?](https://netflixtechblog.com/java-21-virtual-threads-dude-wheres-my-lock-3052540e231d)
[2]: [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491)