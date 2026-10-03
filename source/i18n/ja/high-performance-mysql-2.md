---
title: High Performance MySQL 2
category: Tech
tag: MySQL
date: 2025-04-12T00:09:53+08:00
---


# HighPerformanceMySQL-2
> 深く理解してから変更を加えよ。
> 
> MySQLの公式ドキュメントは[MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)を参照。

## Part 4 OS/ハードウェア最適化
> バレル効果はMySQLにも当てはまる。MySQLのパフォーマンスはシステム全体で最も弱いノードによって制限される。ディスク使用率、空きメモリ、CPU使用率、ネットワーク、接続されたコンポーネント——これらすべての要素がMySQLのパフォーマンスを阻害する可能性がある。

MySQLには主に2つの目標がある：
1. 低遅延（高速な応答）
2. 高スループット（できるだけ多くのジョブを実行）

### 4.1 CPU
CPU使用率を確認することで、ワークロードがCPU制限かどうかを判断できるが、CPU負荷全体だけを見てはいけない。より重要なのは、CPU使用率とI/Oが**バランス**しているか、そして各CPUコアの負荷が**均等**かどうかである。
*現代の強力なCPU処理のおかげで、一般的にCPUがMySQLのパフォーマンスの制限になることはない。*

### 4.2 メモリ/ディスク
> SSDを使えばパフォーマンス問題の99%は解決できる。

メモリはディスクI/Oよりもはるかに高速に取得できるため、利用可能なメモリを最大化してディスクI/Oを回避すべきである。
しかし最終的に、データの永続化のためにメモリ内のデータはディスクにフラッシュされなければならない。実際、メインメモリのキャッシュは2つの点で役立つ：
1. 複数の書き込み操作を1回のフラッシュにまとめる。
    ```mysql
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 1;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 1;

    # -- merge into -->
    # name = 'WANG ER'
    ```
2. 複数のI/Oを1回のディスク操作にまとめる。
    ```mysql
    # assume data in the same page frame
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 2;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 3;

    # When update one of the page frame, update all the content that needs to be changed at once. 
    # Convert random I/O to sequential I/O so that it can be flushed to disk more optimally
    ```
その結果、多くのトランザクションシステムでは**ライトアヘッドロギング**戦略を採用している：メモリ内の更新を許可し、変更をシーケンシャルなログファイルに書き込み、変更のディスクへのフラッシュを遅延させる。

### 4.3 ネットワーク
1. パケットロス：一般的なネットワークパフォーマンス問題であり、ネットワークプロトコルのタイムアウト再送ポリシーが大幅なパフォーマンス低下を引き起こす可能性がある。
2. DNS解決の例外：すべてのサーバーに`skip_name_resolve`を設定することを推奨。
3. 接続制限：`ip_local_port_range`/`tcp_max_syn_backlog`/`tcp_fin_timeout`を調整する
    ```bash
    echo 1024 65535 > /proc/sys/net/ipv4/ip_local_port_range
    echo 4096 > /proc/sys/net/ipv4/tcp_max_syn_backlog
    echo <value> > /proc/sys/net/ipv4/tcp_fin_timeout
    ```

### 4.4 ファイルシステム
ほとんど何もない。`XFS`ファイルシステムの使用を推奨する。

### 4.5 その他
- `/sys/block/sda/queue/scheduler`の設定を推奨：`noop`/`deadline`
- `/proc/sys/vm/swappiness`の設定を推奨：0
    ```bash
    echo 0 > /proc/sys/vm/swappiness
    ```

## Part 5 サーバー設定の最適化
> **使用率で最適化するな！！！**<sup>[1]</sup>
> 「チューニング」のためのチューニングスクリプトを使うな、時間の無駄だ。

### 5.1 最小構成
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
上記は最小限のMySQL設定であり、少なく見えるがほとんどの人が必要とする以上のものである。その他のニーズについては、必要に応じて設定を追加できる。

### 5.2 メモリの設定
メモリ使用量には主に4つの側面がある：
- 各接続のメモリ：接続数が不明なため、メモリ使用量を把握するのは難しい
- OSのメモリ
- InnoDBキャッシュのメモリ（`innodb_buffer_pool_size`）：InnoDBキャッシュはインデックス、行データ、ハッシュインデックス、ロック、その他の内部構造を格納する。またInnoDBキャッシュは書き込み遅延も行う。**サーバーが'--innodb-dedicated-server'で起動された場合、InnoDBは自動的に値を計算して設定する**。
- スレッドキャッシュのメモリ（`thread_cache_size`）：スレッドキャッシュは接続に紐づいていないスレッドを格納する。新しい接続を作成する必要があるとき、MySQLはスレッドキャッシュからスレッドを取得し、このスレッドを新しい接続に提供する。これにより、スレッドキャッシュにスレッドがなくなるまでMySQLは高速に応答できる。

### 5.3 I/Oの設定
InnoDBキャッシュのブロックとファイルは以下の通り：
![Innodb_cache_files](https://i.postimg.cc/y880mkmr/Innodb-cache-files.png)
- トランザクションログ（`innodb_log_file_size`）
- ログキャッシュ（`innodb_log_buffer_size`）：データを更新した後、InnoDBは操作をログキャッシュに記録する。キャッシュが満杯になったとき、トランザクションがコミットされたとき、または毎秒、InnoDBはログをディスクにフラッシュする。
- フラッシュ方法（`innodb_flush_log_at_trx_commit`/`sync_binlog`）：デフォルトおよび推奨設定は**1**
- テーブルスペース：`innodb_file_per_table`の使用を推奨。これにより各テーブルが単一のファイルを使用できる。

### 5.4 並行性の設定
並行性の問題に直面した場合、最善の選択はデータシャーディングであり、シャーディングできない場合は`innodb_thread_concurrency`を検討する<sup>[2]</sup>。

### 5.5 セキュリティの設定
- `max_connect_errors`：この値は適切に増やすことができる。`skip_name_resolve`が'ON'の場合、`max_connect_errors`は無効になる。
- `max_connections`：この値は十分に大きく設定すべきである。
- `skip_name_resolve`：この設定を有効にすることを推奨。
- `read_only/super_read_only`：この設定を有効にすることを推奨。

### 5.6 高度な設定
- `innodb_autoinc_lock_mode`：このオプションはInnoDBが自動インクリメント主キー値を生成する方法を制御する。例えば、高い並行挿入がある場合にボトルネックになることがある<sup>[3]</sup>。
- `innodb_buffer_pool_instances`：キャッシュプールを複数のセグメントに分割する。
- `innodb_read_io_threads/innodb_write_io_threads`：ディスク数に応じて値を設定する。
- `innodb_old_blocks_time`：デフォルトは0。1000（1秒）などの小さな値に設定すると非常に有用である。

[1]: 詳細はC.Millsap、J.Holt著*Optimizing Oracle Performance*を参照。
[2]: 詳細は[17.8.4 Configuring Thread Concurrency for InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-thread_concurrency.html)を参照。
[3]: 詳細は[InnoDB AUTO_INCREMENT Lock Modes](https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html#innodb-auto-increment-lock-modes)を参照。