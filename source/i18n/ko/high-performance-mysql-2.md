---
title: High Performance MySQL 2
category: Tech
tag: MySQL
date: 2025-04-12T00:09:53+08:00
---


# HighPerformanceMySQL-2
> 이해한 후에 변경하라.
> 
> MySQL 공식 문서는 [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)를 참고하세요.

## Part 4 OS/하드웨어 최적화
> MySQL에도 통나무 효과(barrel effect)가 적용됩니다. MySQL의 성능은 전체 시스템에서 가장 약한 노드에 의해 제한됩니다. 디스크 사용량, 사용 가능한 메모리, CPU 사용량, 네트워크 및 연결된 구성 요소 등 모든 부분이 MySQL의 성능을 차단할 수 있습니다.

MySQL은 두 가지 주요 목표를 가지고 있습니다:
1. 낮은 지연 시간(빠른 응답)
2. 높은 처리량(가능한 한 많은 작업 수행)

### 4.1 CPU
CPU 사용량을 확인하여 워크로드가 CPU 제한인지 판단할 수 있지만, 전체 CPU 부하만 보면 안 됩니다. CPU 사용량과 I/O가 **균형**을 이루고 있는지, 각 CPU 코어의 워크로드가 **균등**한지에 더 주의를 기울여야 합니다.
*현대의 강력한 CPU 처리 덕분에 일반적으로 CPU는 MySQL 성능의 제한 요소가 되지 않습니다.*

### 4.2 메모리/디스크
> SSD를 사용하면 성능 문제의 99%를 해결할 수 있습니다.

메모리는 디스크 I/O보다 훨씬 빠르게 가져올 수 있으므로, 사용 가능한 메모리를 최대화하여 디스크 I/O를 피해야 합니다.
하지만 최종적으로 메모리의 데이터는 데이터 지속성을 위해 디스크로 플러시되어야 합니다. 사실 주 메모리의 캐시는 두 가지 방식으로도 도움이 됩니다:
1. 여러 쓰기 작업을 한 번의 플러시로 병합합니다.
    ```mysql
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 1;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 1;

    # -- merge into -->
    # name = 'WANG ER'
    ```
2. 여러 I/O를 한 번의 디스크 작업으로 병합합니다.
    ```mysql
    # assume data in the same page frame
    UPDATE t1 SET name = 'ZHANG SAN' WHERE id = 1;
    UPDATE t1 SET name = 'LI SI' WHERE id = 2;
    UPDATE t1 SET name = 'WANG ER' WHERE id = 3;

    # When update one of the page frame, update all the content that needs to be changed at once. 
    # Convert random I/O to sequential I/O so that it can be flushed to disk more optimally
    ```
결과적으로, 많은 트랜잭션 시스템은 **선행 쓰기 로깅(write-ahead logging)** 전략을 채택합니다: 메모리 내 업데이트를 허용하고, 변경 사항을 순차 로그 파일에 기록하며, 변경 사항의 디스크 플러시를 지연시킵니다.

### 4.3 네트워크
1. 패킷 손실: 일반적인 네트워크 성능 문제이며, 네트워크 프로토콜의 타임아웃 재전송 정책은 상당한 성능 저하를 초래할 수 있습니다.
2. DNS 확인 예외: 모든 서버에 `skip_name_resolve`를 설정하는 것을 권장합니다.
3. 연결 제한: `ip_local_port_range`/`tcp_max_syn_backlog`/`tcp_fin_timeout`을 수정하세요
    ```bash
    echo 1024 65535 > /proc/sys/net/ipv4/ip_local_port_range
    echo 4096 > /proc/sys/net/ipv4/tcp_max_syn_backlog
    echo <value> > /proc/sys/net/ipv4/tcp_fin_timeout
    ```

### 4.4 파일 시스템
거의 없습니다. `XFS` 파일 시스템을 사용하는 것을 권장합니다.

### 4.5 기타
- `/sys/block/sda/queue/scheduler` 설정 권장: `noop`/`deadline`
- `/proc/sys/vm/swappiness` 설정 권장: 0
    ```bash
    echo 0 > /proc/sys/vm/swappiness
    ```

## Part 5 서버 설정 최적화
> **사용률로 최적화하지 마세요!!!**<sup>[1]</sup>
> '튜닝'을 위한 튜닝 스크립트를 사용하지 마세요, 시간 낭비입니다.

