---
title: High Performance MySQL 1
category: Tech
tag: MySQL
date: 2025-03-31T22:36:40+08:00
---

# HighPerformanceMySQL-1
> 深く理解してから物事を変えよ。
>
> MySQL公式ドキュメントは[MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)を参照。

## Part 1 MySQLアーキテクチャ
### 1.1 MySQL論理レイヤー
MySQLサーバーは3つのレイヤーを持つ：
1. 接続/スレッド制御レイヤー；
2. クエリレイヤー：クエリのパース、分析、最適化；組み込み関数；ストアドプロシージャ；トリガー；ビュー；
3. エンジンレイヤー；

### 1.2 同時実行制御
- 読み書きロック；
- ロック粒度：
    - テーブルロック：コスト低、同時実行性低；
    - 行ロック：コスト高、同時実行性高、エンジンレイヤーで実装；

### 1.3 トランザクション
ACID：原子性、一貫性、分離性、永続性。

分離レベル：
| LEVEL | ダーティリード | 非再現リード | ファントムロウ | ロック読み取り |
| :- | :-: | :-: | :-: | :-: |
| READ UNCOMMITTED | YES | YES | YES | NO |
| READ COMMITTED | NO | YES | YES | NO |
| REPEATABLE READ | NO | NO | YES | NO |
| SERIALIZABLE | NO | NO | NO | YES |

MySQLのデフォルトレベルは`REPEATABLE READ`。RC分離レベルでは、各スナップショット読み取りが最新のRead Viewを生成して取得する；RR分離レベルでは、同一トランザクション内の最初のスナップショット読み取りがRead Viewを作成し、後続のスナップショット読み取りは同じRead Viewを取得する。

デッドロック：InnoDBエンジンは行ロックが最も少ないトランザクションをロールバックする。

二相ロックプロトコル：トランザクションは任意の実行時にロックを取得できるが、コミットまたはロールバック後にのみロックを解放する。

### 1.4 MVCC
MVCCにより、RR/RCレベルではトランザクションがどれだけ長く実行されても、いつでも同じビューを見ることができる。

MVCCが必要な理由：
- 読み取り-読み取り：安全；
- 読み取り-書き込み：不安全、ダーティリード/非再現リード/ファントムロウ<sup>[1]</sup>を引き起こす可能性がある；
- 書き込み-書き込み：不安全、更新ロストを引き起こす可能性がある；

MVCCは**ロックフリー**の同時実行制御により読み取り-書き込み競合を解決できる。

1. 暗黙フィールド：カスタムフィールドに加えて、各レコード行にはデータベースが暗黙的に定義するフィールドもある。例えばDB_TRX_ID、DB_ROLL_PTR、DB_ROW_ID。
    - DB_TRX_ID：6バイト、このレコードを作成/最後に変更したトランザクションIDを記録
    - DB_ROLL_PTR：7バイト、ロールバックポインタ、このレコードの前のバージョンを指す
    - DB_ROW_ID：6バイト、不可視の主キー
2. undo log：
    - insert undo log：トランザクションが新しいレコードを挿入するときに生成されるundo logで、トランザクションのロールバック時のみ必要であり、トランザクションのコミット後すぐに破棄できる
    - update undo log：トランザクションが更新または削除するときに生成されるundo log；高速読み取りまたはトランザクションロールバックがそのログに関与しない場合にのみ、対応するログが`purge`スレッドによってクリアされる

3. read view<sup>[2]</sup>：トランザクションがスナップショット読み取りを実行するとき、MySQLは関連する行データに対してread viewを生成する。このトランザクションにどのバージョンのデータが見えるかを確認するために使用され、トランザクション全体を通じてすべての読み取り操作が一貫していることを保証する。

