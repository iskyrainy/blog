---
title: Java에서 MySQL로 삽입하기
category: Tech
tag: [Java, MySQL]
date: 2025-04-22T18:59:59+08:00
---

# Java에서 MySQL로 삽입하기
> csv/xlsx/txt 등과 같은 파일에서 MySQL로 데이터를 로드해야 할 때, 누구나 이 과정을 빠르게 처리하고 싶어 할 것입니다.

여기에는 다르게 해결해야 할 몇 가지 상황이 있습니다.
다음과 같은 프레임워크로 데이터를 삽입할 수 있습니다:
1. JDBC Template;
2. Mybatis;
3. JPA/Mybatis-plus;

그리고 DB에 데이터를 삽입하는 방식은:
1. 각 단일 행을 삽입한 후 Flush;
2. 행을 배치로 삽입한 후 Flush;
   
DB 작업은 I/O 작업의 한 유형이므로 CPU 처리보다 I/O에서 더 많은 시간이 소요됩니다. 따라서 삽입 작업에서 I/O를 스레드로 업로드하는 것이 유용합니다:
1. 단일 스레드;
2. 플랫폼 스레드;
3. 가상 스레드(jdk21+ 전용);

구체적인 테스트 항목은 다음과 같습니다:
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

테스트 환경은 다음과 같습니다:
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

테스트 데이터는 다음과 같습니다:
- Row num: 700w
- Row fields num: 30

## 1 JdbcTemplate
### 1.1 단일 삽입, 단일 스레드
이 방식은 시간이 너무 오래 걸려서 이 테스트를 완료하는 것을 포기했습니다. 😅

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

### 1.2 배치 삽입, 단일 스레드
배치 삽입은 단일 삽입보다 훨씬 더 잘 작동합니다. 가능한 원인은 다음과 같습니다:
1. 배치 삽입이 트랜잭션으로 처리되어 빈번한 커밋을 피할 수 있습니다
2. rewriteBatchedStatements=true에서 동일한 매개변수의 삽입이 MySQL에 의해 처리되어 단일 문장으로 병합되므로 로그 레코드 수가 줄어듭니다

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
*결과*: 
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 992.58s |
| 2 | 4096 | 1123.42s |

### 1.3 배치 삽입, 플랫폼 스레드
멀티스레딩을 사용하여 파일 읽기와 MySQL 삽입이라는 두 I/O 작업을 분리합니다.
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
visualvm에 의한 CPU/GC, 메모리 사용량, 스레드는 다음과 같습니다:
![Jdbc-PT-1024](https://i.postimg.cc/s2DqJyXq/Jdbc-PT-1024.jpg)
CPU, 메모리 사용량 모두 매우 안정적입니다.

*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 341.73s |
| 2 | 4096 | 416.27s |

### 1.4 배치 삽입, 가상 스레드
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
visualvm에 의한 CPU/GC, 메모리 사용량, 스레드는 다음과 같습니다:
![Jdbc-VT-1024](https://i.postimg.cc/kMtZsTJJ/Jdbc-VT-1024.jpg)
CPU와 메모리 변동 모두 플랫폼 스레드보다 큽니다.

*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 369.47s |
| 2 | 4096 | 433.68s |

## 2 Mybatis
### 2.1 단일 삽입, 단일 스레드
[1.1](#11-single-insert-single-thread)과 동일하게, 이것도 시간이 너무 오래 걸려서 시도하지 않았습니다.
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

### 2.2 배치 삽입, 단일 스레드
`<foreach>`를 사용하여 SQL 문을 로컬에서 배치로 연결하고 삽입합니다.
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
*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1803.51s |
| 2 | 4096 |  |

### 2.3 배치 삽입, 플랫폼 스레드
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
visualvm에 의한 CPU/GC, 메모리 사용량, 스레드는 다음과 같습니다:
![Mybatis-PT-1024](https://i.postimg.cc/W3dyQn07/Mybats-PT-1024.jpg)
Mybatis가 SQL을 연결하는 작업이 로컬에서 실행되므로 CPU와 메모리 사용량이 높고 크게 변동합니다.

*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 513.22s |
| 2 | 4096 | 705.44s |

### 2.4 배치 삽입, 가상 스레드
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
visualvm에 의한 CPU/GC, 메모리 사용량, 스레드는 다음과 같습니다:
![Mybatis-VT-1024](https://i.postimg.cc/sXbLyhcC/Mybatis-VT-1024.jpg)
플랫폼 스레드에 비해 변동이 더 작습니다.

*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 752.42s |
| 2 | 4096 | 687.05s |

## 3 JPA/Mybatis-plus
### 3.1 단일 삽입, 단일 스레드
[1.1](#11-single-insert-single-thread)과 [2.1](#21-single-insert-single-thread)과 동일합니다.
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

### 3.2 배치 삽입, 단일 스레드
JPA 기본 키가 `IDENTITY` 정책으로 설정되어 있기 때문에 배치 처리가 무효화되고 `rewriteBatchedStatements`로 최적화할 수 없습니다. 너무 느려서 테스트하지 않았습니다. 😓
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
### 3.3 배치 삽입, 플랫폼 스레드
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
visualvm에 의한 CPU/GC, 메모리 사용량, 스레드는 다음과 같습니다:
![Jpa-PT-1024](https://i.postimg.cc/X7fPSXBt/Jpa-PT-1024.jpg)
역시 `IDENTITY` 정책 때문에 더 많은 시간이 소요됩니다. 기본 키를 수동으로 설정하면 훨씬 빨라집니다. CPU, 메모리 사용량 모두 매우 훌륭하고 안정적입니다.

*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1285.88s |
| 2 | 4096 | 1263.79s |

### 3.4 배치 삽입, 가상 스레드
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
visualvm에 의한 CPU/GC, 메모리 사용량, 스레드는 다음과 같습니다:
![Jpa-VT-1024](https://i.postimg.cc/Hn5hLkZc/Jpa-VT-1024.jpg)
아마도 가상 스레드와 JPA의 적응 문제로 인해 중간에 거의 20분에 가까운 공백 기간이 있었습니다(많은 테스트에서 이러한 경우가 있었습니다). 🤔
데드락이 발생할 수 있습니다<sup>[1]</sup>:
- 가상 스레드가 `synchronized` 코드에서 차단되면 가상 스레드는 캐리어 스레드와 고정(pinned)됩니다<sup>[2]</sup>. 그리고 모든 캐리어 스레드가 고정됩니다.
- 소유자가 `lock`을 해제합니다.
- `synchronized` 코드에서 차단되지 않은(캐리어 스레드에 고정되지 않는) 다른 가상 스레드(A라고 함)가 `lock`을 기다리고 있습니다. `lock`이 해제된 후 A는 알림을 받고 `lock`을 얻으려고 시도하지만 사용 가능한 캐리어 스레드가 없으므로 A는 결코 `lock`을 얻을 수 없습니다.

*결과*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 2724.81s |
| 2 | 4096 |  |

## 4 요약
1. 속도: 
   - JdbcTemplate    >   Mybatis         >>   JPA
   - Platform Thread >=  Virtual Thread  >>   Single Thread
2. CPU/GC 사용량: 
   - JdbcTemplate < JPA < Mybttis
3. 메모리 사용량:
   - JdbcTemplate < JPA << Mybttis

[1]: [Java 21 Virtual Threads - Dude, Where’s My Lock?](https://netflixtechblog.com/java-21-virtual-threads-dude-wheres-my-lock-3052540e231d)
[2]: [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491)