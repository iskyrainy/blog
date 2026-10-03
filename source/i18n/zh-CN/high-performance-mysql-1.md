---
title: 高性能 MySQL 1
category: Tech
tag: MySQL
date: 2025-03-31T22:36:40+08:00
---

# HighPerformanceMySQL-1
> 深入理解后再做改变。
> 
> MySQL 官方文档见 [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)。

## 第一部分 MySQL 架构
### 1.1 MySQL 逻辑分层
MySQL 服务器分为 3 层：
1. 连接/线程控制层；
2. 查询层：查询解析、分析、优化；内置函数；存储过程；触发器；视图；
3. 引擎层；

### 1.2 并发控制
- 读/写锁；
- 锁粒度：
    - 表锁：开销较低，并发度较低；
    - 行锁：开销较高，并发度较高，在引擎层实现；

### 1.3 事务
ACID：原子性、一致性、隔离性、持久性。

隔离级别：
| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 锁定读 |
| :- | :-: | :-: | :-: | :-: |
| READ UNCOMMITTED | 是 | 是 | 是 | 否 |
| READ COMMITTED | 否 | 是 | 是 | 否 |
| REPEATABLE READ | 否 | 否 | 是 | 否 |
| SERIALIZABLE | 否 | 否 | 否 | 是 |

MySQL 默认级别为 `REPEATABLE READ`。在 RC 隔离级别下，每次快照读都会生成并获取最新的 Read View；在 RR 隔离级别下，同一事务中的第一次快照读会创建 Read View，后续的快照读获取相同的 Read View。

死锁：InnoDB 引擎会回滚持有行锁最少的事务。

两阶段锁协议：事务可以在任意运行时刻获取锁，但只能在提交或回滚后释放锁。

### 1.4 MVCC
MVCC 使得事务在 RR/RC 级别下无论运行多久都能看到相同的视图。

为什么需要 MVCC：
- 读-读：安全；
- 读-写：不安全，可能导致脏读/不可重复读/幻读<sup>[1]</sup>；
- 写-写：不安全，可能导致更新丢失；

MVCC 可以通过**无锁**并发控制来解决读-写冲突。

1. 隐式字段：除了我们自定义的字段外，每行记录还有数据库隐式定义的字段，如 DB_TRX_ID、DB_ROLL_PTR、DB_ROW_ID。
    - DB_TRX_ID：6 字节，记录创建该记录/最后修改该记录的事务 ID
    - DB_ROLL_PTR：7 字节，回滚指针，指向该记录的上一个版本
    - DB_ROW_ID：6 字节，隐式主键
2. undo log：
    - insert undo log：事务插入新记录时生成的 undo log，仅在事务回滚时需要，事务提交后可以立即丢弃
    - update undo log：事务更新或删除时生成的 undo log；只有当快照读或事务回滚不涉及该日志时，对应的日志才会被 `purge` 线程清除

3. read view<sup>[2]</sup>：当事务执行快照读时，MySQL 会为相关行数据生成一个 read view。用于确认哪个版本的数据对该事务可见，确保整个事务期间所有读操作保持一致。

