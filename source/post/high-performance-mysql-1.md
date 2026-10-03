---
title: High Performance MySQL 1
category: Tech
tag: MySQL
date: 2025-03-31T22:36:40+08:00
---

# HighPerformanceMySQL-1
> Change thing after you understand it deeply.
> 
> MySQL offical doc see [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html).

## Part 1 MySQL Architecture
### 1.1 MySQL Logic Layer
MySQL server has 3 layers:
1. connection/thread controller layer;
2. query layer: query parsing, analysis, optimization; built-in functions; stored procedures; triggers; views;
3. engine layer;

### 1.2 Concurrency Control
- Read/Write lock;
- Lock granularity: 
    - table lock: cost lower, concurrency lower;
    - row lock: cost higher, concurrency higher, implement in engine layer;

### 1.3 Transaction
ACID: atomicity, consistency, isolation, durability.

Isolation level:
| LEVEL | dirty read | nonrepeatable read | phantom row | locked read |
| :- | :-: | :-: | :-: | :-: |
| READ UNCOMMITTED | YES | YES | YES | NO |
| READ COMMITTED | NO | YES | YES | NO |
| REPEATABLE READ | NO | NO | YES | NO |
| SERIALIZABLE | NO | NO | NO | YES |

MySQL default level is `REPEATABLE READ`. At the RC isolation level, each snapshot read generates and obtains the latest Read View; at the RR isolation level, the first snapshot read in the same transaction creates a Read View, and subsequent snapshot reads obtain the same Read View.

Dead Lock: Innodb engine will roll back the transaction with the fewest row locks.

two-phase locking protocol: Transaction can get lock in any running time, but only release lock after commit or roll back.

### 1.4 MVCC
MVCC make transaction can see the same view in any time no matter how long it runs for RR/RC level.

Why need MVCC:
- read-read: secure;
- read-write: unsecure, may cause dirty read/nonrepeatable read/phantom row<sup>[1]</sup>;
- write-write: unsecure, may cause update lost;

MVCC can fix read-write conflict by **lock-free** concurrency control.

1. implicit fields: In addition to our custom fields, each row of records also has fields implicitly defined by the database, such as DB_TRX_ID, DB_ROLL_PTR, DB_ROW_ID.
    - DB_TRX_ID: 6 bytes, records the transaction ID that created this record/last modified this record
    - DB_ROLL_PTR: 7 bytes, rollback pointer, pointing to the previous version of this record
    - DB_ROW_ID: 6 bytes, invisible primary key
2. undo log: 
    - insert undo log: the undo log generated when a transaction inserts a new record, is only needed when the transaction is rolled back and can be discarded immediately after the transaction is committed
    - update undo log: the undo log generated when a transaction is updated or deleted; only when the fast read or transaction rollback does not involve the log, the corresponding log will be cleared by the `purge` thread

3. read view<sup>[2]</sup>: when a transaction performs a snapshot read, MySQL generates a read view for the relevant row data. Used to confirm which version of data is visible to this transaction, ensuring that all read operations are consistent throughout the transaction.

