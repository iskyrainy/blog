---
title: High Performance MySQL 4
category: Tech
tag: MySQL
date: 2025-05-30T00:24:03+08:00
---


# HighPerformanceMySQL-4
> Change thing after you understand it deeply.
> 
> MySQL offical doc see [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html).

## Part 9 Replication
Replication step, all of these steps are asynchronous:
1. Master node record operations into *bin log*
2. Slave node copy bin log of source node
3. Slave node redo bin log

MySQL offers three ways to replication:
- base SQL: can not apply to those SQL which executed uncertainly
- base row: may cause a large log
- mixed method: default base SQL, only base row in need

**GTID**: GTID ensures that the replica server continues to replicate from the correct log position after a restart. Every event of master node will get a GTID. GTID are writed into bin log with its event. After slave node finish event and mark GTID as complished.

Some config for replication safety：
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

Multi-threaded replication: 
- DATABASE: each database can have one and only one thread to copy bin log
- LOGICAL_CLOCK: allows parallel updates to the same database using multiple threads

Semisynchronous replication: master node will ensure at least one slave node successfully copy event bin log from master node

Replication switch:
1. Determine which replica becomes the new source
2. Check delay, ensure delay less second
3. Change master node to `super_read_only`
4. Wait data synchronous
5. Unset `read_only` of slave node
6. Switch request flows into new master node
7. Switch all replicas point to new master node

Replication problems and solutions:
- bin log of master node damage: Inevitably, some transaction data will be lost
- temporary table missing: Incompatible with statement-based replication, row-based replication is required

## Part 10 Backup And Recover
> **Replication is not Backup.** 

- logic backup: dump data from MySQL
- source file backup: backup source data file
