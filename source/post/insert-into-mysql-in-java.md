---
title: Insert into MySQL In Java
category: Tech
tag: [Java, MySQL]
date: 2025-04-22T18:59:59+08:00
---

# Insert into MySQL In Java
> When we need load data into MySQL from files like csv/xlsx/txt etc, I do believe everyone want to make the process working fast.

Here is some situations we could face to resolve differently.
We can insert data by frameworks as:
1. JDBC Template;
2. Mybatis;
3. JPA/Mybatis-plus;

And insert data to db:
1. Flush after inserting each single row;
2. Flush after batch inserting rows;
   
Because DB operation is one type of I/O operations, it will take more time in I/O than cpu process. Thus it is useful for insert job to upload I/O in threads:
1. Single thread;
2. Platform threads;
3. Virtual threads(only for jdk21+);

The specific test items are as follows:
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

Test environment as:
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

Test data as:
- Row num: 700w
- Row fields num: 30

## 1 JdbcTemplate
### 1.1 Single insert, Single thread
This way cost too long time and I give up finishing this test. 😅

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

### 1.2 Batch insert, Single thread
Batch inserts work significantly better than single insert. The possible causes are as follows:
1. Batch insertion as a transaction avoids frequent commits
2. The insertion of the same parameter under rewriteBatchedStatements=true is processed by MySQL and merged into a single sentence, which reduces the number of log records

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
*Result*: 
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 992.58s |
| 2 | 4096 | 1123.42s |

### 1.3 Batch insert, Platform thread
Use multithreading to decouple the two I/O operations of reading files and inserting MySQL.
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
CPU/GC, Memory usage, Threads by visualvm as:
![Jdbc-PT-1024](https://i.postimg.cc/s2DqJyXq/Jdbc-PT-1024.jpg)
CPU, Memory usage are very stable.

*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 341.73s |
| 2 | 4096 | 416.27s |

### 1.4 Batch insert, Virtual thread
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
CPU/GC, Memory usage, Threads by visualvm as:
![Jdbc-VT-1024](https://i.postimg.cc/kMtZsTJJ/Jdbc-VT-1024.jpg)
CPU and memory fluctuate are both greater than platform thread.

*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 369.47s |
| 2 | 4096 | 433.68s |

## 2 Mybatis
### 2.1 Single insert, Single thread
Same as [1.1](#11-single-insert-single-thread), it also cost too long so that and I would not try it.
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

### 2.2 Batch insert, Single thread
Use `<foreach>` to concatenate and insert SQL statements in batches locally.
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
*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1803.51s |
| 2 | 4096 |  |

### 2.3 Batch insert, Platform thread
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
CPU/GC, Memory usage, Threads by visualvm as:
![Mybatis-PT-1024](https://i.postimg.cc/W3dyQn07/Mybats-PT-1024.jpg)
Because Mybatis concats SQL is executed locally, the CPU and memory usage is high and fluctuates dramatically.

*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 513.22s |
| 2 | 4096 | 705.44s |

### 2.4 Batch insert, Virtual thread
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
CPU/GC, Memory usage, Threads by visualvm as:
![Mybatis-VT-1024](https://i.postimg.cc/sXbLyhcC/Mybatis-VT-1024.jpg)
Compared to platform thread, the fluctuation is smaller.

*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 752.42s |
| 2 | 4096 | 687.05s |

## 3 JPA/Mybatis-plus
### 3.1 Single insert, Single thread
Same as [1.1](#11-single-insert-single-thread) and [2.1](#21-single-insert-single-thread).
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

### 3.2 Batch insert, Single thread
Because the JPA primary key is set with the `IDENTITY` policy, the batch processing is invalid and cannot be optimized by `rewriteBatchedStatements`. It was too slow, so I didn't test. 😓
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
### 3.3 Batch insert, Platform thread
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
CPU/GC, Memory usage, Threads by visualvm as:
![Jpa-PT-1024](https://i.postimg.cc/X7fPSXBt/Jpa-PT-1024.jpg)
Also because of `IDENTITY` policy so it takes more time. If we set the primary key manually, it will be much faster. CPU, Memory usage are very nice and stable.

*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 1285.88s |
| 2 | 4096 | 1263.79s |

### 3.4 Batch insert, Virtual thread
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
CPU/GC, Memory usage, Threads by visualvm as:
![Jpa-VT-1024](https://i.postimg.cc/Hn5hLkZc/Jpa-VT-1024.jpg)
Perhaps because of the adaptation of Virtual thread and JPA, there was a gap period of nearly 20 minutes in the middle (this was the case for many tests). 🤔
There will occur a dead lock<sup>[1]</sup>:
- virtual thread is blocked in `synchronized` code, then virtual thread will pinned with carrier thread<sup>[2]</sup>. And all of carrier threads are pinned.
- a `lock` is released by owner.
- another virtual thread(called A) that is not blocked in `synchronized` code(won't pin with a carrier thread), is waiting for a `lock`. After `lock` is released, A is notified and try to get `lock`, but there is no available carrier thread so that A will never get `lock`.

*Result*:
| id | batchSize | cost |
| :-: | :-: | :-: |
| 1 | 1024 | 2724.81s |
| 2 | 4096 |  |

## 4 Summary
1. Speed: 
   - JdbcTemplate    >   Mybatis         >>   JPA
   - Platform Thread >=  Virtual Thread  >>   Single Thread
2. CPU/GC usage: 
   - JdbcTemplate < JPA < Mybttis
3. Memory usage:
   - JdbcTemplate < JPA << Mybttis

[1]: [Java 21 Virtual Threads - Dude, Where’s My Lock?](https://netflixtechblog.com/java-21-virtual-threads-dude-wheres-my-lock-3052540e231d)
[2]: [JEP 491: Synchronize Virtual Threads without Pinning](https://openjdk.org/jeps/491)
