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

## Part 1 MySQL 구조
### 1.1 MySQL 논리 계층
MySQL 서버는 3개의 계층으로 구성된다:
1. 연결/스레드 제어 계층;
2. 쿼리 계층: 쿼리 파싱, 분석, 최적화; 내장 함수; 저장 프로시저; 트리거; 뷰;
3. 엔진 계층;

### 1.2 동시성 제어
- 읽기/쓰기 잠금;
- 잠금 세분성:
    - 테이블 잠금: 비용 낮음, 동시성 낮음;
    - 행 잠금: 비용 높음, 동시성 높음, 엔진 계층에서 구현;

### 1.3 트랜잭션
ACID: 원자성(atomicity), 일관성(consistency), 격리성(isolation), 지속성(durability).

격리 수준:
| LEVEL | dirty read | nonrepeatable read | phantom row | locked read |
| :- | :-: | :-: | :-: | :-: |
| READ UNCOMMITTED | YES | YES | YES | NO |
| READ COMMITTED | NO | YES | YES | NO |
| REPEATABLE READ | NO | NO | YES | NO |
| SERIALIZABLE | NO | NO | NO | YES |

MySQL의 기본 수준은 `REPEATABLE READ`이다. RC 격리 수준에서는 각 스냅샷 읽기가 최신 Read View를 생성하고 획득한다; RR 격리 수준에서는 동일한 트랜잭션 내의 첫 번째 스냅샷 읽기에서 Read View를 생성하고, 이후의 스냅샷 읽기는 동일한 Read View를 획득한다.

교착 상태(Dead Lock): Innodb 엔진은 행 잠금이 가장 적은 트랜잭션을 롤백한다.

2단계 잠금 프로토콜(two-phase locking protocol): 트랜잭션은 실행 중 언제든지 잠금을 획득할 수 있지만, 커밋 또는 롤백 후에만 잠금을 해제한다.

### 1.4 MVCC
MVCC는 RR/RC 수준에서 트랜잭션이 얼마나 오래 실행되든 관계없이 언제나 동일한 뷰를 볼 수 있게 해준다.

MVCC가 필요한 이유:
- 읽기-읽기: 안전함;
- 읽기-쓰기: 안전하지 않음, dirty read/nonrepeatable read/phantom row<sup>[1]</sup>를 유발할 수 있음;
- 쓰기-쓰기: 안전하지 않음, 갱신 손실(update lost)을 유발할 수 있음;

MVCC는 **lock-free** 동시성 제어를 통해 읽기-쓰기 충돌을 해결할 수 있다.

1. 암시적 필드: 사용자 정의 필드 외에도 각 행 레코드에는 데이터베이스가 암시적으로 정의한 필드(DB_TRX_ID, DB_ROLL_PTR, DB_ROW_ID 등)가 있다.
    - DB_TRX_ID: 6 바이트, 이 레코드를 생성한/마지막으로 수정한 트랜잭션 ID를 기록
    - DB_ROLL_PTR: 7 바이트, 롤백 포인터, 이 레코드의 이전 버전을 가리킴
    - DB_ROW_ID: 6 바이트, 보이지 않는 기본 키
2. undo log:
    - insert undo log: 트랜잭션이 새 레코드를 삽입할 때 생성되는 undo log로, 트랜잭션이 롤백될 때만 필요하며 트랜잭션이 커밋된 직후 폐기될 수 있다
    - update undo log: 트랜잭션이 갱신 또는 삭제할 때 생성되는 undo log; fast read나 트랜잭션 롤백이 해당 로그를 포함하지 않을 때에만 `purge` 스레드에 의해 해당 로그가 정리된다

3. read view<sup>[2]</sup>: 트랜잭션이 스냅샷 읽기를 수행할 때, MySQL은 관련 행 데이터에 대한 read view를 생성한다. 이 트랜잭션에 어떤 버전의 데이터가 보이는지 확인하는 데 사용되며, 트랜잭션 전체에서 모든 읽기 작업이 일관되도록 보장한다.

