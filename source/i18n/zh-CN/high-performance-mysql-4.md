---
title: 高性能 MySQL 4
category: Tech
tag: MySQL
date: 2025-05-30T00:24:03+08:00
---


# HighPerformanceMySQL-4
> 深入理解之后再改变它。
>
> MySQL 官方文档参见 [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)。

## 第 9 部分 复制
复制步骤，以下所有步骤都是异步的：
1. 主节点将操作记录到 *bin log*
2. 从节点复制源节点的 bin log
3. 从节点重放 bin log

MySQL 提供三种复制方式：
- 基于 SQL：无法应用于那些执行结果不确定的 SQL
- 基于行：可能导致日志过大
- 混合方式：默认基于 SQL，仅在需要时基于行

**GTID**：GTID 确保副本服务器在重启后能够从正确的日志位置继续复制。主节点的每个事件都会获得一个 GTID。GTID 与其事件一起被写入 bin log。从节点完成事件后将 GTID 标记为已完成。

复制安全性的一些配置：
```shell
# Ensure that each transaction log is synchronously written to the disk.
innodb_flush_log_at_trx_commit=1

# The binary log is synchronously written to disk at the time of each transaction
sync_binlog=1

# After the replication transaction is complete, the synchronous write to disk operation also needs to be completed
relay_log_info_repository=TABLE

# When a crash is detected, all local relay logs are discarded and the lost data is retrieved from the origin server
relay_log_recovery=ON
```

多线程复制：
- DATABASE：每个数据库只能有一个线程来复制 bin log
- LOGICAL_CLOCK：允许多个线程并行更新同一个数据库

半同步复制：主节点将确保至少有一个从节点成功从主节点复制事件 bin log

复制切换：
1. 确定哪个副本成为新的源
2. 检查延迟，确保延迟小于一秒
3. 将主节点改为 `super_read_only`
4. 等待数据同步
5. 取消从节点的 `read_only`
6. 将请求流切换到新的主节点
7. 将所有副本指向新的主节点

复制问题及解决方案：
- 主节点 bin log 损坏：不可避免地会丢失部分事务数据
- 临时表缺失：与基于语句的复制不兼容，需要使用基于行的复制

## 第 10 部分 备份与恢复
> **复制不是备份。**

- 逻辑备份：从 MySQL 中导出数据
- 源文件备份：备份源数据文件