### 5.1 최소 설정
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
위는 최소한의 MySQL 설정으로, 적어 보이지만 대부분의 사람들이 필요로 하는 것보다 많습니다. 다른 요구 사항이 있으면 필요에 따라 설정을 추가할 수 있습니다.

### 5.2 메모리 설정
메모리 사용에 관한 네 가지 주요 측면이 있습니다:
- 각 연결을 위한 메모리: 연결 수가 불확실하기 때문에 메모리 사용량을 파악하기 어렵습니다.
- OS를 위한 메모리
- InnoDB 캐시를 위한 메모리(`innodb_buffer_pool_size`): InnoDB 캐시는 인덱스, 행 데이터, 해시 인덱스, 잠금 및 기타 내부 구조를 저장합니다. 또한 InnoDB 캐시는 쓰기 지연을 수행합니다. **서버가 '--innodb-dedicated-server'로 시작될 때, InnoDB는 자동으로 값을 계산하고 설정합니다**.
- 스레드 캐시를 위한 메모리(`thread_cache_size`): 스레드 캐시는 연결에 바인딩되지 않은 스레드를 저장합니다. 새 연결을 생성해야 할 때, MySQL은 스레드 캐시에서 스레드를 가져와 새 연결에 제공하므로, 스레드 캐시에 스레드가 없을 때까지 MySQL이 빠르게 응답할 수 있습니다.

### 5.3 I/O 설정
InnoDB 캐시 블록과 파일은 다음과 같습니다:
![Innodb_cache_files](https://i.postimg.cc/y880mkmr/Innodb-cache-files.png)
- 트랜잭션 로그(`innodb_log_file_size`)
- 로그 캐시(`innodb_log_buffer_size`): 데이터를 업데이트한 후, InnoDB는 작업을 로그 캐시에 기록합니다. 캐시가 가득 차거나 트랜잭션이 커밋되거나 매초마다, InnoDB는 로그를 디스크로 플러시합니다.
- 플러시 방법(`innodb_flush_log_at_trx_commit`/`sync_binlog`): 기본값이며 이 값을 **1**로 설정하는 것을 권장합니다.
- 테이블 스페이스: `innodb_file_per_table` 사용을 권장하며, 이를 통해 모든 테이블이 단일 파일을 사용할 수 있습니다.

### 5.4 동시성 설정
동시성 문제에 직면했을 때, 최선의 선택은 데이터 샤딩이며, 샤딩할 수 없다면 `innodb_thread_concurrency`<sup>[2]</sup>를 고려하세요.

### 5.5 보안 설정
- `max_connect_errors`: 이 값은 적절히 증가시킬 수 있습니다. `skip_name_resolve`가 'ON'이면 `max_connect_errors`는 무효입니다.
- `max_connections`: 이 값을 충분히 크게 설정해야 합니다.
- `skip_name_resolve`: 이 설정을 활성화하는 것을 권장합니다.
- `read_only/super_read_only`: 이 설정을 활성화하는 것을 권장합니다.

### 5.6 고급 설정
- `innodb_autoinc_lock_mode`: 이 옵션은 InnoDB가 자동 증가 기본 키 값을 생성하는 방식을 제어합니다. 예를 들어 동시 삽입이 많은 경우 병목 현상이 발생할 수 있습니다<sup>[3]</sup>.
- `innodb_buffer_pool_instances`: 캐시 풀을 여러 세그먼트로 분할합니다.
- `innodb_read_io_threads/innodb_write_io_threads`: 디스크 수에 따라 값을 설정하세요. 
- `innodb_old_blocks_time`: 기본값 0. 작은 값, 예를 들어 1000(1초)으로 설정하는 것이 매우 유용합니다.

[1]: 자세한 내용은 C.Millsap, J.Holt의 *Optimizing Oracle Performance*를 참조하세요.
[2]: 자세한 내용은 [17.8.4 Configuring Thread Concurrency for InnoDB](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-thread_concurrency.html)를 참조하세요.
[3]: 자세한 내용은 [InnoDB AUTO_INCREMENT Lock Modes](https://dev.mysql.com/doc/refman/8.4/en/innodb-auto-increment-handling.html#innodb-auto-increment-lock-modes)를 참조하세요.