---
title: 高性能 MySQL 3
category: Tech
tag: MySQL
date: 2025-05-08T00:01:29+08:00
---


# HighPerformanceMySQL-3
> 深入理解之后再改变它。
> 
> MySQL 官方文档见 [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)。

## 第 6 部分 设计和管理 schema
### 6.1 选择更好的数据类型
请遵循以下规则：
- 越小越好：小的数据类型通常运行更快，占用更少的缓存/内存/磁盘，并且处理时需要的 CPU 时间更少。但要确保不丢失精度并且不溢出。
- 越简单越好：简单的数据类型处理时需要的 CPU 时间更少。比如 `int` 比 `varchar` 好，`timestamp` 比 `datetime/date` 好，`datetime/date` 比 `varchar` 好。
- 避免默认的 `NULL`：存储 `NULL` 的列对 MySQL 来说更难优化，`NULL` 会使索引、索引统计信息和值变得更复杂，而且可以为 `NULL` 的列会占用更多的存储空间（这有点反直觉）。
- 用 enum 替换字符串：对于那些只有几个固定值的字段，使用 `enum` 是更好的选择。MySQL 的 `enum` 以整数和字符串的形式存储。默认情况下 MySQL 对 `enum` 的排序不是按其字符串值，而是按其整数值，并且可以通过 `FIELD()` 显式指定排序规则。
   ```mysql
   mysql> CREATE TABLE enum_test (
      -> e ENUM('fish', 'apple', 'dog') NOT NULL  
      -> );
   mysql> INSERT INTO enum_test(e) VALUES('fish'), ('dog'), ('apple');
   mysql> SELECT e + 0, e FROM enum_test;
   +-------+-------+
   | e + 0 |     e |
   +-------+-------+
   |     1 |  fish |
   |     3 |   dog |
   |     2 | apple |
   +-------+-------+
   ```

类型信息：
1. 整数（整形）：`tinyint(8bit)`、`smallint(16bit)`、`mediumint(24bit)`、`int(32bit)`、`bigint(64bit)`。并且可以设置 `unsigned` 来扩大范围，它们具有相同的存储和性能。
2. 实数（浮点数）：`float`、`double`、`decimal`。`float` 和 `double` 使用操作系统的标准浮点计算。对于需要精确计算的数据，使用 `decimal` 来存储。
3. 字符串（字符串）：`varchar`、`char`、`binary`、`varbinary`。MySQL 在各引擎中对它们的实现方式不同。
   - `varchar`：比 `char` 占用更少的存储空间。`varchar` 只使用必要的空间。`varchar` 需要额外的 1 或 2 字节来存储字符串的长度。**但最佳策略是只分配真正需要的空间。**
   - `char`：适合存储非常短的字符串，或者所有值长度几乎相同的情况。对于那些不会再改变的数据，`char` 在性能上比 `varchar` 更好。
   - `binary`/`varbinary`：以二进制字节存储，具有更好的性能。
4. blob/text（大数据）：MySQL 不会将整个 blob/text 存入索引，也无法通过索引对它们排序。
   - blob：`tinyblob`、`smallblob(blob)`、`mediumblob`、`longblob`。存储二进制字节，没有编码或排序规则。
   - text：`tinytext`、`smalltext(text)`、`mediumtext`、`longtext`。存储带编码和排序规则的字符串。
5. date/time（时间）：`datetime`、`timestamp`。
   - `datetime`：8 字节。范围从公元 1000 年到公元 9999 年，精度为微秒，与时区无关，可以排序。
   - `timestamp`：4 字节。范围从公元 1970.1.1 到公元 2038.1.19，默认不为 null，当插入或更新时没有提供值，MySQL 会设置一个当前时间值。
6. bit（位）：`bit`、`set`。
   - `bit`：最大长度为 64b，MySQL 将其作为字符串类型（ASCII）处理，所以尽量避免使用 `bit` 类型。MySQL 将 `bit` 数据存储为最接近的整数类型（1-8b->tinyint）。
   ```mysql
   mysql> CREATE TABLE bit_test(a bit(8));
   mysql> INSERT INTO bit_test VALUES(b'00111001');
   mysql> SELECT a, a + 0 FROM bit_test;
   +------+-------+
   | a    | a + 0 |
   +------+-------+
   | 9    |    57 |
   +------+-------+
   ```
   - `set`：若干真/假值的集合。