### 1.5 중복
자세한 내용은 [Part 9](#part-9)를 참고.

### 1.6 데이터 파일 구조
- Innodb:
    - 테이블스페이스 파일(`.ibd`): InnoDB는 테이블스페이스 파일을 사용하여 데이터와 인덱스를 저장한다
    - 시스템 테이블스페이스(`ibdata1`): InnoDB 데이터 딕셔너리, undo log, 시스템 트랜잭션 정보 등을 포함한다
- 로그:
    - 바이너리 로그(binary log): 복제와 데이터 복구를 위해 데이터베이스 내용을 수정하는 모든 문을 기록
    - 리두 로그(redo log): InnoDB 전용, 데이터 페이지 변경 사항을 기록, 크래시 복구에 사용
    - 언두 로그(undo log): InnoDB 전용, 트랜잭션 롤백과 MVCC에 사용
    - 슬로우 쿼리 로그(slow query log): 타임아웃된 sql을 기록
    - 에러 로그(error log): 시작, 실행, 종료 중 발생한 예외를 기록
- 설정:
    - my.ini: MySQL 전역 설정을 기록
- 기타:
    - PID 파일(`.pid`): MySQL 프로세스 PID를 기록
    - 소켓 파일(socket file): Unix/Linux에서의 로컬 연결 소켓 파일

## Part 2 안정적인 모니터링
### 2.1 가용성
> 컴포넌트 장애가 불가피하다는 것을 이해하고 받아들인 다음, 가능한 최선의 서비스를 제공하라.

가장 선호되는 방법은 `SELECT 1`과 같이 원격으로 접속하고 실행하는 것이다. 요구 사항에 따라 더 복잡한 가용성 검증도 가능하다.

### 2.2 쿼리 지연
**슬로우 쿼리 로그**에 더 주의를 기울이고, Druid 등과 같이 일부 데이터소스 연결 컴포넌트는 슬로우 쿼리 추적을 제공한다.

### 2.3 에러 분석
- `lock wait timeout`: 행 수준 잠금 경합이 증가하고 트랜잭션이 계속 재시도하지만 여전히 실패하고 있을 수 있다
- `aborted connections`: 클라이언트와 데이터베이스 간의 접속에 문제가 있을 수 있다
- `too many connections`: 클라이언트가 데이터베이스에 접속하기 위해 커넥션 풀을 사용해야 하거나 `max_connections`를 늘려야 할 수 있다; `thread_connected`의 값보다 비율(`thread_connected/max_connections`)에 더 주의를 기울이는 것이 좋다

### 2.4 중요한 모니터링
1. 디스크 사용량(Disk Usage)
2. 연결 수(Connection Number)
3. 복제 지연(Replication Delay)
4. I/O 사용량(I/O Usage)
5. 자동 증가 키스페이스(Auto-increment Keyspace): 자세한 내용은 [Part 6](https://gdhvxcj.cn/blog/2025/05/08/HighPerformanceMySQL-3#part-6-design-and-manage-schema) 참고
6. 백업(Backup)

### 2.5 권장 사항
1. 항상 평균값보다 최대값에 집중하라
2. 백분위수 데이터가 서비스 품질을 더 잘 반영할 수 있다
3. 가능한 한 오래 데이터를 보관하라

## Part 3 Performance Schema
Performance Schema는 instrument와 comsumer 두 부분으로 구성된다.

### 3.1 Instrument
instrument 이름은 '/' 문자로 구분된 일련의 요소로 구성된다<sup>[3]</sup>.
MySQL은 모든 instrument를 `setup_instruments`에 저장한다.
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
모니터링 정보를 저장하기 위한 테이블<sup>[4]</sup>.
- `*_current`: 서버에서 현재 진행 중인 이벤트
- `*_history`: 각 스레드에 대해 가장 최근에 완료된 10개의 이벤트; 설정 가능
- `*_history_long`: 전역에서, 각 스레드에 대해 가장 최근에 완료된 10000개의 이벤트; 설정 가능
- `event_waits_*`: 이벤트 대기 정보
- `events_statements_*`: SQL 쿼리 정보
- `events_stages_*`: SQL 단계 정보, 예를 들어 `sending data` 등
- `event_transactions_*`: 트랜잭션 정보
- `*_summary_by_*`: 정보 요약 테이블
- `*_instances`: 객체 인스턴스 테이블
- `setup_*`: 런타임 설정

### 3.3 Performance Schema 사용
1. 쿼리를 실행하는 사용자로 이벤트 수집을 제한
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
2. statement와 stage instrumentation이 활성화되어 있는지 확인
3. `events_statements_*`와 `events_stages_*` consumer가 활성화되어 있는지 확인
4. 프로파일링하려는 statement를 실행
    ```mysql
    mysql> SELECT * FROM employees.employees WHERE emp_no = 10001;
    +--------+------------+------------+-----------+--------+------------+
    | emp_no | birth_date | first_name | last_name | gender | hire_date |
    +--------+------------+------------+-----------+--------+------------+
    |  10001 | 1953-09-02 | Georgi     | Facello   | M      | 1986-06-26 |
    +--------+------------+------------+-----------+--------+------------+
    ```
5. `events_statements_history_long` 테이블을 조회하여 statement의 `EVENT_ID`를 가져옴
    ```mysql
    mysql> SELECT EVENT_ID, TRUNCATE(TIMER_WAIT/1000000000000,6) as Duration, SQL_TEXT
        FROM performance_schema.events_statements_history_long WHERE SQL_TEXT like '%10001%';
    +----------+----------+--------------------------------------------------------+
    | event_id | duration | sql_text                                               |
    +----------+----------+--------------------------------------------------------+
    |       31 | 0.028310 | SELECT * FROM employees.employees WHERE emp_no = 10001 |
    +----------+----------+--------------------------------------------------------+
    ```
6. `events_stages_history_long` 테이블을 조회하여 statement의 stage 이벤트를 가져옴
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
7. 그 밖에 수행하려는 다른 프로파일링

### 3.4 sys Schema
Performance Schema를 기반으로 한 뷰와 저장 컴포넌트는 Performance Schema 경험을 더 원활하게 하기 위해 설계되었다<sup>[5]</sup>. sys Schema 자체는 **어떤 데이터도 저장하지 않는다**. 원하는 데이터를 찾을 수 없다면 Performance Schema 기본 테이블에서 검색하라.

### 3.5 권장 사항
Performance Schema는 **활성화**되어야 하며, Instrument와 Consumer는 필요에 따라 동적으로 활성화해야 한다.

[1]: InnoDB는 phantom row를 해결하기 위해 next-key locking이라는 알고리즘을 사용한다. 자세한 내용은 [17.7.4 Phantom Rows](https://dev.mysql.com/doc/refman/8.4/en/innodb-next-key-locking.html)를 참고.
[2]: 블로그 [mvcc（多版本并发控制）原理的理解](https://blog.csdn.net/jerry11112/article/details/125894758?fromshare=blogdetail&sharetype=blogdetail&sharerId=125894758&sharerefer=PC&sharesource=qq_43321767&sharefrom=from_link) 참고.
[3]: 자세한 내용은 [29.6 Performance Schema Instrument Naming Conventions](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-instrument-naming.html)를 참고.
[4]: 자세한 내용은 [29.12.1 Performance Schema Table Reference](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-table-reference.html)를 참고.
[5]: 자세한 내용은 [Chapter 30 MySQL sys Schema](https://dev.mysql.com/doc/refman/8.4/en/sys-schema.html)를 참고.