### 1.5 Duplicate
See more in [Part 9](#part-9).

### 1.6 Data File Struct
- Innodb:
    - tablespace files(`.ibd`): the InnoDB uses tablespace files to store data and indexes
    - system tablespace(`ibdata1`): contains InnoDB data dictionary, undo log, system transaction information, etc.
- Log: 
    - binary log: records all statements that modify database content for replication and data recovery
    - redo log: InnoDB-specific, records changes to data pages, used for crash recovery
    - undo log: InnoDB-specific, used for rolling back transactions and MVCC
    - slow query log: record timeout sql
    - error log: record exceptions occured in startup, running and stop
- Config:
    - my.ini: record MySQL global config setting
- Other:
    - PID file(`.pid`): record MySQL process PID
    - socket file: local connection socket file in Unix/Linux

## Part 2 Reliable Monitor
### 2.1 Availability
> Understand and accept that component failures are inevitable, then provide the best service possible.

The preferred method is to access and execute remotely, such as `SELECT 1`. More complex usability verification is also possible, depending on the requirements.

### 2.2 Query Delay
Take more attention about **slow query log**, and some datasource connect components offer slow query track, such as Druid, etc.

### 2.3 Error Analysis
- `lock wait timeout`: may be row-level lock contention is increasing and transactions are constantly retrying but still failing
- `aborted connections`: may be a problem with the access between the client and the database
- `too many connections`: may be client need use connection pool to access database or update `max_connections`; pay more attention to ratio(`thread_connected/max_connections`) is better than the value of `thread_connected`

### 2.4 Important Monitor
1. Disk Usage
2. Connection Number
3. Replication Delay
4. I/O Usage
5. Auto-increment Keyspace: see more [Part 6](https://gdhvxcj.cn/blog/2025/05/08/HighPerformanceMySQL-3#part-6-design-and-manage-schema)
6. Backup

### 2.5 Recommendation
1. Always focus on the peak value rather than the average value
2. Percentile data can better reflect service quality
3. Keep data as long as possible

## Part 3 Performance Schema
Performance Schema includes two parts: instrument and comsumer.

### 3.1 Instrument
An instrument name consists of a sequence of elements separated by '/' characters<sup>[3]</sup>.
MySQL storage all instruments in `setup_instruments`.
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
Table for storing monitoring information<sup>[4]</sup>.
- `*_current`: events currently in progress on the server
- `*_history`: the 10 most recently completed events for each thread; can be config
- `*_history_long`: from global, the 10000 most recently completed events for each thread; can be config
- `event_waits_*`: events wait information
- `events_statements_*`: SQL query information
- `events_stages_*`: SQL stage information, such as `sending data` etc.
- `event_transactions_*`: transaction information
- `*_summary_by_*`: information summary table
- `*_instances`: object instance table
- `setup_*`: runtime settings

### 3.3 Use Performance Schema
1. Limit the collection of historical events to the user that runs the query
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
2. Ensure that statement and stage instrumentation is enabled
3. Ensure that `events_statements_*` and `events_stages_*` consumers are enabled
4. Run statement that you want to profile
    ```mysql
    mysql> SELECT * FROM employees.employees WHERE emp_no = 10001;
    +--------+------------+------------+-----------+--------+------------+
    | emp_no | birth_date | first_name | last_name | gender | hire_date |
    +--------+------------+------------+-----------+--------+------------+
    |  10001 | 1953-09-02 | Georgi     | Facello   | M      | 1986-06-26 |
    +--------+------------+------------+-----------+--------+------------+
    ```
5. Get the `EVENT_ID` of the statement by querying the `events_statements_history_long` table
    ```mysql
    mysql> SELECT EVENT_ID, TRUNCATE(TIMER_WAIT/1000000000000,6) as Duration, SQL_TEXT
        FROM performance_schema.events_statements_history_long WHERE SQL_TEXT like '%10001%';
    +----------+----------+--------------------------------------------------------+
    | event_id | duration | sql_text                                               |
    +----------+----------+--------------------------------------------------------+
    |       31 | 0.028310 | SELECT * FROM employees.employees WHERE emp_no = 10001 |
    +----------+----------+--------------------------------------------------------+
    ```
6. Query the `events_stages_history_long` table to retrieve the statement's stage events
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
7. Some other profile that you want to do

### 3.4 sys Schema
The view and storage components based on Performance Schema are designed to make the Performance Schema experience smoother<sup>[5]</sup>. It does **not store** any data itself. If you cannot find the data you want, search in the Performance Schema base table.

### 3.5 Recommendation
Performance Schema should be **enabled**, and Instrument and Consumer should be enabled dynamically on demand.

[1]: InnoDB uses an algorithm called next-key locking to fix phantom row. See more [17.7.4 Phantom Rows](https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html).
[2]: See blog [mvcc（多版本并发控制）原理的理解](https://blog.csdn.net/jerry11112/article/details/125894758?fromshare=blogdetail&sharetype=blogdetail&sharerId=125894758&sharerefer=PC&sharesource=qq_43321767&sharefrom=from_link).
[3]: See more [29.6 Performance Schema Instrument Naming Conventions](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-instrument-naming.html).
[4]: See more [29.12.1 Performance Schema Table Reference](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-table-reference.html).
[5]: See more [Chapter 30 MySQL sys Schema](https://dev.mysql.com/doc/refman/8.4/en/sys-schema.html).
