---
title: High Performance MySQL 2
category: Tech
tag: MySQL
date: 2025-04-12T00:09:53+08:00
---


# HighPerformanceMySQL-2
> 深入理解之后再改变。
> 
> MySQL 官方文档见 [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)。

## 第 4 部分 操作系统/硬件优化
> 木桶效应同样适用于 MySQL。MySQL 的性能受限于整个系统中最薄弱的环节。磁盘使用、空闲内存、CPU 使用、网络及连接的组件，其中任何一部分都可能成为 MySQL 性能的瓶颈。

MySQL 有两个主要目标：
1. 低延迟（快速响应）
2. 高吞吐量（尽可能多地执行任务）

### 4.1 CPU
我们可以通过检查 CPU 使用率来判断工作负载是否受 CPU 限制，但不要只看整体的 CPU 负载。更要关注 CPU 使用率和 I/O 是否**均衡**，以及每个 CPU 核心的工作负载是否**均匀**。
*得益于现代强大的 CPU 处理能力，通常情况下，CPU 不会成为 MySQL 性能的瓶颈。*

### 4.2 内存/磁盘
> 使用 SSD 可以解决 99% 的性能问题。

内存的读取速度远快于磁盘 I/O，因此应最大化可用内存以避免磁盘 I/O。
但最终内存中的数据必须刷入磁盘以实现数据持久化，事实上，主内存中的缓存还可以通过两种方式提供帮助：
1. 将多次写操作合并为一次刷盘。
    ```mysql
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 1;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 1;

    # -- 合并为 -->
    # name = 'WANG ER'
    ```
2. 将多次 I/O 合并为一次磁盘操作。
    ```mysql
    # 假设数据在同一个页帧中
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 2;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 3;

    # 当更新页帧中的某一项时，一次性更新所有需要修改的内容。
    # 将随机 I/O 转换为顺序 I/O，从而能够更优地刷入磁盘
    ```
因此，许多事务系统采用**预写日志**策略：允许在内存中更新，将变更写入顺序日志文件，并延迟将变更刷入磁盘。

### 4.3 网络
1. 丢包：常见的网络性能问题，网络协议的超时重传策略可能导致显著的性能下降。
2. DNS 解析异常：建议为所有服务器设置 `skip_name_resolve`。
3. 连接限制：调整 `ip_local_port_range`/`tcp_max_syn_backlog`/`tcp_fin_timeout`
    ```bash
    echo 1024 65535 > /proc/sys/net/ipv4/ip_local_port_range
    echo 4096 > /proc/sys/net/ipv4/tcp_max_syn_backlog
    echo <value> > /proc/sys/net/ipv4/tcp_fin_timeout
    ```

### 4.4 文件系统
几乎没有什么要注意的。推荐使用 `XFS` 文件系统。

### 4.5 其他
- 建议设置 `/sys/block/sda/queue/scheduler`：`noop`/`deadline`
- 建议设置 `/proc/sys/vm/swappiness`：0
    ```bash
    echo 0 > /proc/sys/vm/swappiness
    ```

## 第 5 部分 服务器配置优化
> **不要按使用率来优化！！！**<sup>[1]</sup>
> 不要用调优脚本去"调优"，浪费时间。

### 5.1 最小配置
```mysql
[mysqld]
# 通用
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

# 日志
log_error                       = /var/lib/mysql/mysql-error.log
log_slow_queries                = /var/lib/mysql/mysql-slow.log

# 其他
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
以上是一个最小的 MySQL 配置，看起来很小，但已经超过了大多数人的需求。对于其他需求，可以按需添加配置。

### 5.2 内存配置
内存使用主要有四个方面：
- 每个连接的内存：由于连接数不确定，内存使用量难以估算
- 操作系统的内存
- InnoDB 缓存的内存（`innodb_buffer_pool_size`）：InnoDB 缓存存储索引、行数据、哈希索引、锁及其他内部结构。InnoDB 缓存还可以延迟写入。**当服务器以 `--innodb-dedicated-server` 启动时，InnoDB 会自动计算并设置该值**。
- 线程缓存的内存（`thread_cache_size`）：线程缓存存储那些未与连接绑定的线程。当需要创建新连接时，MySQL 会从线程缓存中获取一个线程并提供给新连接，这样 MySQL 可以快速响应，直到线程缓存中没有可用线程。

### 5.3 I/O 配置
InnoDB 缓存块和文件如下：
![Innodb_cache_files](https://i.postimg.cc/y880mkmr/Innodb-cache-files.png)
- 事务日志（`innodb_log_file_size`）
- 日志缓存（`innodb_log_buffer_size`）：更新数据后，InnoDB 将操作记录到日志缓存中。当缓存已满、事务提交或每隔一秒时，InnoDB 将日志刷入磁盘。
- 刷盘方式（`innodb_flush_log_at_trx_commit`/`sync_binlog`）：默认且推荐设置为 **1**
- 表空间：推荐使用 `innodb_file_per_table`，这允许每张表使用单独的文件。

### 5.4 并发配置
当面临并发问题时，最好的选择是数据分片，如果无法分片，则考虑 `innodb_thread_concurrency`<sup>[2]</sup>。

### 5.5 安全配置
- `max_connect_errors`：可以适当增大此值。如果 `skip_name_resolve` 为 `ON`，则 `max_connect_errors` 无效。
- `max_connections`：应设置得足够大。
- `skip_name_resolve`：建议开启此设置。
- `read_only/super_read_only`：建议开启此设置。

### 5.6 高级设置
- `innodb_autoinc_lock_mode`：此选项控制 InnoDB 如何生成自增主键值，在某些情况下
当存在高并发插入时，这可能成为瓶颈<sup>[3]</sup>。
- `innodb_buffer_pool_instances`：将缓存池拆分为多个段。
- `innodb_read_io_threads/innodb_write_io_threads`：根据磁盘数量设置值。
- `innodb_old_blocks_time`：默认为 0。设置为一个较小的值，例如 1000（1 秒）非常有用。

[1]: 更多内容参见 C.Millsap、J.Holt 所著的 *Optimizing Oracle Performance*。
[2]: 更多内容参见 [17.8.4 Configuring Thread Concurrency for InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-thread_concurrency.html)。
[3]: 更多内容参见 [InnoDB AUTO_INCREMENT Lock Modes](https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html#innodb-auto-increment-lock-modes)。