### 1.5 复制
详见[第 9 部分](#part-9)。

### 1.6 数据文件结构
- InnoDB：
    - 表空间文件（`.ibd`）：InnoDB 使用表空间文件存储数据和索引
    - 系统表空间（`ibdata1`）：包含 InnoDB 数据字典、undo log、系统事务信息等
- 日志：
    - 二进制日志：记录所有修改数据库内容的语句，用于复制和数据恢复
    - redo log：InnoDB 特有，记录数据页的变更，用于崩溃恢复
    - undo log：InnoDB 特有，用于回滚事务和 MVCC
    - 慢查询日志：记录超时的 sql
    - 错误日志：记录启动、运行和停止过程中发生的异常
- 配置：
    - my.ini：记录 MySQL 全局配置设置
- 其他：
    - PID 文件（`.pid`）：记录 MySQL 进程 PID
    - socket 文件：Unix/Linux 下的本地连接 socket 文件

## 第二部分 可靠的监控
### 2.1 可用性
> 理解并接受组件故障是不可避免的，然后尽可能提供最好的服务。

首选方法是通过远程访问并执行，例如 `SELECT 1`。也可以进行更复杂的可用性验证，具体取决于需求。

### 2.2 查询延迟
多关注**慢查询日志**，一些数据源连接组件提供慢查询追踪，如 Druid 等。

### 2.3 错误分析
- `lock wait timeout`：可能是行级锁竞争在增加，事务不断重试但仍然失败
- `aborted connections`：可能是客户端与数据库之间的访问存在问题
- `too many connections`：可能是客户端需要使用连接池访问数据库，或者调大 `max_connections`；关注比例（`thread_connected/max_connections`）比关注 `thread_connected` 的值更有意义

### 2.4 重要监控项
1. 磁盘使用率
2. 连接数
3. 复制延迟
4. I/O 使用率
5. 自增键空间：详见[第 6 部分](https://gdhvxcj.cn/blog/2025/05/08/HighPerformanceMySQL-3#part-6-design-and-manage-schema)
6. 备份

### 2.5 建议
1. 始终关注峰值而非平均值
2. 百分位数据能更好地反映服务质量
3. 尽可能长时间地保留数据

## 第三部分 Performance Schema
Performance Schema 包含两部分：instrument 和 comsumer。

### 3.1 Instrument
一个 instrument 名称由一系列以 '/' 字符分隔的元素组成<sup>[3]</sup>。
MySQL 将所有 instrument 存储在 `setup_instruments` 中。
```mysql
mysql> SELECT NAME, ENABLED, TIMED
       FROM performance_schema.setup_instruments;
+---------------------------------------------------+---------+-------+
| NAME                                              | ENABLED | TIMED |
+---------------------------------------------------+---------+-------+
...
| stage/sql/end                                     | NO      | NO    |
| stage/sql/executing                               | NO      | NO    |
| stage/sql/init                                    | NO      | NO    |
| stage/sql/insert                                  | NO      | NO    |
...
| statement/sql/load                                | YES     | YES   |
| statement/sql/grant                               | YES     | YES   |
| statement/sql/check                               | YES     | YES   |
| statement/sql/flush                               | YES     | YES   |
...
| wait/synch/mutex/sql/LOCK_global_read_lock        | YES     | YES   |
| wait/synch/mutex/sql/LOCK_global_system_variables | YES     | YES   |
| wait/synch/mutex/sql/LOCK_lock_db                 | YES     | YES   |
| wait/synch/mutex/sql/LOCK_manager                 | YES     | YES   |
...
| wait/synch/rwlock/sql/LOCK_grant                  | YES     | YES   |
| wait/synch/rwlock/sql/LOGGER::LOCK_logger         | YES     | YES   |
| wait/synch/rwlock/sql/LOCK_sys_init_connect       | YES     | YES   |
| wait/synch/rwlock/sql/LOCK_sys_init_slave         | YES     | YES   |
...
| wait/io/file/sql/binlog                           | YES     | YES   |
| wait/io/file/sql/binlog_index                     | YES     | YES   |
| wait/io/file/sql/casetest                         | YES     | YES   |
| wait/io/file/sql/dbopt                            | YES     | YES   |
...
``` 

### 3.2 Comsumer
用于存储监控信息的表<sup>[4]</sup>。
- `*_current`：服务器上当前正在进行的事件
- `*_history`：每个线程最近完成的 10 个事件；可配置
- `*_history_long`：全局范围内每个线程最近完成的 10000 个事件；可配置
- `event_waits_*`：事件等待信息
- `events_statements_*`：SQL 查询信息
- `events_stages_*`：SQL 阶段信息，例如 `sending data` 等
- `event_transactions_*`：事务信息
- `*_summary_by_*`：信息汇总表
- `*_instances`：对象实例表
- `setup_*`：运行时设置

### 3.3 使用 Performance Schema
1. 将历史事件的收集限制为运行查询的用户
    ```mysql
    mysql> SELECT * FROM performance_schema.setup_actors;
    +------+------+------+---------+---------+
    | HOST | USER | ROLE | ENABLED | HISTORY |
    +------+------+------+---------+---------+
    | %    | %    | %    | YES     | YES     |
    +------+------+------+---------+---------+

    mysql> UPDATE performance_schema.setup_actors
        SET ENABLED = 'NO', HISTORY = 'NO'
        WHERE HOST = '%' AND USER = '%';

    mysql> INSERT INTO performance_schema.setup_actors
        (HOST,USER,ROLE,ENABLED,HISTORY)
        VALUES('localhost','test_user','%','YES','YES');

    mysql> SELECT * FROM performance_schema.setup_actors;
    +-----------+-----------+------+---------+---------+
    | HOST      | USER      | ROLE | ENABLED | HISTORY |
    +-----------+-----------+------+---------+---------+
    | %         | %         | %    | NO      | NO      |
    | localhost | test_user | %    | YES     | YES     |
    +-----------+-----------+------+---------+---------+
    ```
2. 确保语句和阶段插桩已启用
3. 确保 `events_statements_*` 和 `events_stages_*` consumer 已启用
4. 运行你想分析性能的语句
    ```mysql
    mysql> SELECT * FROM employees.employees WHERE emp_no = 10001;
    +--------+------------+------------+-----------+--------+------------+
    | emp_no | birth_date | first_name | last_name | gender | hire_date |
    +--------+------------+------------+-----------+--------+------------+
    |  10001 | 1953-09-02 | Georgi     | Facello   | M      | 1986-06-26 |
    +--------+------------+------------+-----------+--------+------------+
    ```
5. 通过查询 `events_statements_history_long` 表获取该语句的 `EVENT_ID`
    ```mysql
    mysql> SELECT EVENT_ID, TRUNCATE(TIMER_WAIT/1000000000000,6) as Duration, SQL_TEXT
        FROM performance_schema.events_statements_history_long WHERE SQL_TEXT like '%10001%';
    +----------+----------+--------------------------------------------------------+
    | event_id | duration | sql_text                                               |
    +----------+----------+--------------------------------------------------------+
    |       31 | 0.028310 | SELECT * FROM employees.employees WHERE emp_no = 10001 |
    +----------+----------+--------------------------------------------------------+
    ```
6. 查询 `events_stages_history_long` 表以获取该语句的阶段事件
    ```mysql
    mysql> SELECT event_name AS Stage, TRUNCATE(TIMER_WAIT/1000000000000,6) AS Duration
        FROM performance_schema.events_stages_history_long WHERE NESTING_EVENT_ID=31;
    +--------------------------------+----------+
    | Stage                          | Duration |
    +--------------------------------+----------+
    | stage/sql/starting             | 0.000080 |
    | stage/sql/checking permissions | 0.000005 |
    | stage/sql/Opening tables       | 0.027759 |
    | stage/sql/init                 | 0.000052 |
    | stage/sql/System lock          | 0.000009 |
    | stage/sql/optimizing           | 0.000006 |
    | stage/sql/statistics           | 0.000082 |
    | stage/sql/preparing            | 0.000008 |
    | stage/sql/executing            | 0.000000 |
    | stage/sql/Sending data         | 0.000017 |
    | stage/sql/end                  | 0.000001 |
    | stage/sql/query end            | 0.000004 |
    | stage/sql/closing tables       | 0.000006 |
    | stage/sql/freeing items        | 0.000272 |
    | stage/sql/cleaning up          | 0.000001 |
    +--------------------------------+----------+
    ```
7. 进行其他你想要的性能分析

### 3.4 sys Schema
基于 Performance Schema 的视图和存储组件，旨在让 Performance Schema 的使用体验更加顺畅<sup>[5]</sup>。它本身**不存储**任何数据。如果你找不到想要的数据，请在 Performance Schema 基础表中查找。

### 3.5 建议
Performance Schema 应当**启用**，Instrument 和 Consumer 应按需动态启用。

[1]: InnoDB 使用一种称为 next-key locking 的算法来修复幻读。详见 [17.7.4 Phantom Rows](https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html)。
[2]: 见博客 [mvcc（多版本并发控制）原理的理解](https://blog.csdn.net/jerry11112/article/details/125894758?fromshare=blogdetail&sharetype=blogdetail&sharerId=125894758&sharerefer=PC&sharesource=qq_43321767&sharefrom=from_link)。
[3]: 详见 [29.6 Performance Schema Instrument Naming Conventions](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-instrument-naming.html)。
[4]: 详见 [29.12.1 Performance Schema Table Reference](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-table-reference.html)。
[5]: 详见 [Chapter 30 MySQL sys Schema](https://dev.mysql.com/doc/refman/8.4/en/sys-schema.html)。