### 1.5 重複
詳細は[Part 9](#part-9)を参照。

### 1.6 データファイル構造
- InnoDB：
    - テーブルスペースファイル（`.ibd`）：InnoDBはテーブルスペースファイルを使用してデータとインデックスを格納する
    - システムテーブルスペース（`ibdata1`）：InnoDBデータディクショナリ、undo log、システムトランザクション情報などを含む
- ログ：
    - バイナリログ：レプリケーションとデータリカバリのためにデータベース内容を変更するすべてのステートメントを記録
    - redo log：InnoDB固有、データページへの変更を記録、クラッシュリカバリに使用
    - undo log：InnoDB固有、トランザクションのロールバックとMVCCに使用
    - スロークエリログ：タイムアウトしたSQLを記録
    - エラーログ：起動、実行、停止中に発生した例外を記録
- 設定：
    - my.ini：MySQLのグローバル設定を記録
- その他：
    - PIDファイル（`.pid`）：MySQLプロセスのPIDを記録
    - ソケットファイル：Unix/Linuxでのローカル接続ソケットファイル

## Part 2 信頼性の高いモニタリング
### 2.1 可用性
> コンポーネントの障害は避けられないことを理解し受け入れた上で、可能な限り最善のサービスを提供する。

優先される方法は、`SELECT 1`のようにリモートでアクセスして実行すること。要件に応じて、より複雑な可用性検証も可能。

### 2.2 クエリ遅延
**スロークエリログ**に特に注意し、Druidなどの一部のデータソース接続コンポーネントはスロークエリ追跡を提供する。

### 2.3 エラー分析
- `lock wait timeout`：行レベルロックの競合が増加し、トランザクションが絶えず再試行しても失敗し続けている可能性がある
- `aborted connections`：クライアントとデータベース間のアクセスに問題がある可能性がある
- `too many connections`：クライアントがデータベースにアクセスするためにコネクションプールを使用する必要があるか、`max_connections`を更新する必要がある可能性がある；`thread_connected`の値よりも比率（`thread_connected/max_connections`）に注目する方が良い

### 2.4 重要なモニタリング項目
1. ディスク使用量
2. 接続数
3. レプリケーション遅延
4. I/O使用量
5. 自動インクリメントキースペース：詳細は[Part 6](https://gdhvxcj.cn/blog/2025/05/08/HighPerformanceMySQL-3#part-6-design-and-manage-schema)を参照
6. バックアップ

### 2.5 推奨事項
1. 平均値ではなく常にピーク値に注目する
2. パーセンタイルデータはサービスの品質をより良く反映できる
3. データは可能な限り長く保持する

## Part 3 Performance Schema
Performance Schemaは2つの部分を含む：instrumentとcomsumer。

### 3.1 Instrument
instrument名は'/'文字で区切られた一連の要素で構成される<sup>[3]</sup>。
MySQLはすべてのinstrumentを`setup_instruments`に格納する。
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
監視情報を格納するためのテーブル<sup>[4]</sup>。
- `*_current`：サーバーで現在進行中のイベント
- `*_history`：各スレッドの直近10件の完了したイベント；設定可能
- `*_history_long`：グローバルから、各スレッドの直近10000件の完了したイベント；設定可能
- `event_waits_*`：イベント待機情報
- `events_statements_*`：SQLクエリ情報
- `events_stages_*`：SQLステージ情報、例えば`sending data`など
- `event_transactions_*`：トランザクション情報
- `*_summary_by_*`：情報サマリーテーブル
- `*_instances`：オブジェクトインスタンステーブル
- `setup_*`：ランタイム設定

### 3.3 Performance Schemaの使用
1. 履歴イベントの収集をクエリを実行するユーザーに限定する
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
2. statementおよびstageのinstrumentationが有効になっていることを確認する
3. `events_statements_*`および`events_stages_*`のconsumerが有効になっていることを確認する
4. プロファイリングしたいステートメントを実行する
    ```mysql
    mysql> SELECT * FROM employees.employees WHERE emp_no = 10001;
    +--------+------------+------------+-----------+--------+------------+
    | emp_no | birth_date | first_name | last_name | gender | hire_date |
    +--------+------------+------------+-----------+--------+------------+
    |  10001 | 1953-09-02 | Georgi     | Facello   | M      | 1986-06-26 |
    +--------+------------+------------+-----------+--------+------------+
    ```
5. `events_statements_history_long`テーブルをクエリして、ステートメントの`EVENT_ID`を取得する
    ```mysql
    mysql> SELECT EVENT_ID, TRUNCATE(TIMER_WAIT/1000000000000,6) as Duration, SQL_TEXT
        FROM performance_schema.events_statements_history_long WHERE SQL_TEXT like '%10001%';
    +----------+----------+--------------------------------------------------------+
    | event_id | duration | sql_text                                               |
    +----------+----------+--------------------------------------------------------+
    |       31 | 0.028310 | SELECT * FROM employees.employees WHERE emp_no = 10001 |
    +----------+----------+--------------------------------------------------------+
    ```
6. `events_stages_history_long`テーブルをクエリして、ステートメントのステージイベントを取得する
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
7. その他に実行したいプロファイリング

### 3.4 sys Schema
Performance Schemaをベースにしたビューとストレージコンポーネントで、Performance Schemaの体験をよりスムーズにするために設計されている<sup>[5]</sup>。それ自体は**いかなるデータも格納しない**。望むデータが見つからない場合は、Performance Schemaのベーステーブルを検索すること。

### 3.5 推奨事項
Performance Schemaは**有効化**すべきであり、InstrumentとConsumerは必要に応じて動的に有効化すべきである。

[1]: InnoDBはファントムロウを解決するためにnext-key lockingと呼ばれるアルゴリズムを使用する。詳細は[17.7.4 Phantom Rows](https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html)を参照。
[2]: ブログ[mvcc（多版本并发控制）原理的理解](https://blog.csdn.net/jerry11112/article/details/125894758?fromshare=blogdetail&sharetype=blogdetail&sharerId=125894758&sharerefer=PC&sharesource=qq_43321767&sharefrom=from_link)を参照。
[3]: 詳細は[29.6 Performance Schema Instrument Naming Conventions](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-instrument-naming.html)を参照。
[4]: 詳細は[29.12.1 Performance Schema Table Reference](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-table-reference.html)を参照。
[5]: 詳細は[Chapter 30 MySQL sys Schema](https://dev.mysql.com/doc/refman/8.4/en/sys-schema.html)を参照。