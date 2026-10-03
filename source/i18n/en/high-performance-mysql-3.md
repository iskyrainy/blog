---
title: High Performance MySQL 3
category: Tech
tag: MySQL
date: 2025-05-08T00:01:29+08:00
---


# HighPerformanceMySQL-3
> Change thing after you understand it deeply.
> 
> MySQL offical doc see [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html).

## Part 6 Design and manage schema
### 6.1 Choose better data type
Please follow those rules below:
- small is better: Small data types typically run faster and take up less cache/memory/disk and require less CPU time to process. But make sure don't lose accuracy and spills. 
- simple is better: Simple data types require less CPU time to process. As `int` is better than `varchar`, `timestamp` is better than `datetime/date`, `datetime/date` is better than `varchar`.
- avoid default `NULL`: Columns that store `NULL` are more difficult to optimize for MySQL, `NULL` makes indexes, index statistics and values more complex, and columns that can be `NULL` take up more storage space (somewhat counter-intuitive).
- enum replace str: For those fields which only have several default values, use `enum` is a better choice. MySQL `enum` store as whole number and string. Default MySQL sort `enum` not by its string value but by its whole number value, and can specify explicitly sort rule by `FIELD()`.
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

Types info:
1. whole number(整形): `tinyint(8bit)`, `smallint(16bit)`, `mediumint(24bit)`, `int(32bit)`, `bigint(64bit)`. And can set `unsigned` to enlarge scope, they have same storage and performance.
2. real number(浮点数): `float`, `double`, `decimal`. `float` and `double` use the standard floating-point calculations of the OS. For data that needs to be accurately calculated, use `decimal` for storage.
3. string(字符串): `varchar`, `char`, `binary`, `varbinary`. MySQL implement them differently in each engine. 
   - `varchar`: use less storage than `char`. `varchar` only use necessary space. `varchar` need extra 1 or 2 Byte to store length of string. **But the best strategy is to allocate only the space that is really needed.**
   - `char`: suitable for storing very short strings, or for all values that are nearly the same length situation. For those data which wont change any more, `char` is better than `varchar` on performance.
   - `binary`/`varbinary`: store as binary byte, have better performance.
4. blob/text(大数据): MySQL wont store whole blob/text into index, also cant sort them by indexs.
   - blob: `tinyblob`, `smallblob(blob)`, `mediumblob`, `longblob`. Store binary byte, no encoding or sort rule.
   - text: `tinytext`, `smalltext(text)`, `mediumtext`, `longtext`. Store string with encoding and sort rule.
5. date/time(时间): `datetime`, `timestamp`.
   - `datetime`: 8 bytes. Scope is from 1000 CE to 9999 CE, precision is microsecond, stand out of timezone, can be sort.
   - `timestamp`: 4 bytes. Scope is from 1970.1.1 CE to 2038.1.19 CE, default not null, when insert or update without value, MySQL set a now time value.
6. bit(位): `bit`, `set`.
   - `bit`: max length is 64b, processed by MySQL as string type(ASCII), so try to avoid using `bit` type. MySQL store `bit` data as the most closest whole number type(1-8b->tinyint). 
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
   - `set`: collection of several true/false values.
7. json: test not better than normal sql fields in both performance and storage.

Another point we need to care about is choose the suitable type as identifier(Primary key or part of primary key, usually as connection fields join with other tables). **Most of situtations, whole number is the best choice.** Whole number have the good performance and can be auto increased(*be care of the overflow of whole number*). Dont chooce `enum` or `set` as identifier. Avoid use string type as identifier if possible because string type take more storage and process slowly compare to whole number, be careful about some randomly string generate algorithm(UUID etc.): Random value cause random index situtation, make `INSERT` and `SELECT` slowly. When use `UUID` as identifier, remeber remove `-`, better is, use the `UNHEX()` function to convert the UUID value to a 16-byte number and store it in one
BINARY(16) COLUMN. Values can be retrieved in hexadecimal format using the `HEX()` function.

Some special data such as: IPv4, MySQL offer `INET_ATON()` and `INET_NTOA()` to exchange value between IP and unsigned whole number, make storage from 16 bytes to 32 bits.

### 6.2 Traps of schema
1. too many fields: MySQL cache data in rows, and then server decode cache to columns. So more columns take more cost.
2. too many join: Proper redundancy design is reasonable.
3. over using `enum`

## Part 7 High performance index
### 7.1 Index
Indexing is implemented at the storage engine layer, not the server layer.
1. `b-tree index`<sup>[1]</sup>: InnoDB uses a B+ tree<sup>[2]</sup>. B-tree indexes are suitable for full-key-value and key-value ranges or key prefix lookup. Where the key prefix lookup is only available for lookups based on the leftmost prefix. 
   - full key value(全值匹配): Matches all columns in the index.
   - match the leftmost prefix(最左前缀): index(field1, field2, ...), vaild conditions for field1 or (field1, field2) or (field1, field2, ...).
   - match column prefix(列前缀): only match the beginning of the value of a column.
   - match scope values(范围值)
   - match the leftmost prefix and match column prefix: index(field1, field2, ...), vaild conditions for (field1, beginning of field2).
2. `hash index`: better performance in `=` or `<>`, worse in scope query<sup>[3]</sup>.
Adaptive hash indexing：*When InnoDB finds that certain index values are being accessed very frequently, it will be in the original On top of the B-tree index, a hash index is built in memory. This makes the B-tree index also It has some advantages of hash indexing*.