7. json：在性能和存储方面都不比普通的 sql 字段更好。

我们还需要关注的另一点是选择合适的数据类型作为标识符（主键或主键的一部分，通常作为与其他表连接的关联字段）。**在大多数情况下，整数是最好的选择。** 整数具有良好的性能且可以自动递增（*注意整数的溢出*）。不要选择 `enum` 或 `set` 作为标识符。尽可能避免使用字符串类型作为标识符，因为与整数相比，字符串类型占用更多存储空间并且处理更慢，要注意一些随机字符串生成算法（UUID 等）：随机值会导致随机索引情况，使 `INSERT` 和 `SELECT` 变慢。当使用 `UUID` 作为标识符时，记得去掉 `-`，更好的做法是使用 `UNHEX()` 函数将 UUID 值转换为 16 字节的数，并将其存储在一个
BINARY(16) 列中。可以使用 `HEX()` 函数以十六进制格式检索这些值。

对于一些特殊数据，例如：IPv4，MySQL 提供了 `INET_ATON()` 和 `INET_NTOA()` 在 IP 与无符号整数之间转换值，使存储从 16 字节变为 32 位。

### 6.2 schema 的陷阱
1. 字段过多：MySQL 以行的形式缓存数据，然后服务器将缓存解码为列。所以更多的列会带来更大的开销。
2. 连接过多：适当的冗余设计是合理的。
3. 过度使用 `enum`

## 第 7 部分 高性能索引
### 7.1 索引
索引是在存储引擎层实现的，而不是在服务器层。
1. `b-tree 索引`<sup>[1]</sup>：InnoDB 使用 B+ 树<sup>[2]</sup>。B-tree 索引适合全键值和键值范围或键前缀查找。其中键前缀查找仅适用于基于最左前缀的查找。
   - 全值匹配（全值匹配）：匹配索引中的所有列。
   - 匹配最左前缀（最左前缀）：索引（field1, field2, ...），对 field1 或（field1, field2）或（field1, field2, ...）有效。
   - 匹配列前缀（列前缀）：只匹配某列值的开头部分。
   - 匹配范围值（范围值）
   - 匹配最左前缀并匹配列前缀：索引（field1, field2, ...），对（field1, field2 的开头部分）有效。
2. `hash 索引`：在 `=` 或 `<>` 中性能更好，在范围查询中性能更差<sup>[3]</sup>。
自适应哈希索引：*当 InnoDB 发现某些索引值被非常频繁地访问时，它会在原有的 B-tree 索引之上，在内存中构建一个哈希索引。这使得 B-tree 索引也具备了哈希索引的一些优点*。

### 7.2 高性能索引策略
- 前缀索引：为了降低存储成本，前缀索引只存储字段的部分前缀。不同索引值与数据表总记录数的比值（选择性<sup>[4]</sup>）表示前缀索引的性能。当比值为 1 时，前缀索引的索引性能与唯一索引相同，且只需处理更短的字符。
- 多列索引：使用多列索引替代索引合并。通常将高选择性的字段放在多列索引的前面是一个好选择。
- 聚簇索引：它不是一种单独的索引类型，而是一种**存储数据**的方式。InnoDB 仅按主键（或不可见索引<sup>[5]</sup>）聚簇数据。
- 覆盖索引：如果一个索引包含需要查询的所有字段的值，我们称之为覆盖索引。需要注意的是，只有 B-tree 索引才能用于覆盖索引。

避免设计重复索引，例如
- (A, B) 和 (A)
- (A, ID)：二级索引包含主键，所以 ID 是无用的。

删除从未使用过的索引。在 `sys` 中，通过 `table_io_waits_summary_by_index_usage` 视图可以非常简单地知道哪些索引从未被使用过。

## 第 8 部分 优化查询性能
### 8.1 为什么 SQL 运行缓慢
如果把一个查询看作一个任务，它由一系列子任务组成，每个子任务都消耗一定的时间。如果你想优化一个查询，实际上是想优化它的子任务，要么消除一些子任务，要么减少子任务执行的次数，要么让子任务运行得更快。

### 8.2 优化数据访问
1. 可能查询了一些并不需要的数据：
   - 合理使用 `limit`
   - 不要使用 `select *`
   - 避免在短时间内执行相同的 sql，将结果放入缓存
