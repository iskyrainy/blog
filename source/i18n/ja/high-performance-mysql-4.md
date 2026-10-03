---
title: High Performance MySQL 4
category: Tech
tag: MySQL
date: 2025-05-30T00:24:03+08:00
---


# HighPerformanceMySQL-4
> 深く理解してから変更を加えよ。
> 
> MySQLの公式ドキュメントは[MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)を参照。

## Part 9 レプリケーション
レプリケーションの手順、これらのステップはすべて非同期である：
1. マスターノードが操作を*bin log*に記録する
2. スレーブノードがソースノードのbin logをコピーする
3. スレーブノードがbin logを再実行する

MySQLは3つのレプリケーション方式を提供している：
- SQLベース：不確実に実行されるSQLには適用できない
- 行ベース：大量のログを引き起こす可能性がある
- 混合方式：デフォルトはSQLベース、必要な場合のみ行ベース

**GTID**：GTIDは、再起動後にレプリカサーバーが正しいログ位置からレプリケーションを継続することを保証する。マスターノードのすべてのイベントにGTIDが付与される。GTIDはそのイベントとともにbin logに書き込まれる。スレーブノードがイベントを完了すると、GTIDが完了としてマークされる。

レプリケーションの安全性のためのいくつかの設定：
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

マルチスレッドレプリケーション：
- DATABASE：各データベースはbin logをコピーするためにただ1つのスレッドを持つことができる
- LOGICAL_CLOCK：複数のスレッドを使用して同じデータベースへの並列更新を可能にする

半同期レプリケーション：マスターノードは、少なくとも1つのスレーブノードがマスターノードからイベントのbin logを正常にコピーすることを保証する

レプリケーションの切り替え：
1. どのレプリカが新しいソースになるかを決定する
2. 遅延を確認し、遅延が1秒未満であることを保証する
3. マスターノードを`super_read_only`に変更する
4. データの同期を待つ
5. スレーブノードの`read_only`を解除する
6. リクエストフローを新しいマスターノードに切り替える
7. すべてのレプリカを新しいマスターノードに向ける

レプリケーションの問題と解決策：
- マスターノードのbin logの破損：必然的に、一部のトランザクションデータが失われる
- 一時テーブルの欠落：ステートメントベースのレプリケーションと互換性がないため、行ベースのレプリケーションが必要

## Part 10 バックアップとリカバリ
> **レプリケーションはバックアップではない。**

- 論理バックアップ：MySQLからデータをダンプする
- ソースファイルバックアップ：ソースデータファイルをバックアップする