### 7.2 High performance index strategy
- prefix index: to lower storage cost, the prefix index stores only a partial prefix for a field. The ratio(selectivity<sup>[4]</sup>) of the distinct index values to the total number of records in the data table indicates the performance of the prefix index. When the ratio is 1, the indexing performance of the prefix index is the same as that of the unique index and only needs to process shorter characters.
- multi-column index: use multi-column indexes replace index-merge. Usually put high selectivity field in the front place of multi-column indexes is a good choice.
- clustered index: It's not a separate index type, it's a way to **store data**. Innodb only clustering data by primary key(or invisible indexes<sup>[5]</sup>). 
- covering index: If an index contains the values of all the fields that need to be queried, we call it a covering index. It is important to note that only B-tree indexes can be used to cover indexes.

Avoid design repeat index, as 
- (A, B) and (A)
- (A, ID): secondary index contains primary key, so ID is useless.

Delete indexes which never used. In `sys`, it is very simple to know which indexes have never been used in the `table_io_waits_summary_by_index_usage` view.

## Part 8 Optimize query performance
### 8.1 Why SQL run slowly
If thinking of a query as a task, it consists of a series of subtasks, each of which consumes a certain amount of time. If you want to optimize a query, you actually want to optimize its sub tasks, either eliminate some of them, reduce the number of times the sub tasks are executed, or make the sub tasks run faster.

### 8.2 Optimize data access
1. maybe query some data but dont need:
   - reasonable use of `limit`
   - dont use `select *`
   - avoid execute same sql in short time, set result to cache
2. maybe MySQL scan extra record: **consider response time, scan row count and result row count**.
   - try to use covering index to scan
   - alter table struct
   - rewrite complex SQL

### 8.3 Rewrite SQL
For a slow and complex SQL, maybe spilt it to several small SQL task can bring better performance. Complex SQL make long transaction, cost most of server resources and lock lots of rows or tables. Simple SQL is the opposite, and for those be executed repeatedly, their results can be set into cache.

### 8.4 Base of execution
After send a query request to MySQL:
1. custom client send SQL;
2. server parse, pre-handle, optimize SQL;
3. MySQL call engine API to execute optimized SQL;
4. return result to client.
![MySQL workflow](https://i.postimg.cc/Kjp75GZD/My-SQL-workflow.png)

MySQL optimizer:
MySQL optimizer strategy can be divided into two types: static strategy and dynamic strategy. Static strategy like 'complie-time optimize', do once and run always. Dynamic strategy like 'runtime optimize', every execution maybe different.

Some optimize as:
- redefine tables join order
- transfer outer join to inner join
- equivalent substitution: remove some of the judgments that are always true and some that are not true, and replace judgments which can be mark as a constant number
- optimize `COUNT()`, `MIN()`, `MAX()` by index and field default value
...

> Don't easily presume self smarter than an optimizer.😂

**Join in MySQL**:
For any `join`, MySQL query rows from first table, then match rows in second table, one by one until all tables are checked, return colnums specified in SQL.
MySQL join optimizer can reorder join sequence for better performance, optimizer evaluates the performance of each connection order and decides which connection method to take. When the table to be joined exceeds the `optimizer_search_depth`, optimizer will reorder join sequence by greedy algorithms.

### 8.5 Limitations of the optimizer
1. `UNION` limitation: Sometimes MySQL cannot infer conditions from outside into inside. like: `(SELECT ...) UNION (SELECT ...) LIMIT 20;` MySQL will put all of two SQL results into a temp table then select 20 rows. Better is feat SQL to `(SELECT ... LIMIT 20) UNION (SELECT ... LIMIT 20) LIMIT 20;` and now temp table will just have 40 rows.
2. equivalence passing: When passing a big list of `IN` condition, execution speed will be slower.

### 8.6 Optimize specific SQL
1. `COUNT()` SQL: Use `COUNT(*)` to count rows. Replace `SUM(IF(..., 1, 0))` by `COUNT(... or NULL)`.
2. `JOIN` SQL: Make sure SQL can use indexs.
3. `LIMIT/OFFSET` SQL: Use index overwriting scans whenever possible. Then join once as needed and then return the result columns. like `SELECT id, name FROM user ORDER BY age LIMIT 10000, 5;` -> `SELECT id, name FROM user INNER JOIN (SELECT id FROM user ORDER BY age LIMIT 10000, 5) AS t ON user.id = t.id;`. Or change `LIMIT` to `BETWEEN ... AND ...` so SQL can use scope scan of indexs. Or record the last query row number, like `SELECT ... FROM t ORDER BY id DESC LIMIT 20;` -> `SELECT ... FROM t WHERE id < ... ORDER BY id DESC LIMIT 20;`.
4. `UNION` SQL: Manually "push down" clauses such as `WHERE`, `LIMIT`, `ORDER BY`, etc., into the various subqueries of UNION so that the optimizer can make full use of these conditions for optimization. Unless really need the server to deduplicate rows, it's important to use `UNION ALL`.


[1]: See more *Relational Database Index Design and the Optimizers*.
[2]: See more [B树、B+树详解](https://www.cnblogs.com/lianzhilei/p/11250589.html).
[3]: See more [10.3.9 Comparison of B-Tree and Hash Indexes](https://dev.mysql.com/doc/refman/8.4/en/index-btree-hash.html).
[4]: See more [selectivity](https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_selectivity).
[5]: See more [10.3.12 Invisible Indexes](https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html).