2. 可能 MySQL 扫描了额外的记录：**考虑响应时间、扫描行数和结果行数**。
   - 尽量使用覆盖索引来扫描
   - 修改表结构
   - 重写复杂的 SQL

### 8.3 重写 SQL
对于一个缓慢而复杂的 SQL，或许将其拆分为几个小的 SQL 任务可以带来更好的性能。复杂的 SQL 会造成长事务，消耗大量服务器资源并锁定大量的行或表。简单的 SQL 则相反，而且对于那些被反复执行的 SQL，其结果可以放入缓存。

### 8.4 执行的基础
向 MySQL 发送查询请求之后：
1. 客户端发送 SQL；
2. 服务器解析、预处理、优化 SQL；
3. MySQL 调用引擎 API 执行优化后的 SQL；
4. 将结果返回给客户端。
![MySQL workflow](https://i.postimg.cc/Kjp75GZD/My-SQL-workflow.png)

MySQL 优化器：
MySQL 优化器策略可以分为两种：静态策略和动态策略。静态策略就像“编译时优化”，执行一次就永远运行。动态策略就像“运行时优化”，每次执行可能都不同。

一些优化如：
- 重新定义表的连接顺序
- 将外连接转换为内连接
- 等价替换：移除一些始终为真的判断和一些不为真的判断，并将可以标记为常数的判断替换为常量
- 通过索引和字段默认值优化 `COUNT()`、`MIN()`、`MAX()`
...

> 不要轻易认为自己比优化器更聪明。😂

**MySQL 中的连接**：
对于任何 `join`，MySQL 从第一张表读取行，然后逐行匹配第二张表中的行，直到检查完所有表，返回 SQL 中指定的列。
MySQL 连接优化器可以重新排列连接顺序以获得更好的性能，优化器评估每种连接方式的性能并决定采用哪种连接方式。当要连接的表超过 `optimizer_search_depth` 时，优化器将通过贪心算法重新排列连接顺序。

### 8.5 优化器的局限性
1. `UNION` 限制：有时 MySQL 无法将条件从外部推导到内部。例如：`(SELECT ...) UNION (SELECT ...) LIMIT 20;` MySQL 会将两个 SQL 结果全部放入一个临时表，然后选取 20 行。更好的做法是将 SQL 改为 `(SELECT ... LIMIT 20) UNION (SELECT ... LIMIT 20) LIMIT 20;`，这样临时表将只有 40 行。
2. 等价传递：当传递一个很大的 `IN` 条件列表时，执行速度会变慢。

### 8.6 优化特定的 SQL
1. `COUNT()` SQL：使用 `COUNT(*)` 来统计行数。用 `COUNT(... or NULL)` 替换 `SUM(IF(..., 1, 0))`。
2. `JOIN` SQL：确保 SQL 能够使用索引。
3. `LIMIT/OFFSET` SQL：尽可能使用索引覆盖扫描。然后按需连接一次并返回结果列。例如 `SELECT id, name FROM user ORDER BY age LIMIT 10000, 5;` -> `SELECT id, name FROM user INNER JOIN (SELECT id FROM user ORDER BY age LIMIT 10000, 5) AS t ON user.id = t.id;`。或者将 `LIMIT` 改为 `BETWEEN ... AND ...`，这样 SQL 就可以使用索引的范围扫描。或者记录上次查询的行号，例如 `SELECT ... FROM t ORDER BY id DESC LIMIT 20;` -> `SELECT ... FROM t WHERE id < ... ORDER BY id DESC LIMIT 20;`。
4. `UNION` SQL：手动将 `WHERE`、`LIMIT`、`ORDER BY` 等子句“下推”到 UNION 的各个子查询中，以便优化器可以充分利用这些条件进行优化。除非确实需要服务器对行去重，否则重要的是要使用 `UNION ALL`。


[1]: 更多内容见 *Relational Database Index Design and the Optimizers*。
[2]: 更多内容见 [B树、B+树详解](https://www.cnblogs.com/lianzhilei/p/11250589.html)。
[3]: 更多内容见 [10.3.9 Comparison of B-Tree and Hash Indexes](https://dev.mysql.com/doc/refman/8.4/en/index-btree-hash.html)。
[4]: 更多内容见 [selectivity](https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_selectivity)。
[5]: 更多内容见 [10.3.12 Invisible Indexes](https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html)。