---
title: High Performance MySQL 2
category: Tech
tag: MySQL
date: 2025-04-12T00:09:53+08:00
---


# HighPerformanceMySQL-2
> Change thing after you understand it deeply.
> 
> MySQL offical doc see [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html).

## Part 4 OS/Hardware Optimization
> The barrel effect also applies to MySQL. MySQL's performance is limited by the weakest node in the entire system. Disk usage, free memory, CPU usage, network and connected components, all of parts maybe block MySQL's performance.

MySQL has two main targets:
1. low delay(response fast)
2. high throughput(run as much as possible jobs)

### 4.1 CPU
We can determine if the workload is CPU limited by checking the CPU usage, but do not just see the overall CPU load. Care more about CPU usage and I/O are **balance**, and each CPU core's workload are **even**.
*Thanks to the modern powerful CPU process, in general, the CPU will not be a limitation of MySQL performance.*

### 4.2 Memory/Disk
> Use SSD can solve 99% of performance problems.

Memory is fetched much faster than disk I/O, so maximize the available memory to avoid disk I/O.
But finally data in memory have to flush into disk for data persistence, in fact, cache from main memory also can help in two ways:
1. merge multiple write operations into once flush.
    ```mysql
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 1;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 1;

    # -- merge into -->
    # name = 'WANG ER'
    ```
2. merge multiple I/O into once disk operation.
    ```mysql
    # assume data in the same page frame
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 2;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 3;

    # When update one of the page frame, update all the content that needs to be changed at once. 
    # Convert random I/O to sequential I/O so that it can be flushed to disk more optimally
    ```
As a result, many transactional systems employ a **write-ahead logging** strategy: allowing in-memory updates, writing changes to sequential log files, and delaying flushing of changes to disk.

### 4.3 Network
1. Packet loss: a common network performance problem, and a timeout retransmission policy for network protocols can result in significant performance degradation.
2. DNS resolution exceptions: it is recommended to set `skip_name_resolve` for all servers.
3. Connection limit: revise `ip_local_port_range`/`tcp_max_syn_backlog`/`tcp_fin_timeout`
    ```bash
    echo 1024 65535 > /proc/sys/net/ipv4/ip_local_port_range
    echo 4096 > /proc/sys/net/ipv4/tcp_max_syn_backlog
    echo <value> > /proc/sys/net/ipv4/tcp_fin_timeout
    ```

### 4.4 File System
Hardly anything. We recommend that you use the `XFS` file system.

### 4.5 Other
- recommend set `/sys/block/sda/queue/scheduler`: `noop`/`deadline`
- recommend set `/proc/sys/vm/swappiness`: 0
    ```bash
    echo 0 > /proc/sys/vm/swappiness
    ```

## Part 5 Server Config Optimization
> **Do not optimize by usage rate!!!**<sup>[1]</sup>
> Don't use tuning scripts for 'tuning', waste time.

### 5.1 Min Config
```mysql
[mysqld]
# GENRAL
datadir                         = /var/lib/mysql
socket                          = /var/lib/mysql/mysql.sock
pid_file                        = /var/lib/mysql/mysql.pid
user                            = mysql
port                            = 3306

# INNODB
innodb_buffer_pool_size         = <value>
innodb_log_file_size            = <value>
innodb_file_per_table           = 1
innodb_flush_method             = O_DIRECT

# LOGGING
log_error                       = /var/lib/mysql/mysql-error.log
log_slow_queries                = /var/lib/mysql/mysql-slow.log

# OTHER
tmp_table_size                  = 32M
max_heap_table_size             = 32M
max_connections                 = <value>
thread_cache_size               = <value>
table_open_cache                = <value>
open_files_limit                = 65535
skip_name_resolve               = ON

[client]
socket                          = /var/lib/mysql/mysql.sock
port                            = 3306
```
Above is a minimal MySQL configuration, which seems to be small but more than most people need. For other needs, configurations can be added as needed.

### 5.2 Config Memory
There are four main aspects about memory usage:
- memory for each connection: It's hard to figure out memory usage because of unsure number of connection
- memory for OS
- memory for Innodb cache(`innodb_buffer_pool_size`): Innodb cache store index, row data, hash index, lock and other inner-structs. Also Innodb cache do write-delay. **When the server is started with '--innodb-dedicated-server', InnoDB automatically calculates values for and set**.
- memory for thread cache(`thread_cache_size`): Thread cache store those threads which are not bind with connection. When a new connection need be create, MySQL will get a thread from thread cache and offer this thread to new connection, so MySQL can response fast until thread cache has no thread.

### 5.3 Config I/O
Innodb cache blocks and files as follow:
![Innodb_cache_files](https://i.postimg.cc/y880mkmr/Innodb-cache-files.png)
- transaction log(`innodb_log_file_size`)
- log cache(`innodb_log_buffer_size`): After update data, Innodb record operations to log cache. And when cache is full or transaction commit or each seconds, Innodb fulsh log into disk.
- flush method(`innodb_flush_log_at_trx_commit`/`sync_binlog`): default and recommend set this **1**
- table space: recommend use `innodb_file_per_table`, this allow every table use a single file.

### 5.4 Config Concurrency
When face a concurrency problem, best choise is data sharding, and if can't sharding then think about `innodb_thread_concurrency`<sup>[2]</sup>.

### 5.5 Config Security
- `max_connect_errors`: This value can be increased appropriately. If `skip_name_resolve` is 'ON', then `max_connect_errors` is invalid.
- `max_connections`: Should set this value big enough.
- `skip_name_resolve`: Recommend start this setting.
- `read_only/super_read_only`: Recommend start this setting.

### 5.6 Advanced settings
- `innodb_autoinc_lock_mode`: This option controls how InnoDB generates auto-incrementing primary key values, such as in some cases
This can be a bottleneck when there are high concurrent inserts<sup>[3]</sup>.
- `innodb_buffer_pool_instances`: Split cache pool into multiple segements.
- `innodb_read_io_threads/innodb_write_io_threads`: Set value by the number of disks. 
- `innodb_old_blocks_time`: Default 0. Set to a small value e.g. 1000 (1 second) is very useful.

[1]: See more in *Optimizing Oracle Performance* by C.Millsap, J.Holt.
[2]: See more [17.8.4 Configuring Thread Concurrency for InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-thread_concurrency.html).
[3]: See more [InnoDB AUTO_INCREMENT Lock Modes](https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html#innodb-auto-increment-lock-modes).
