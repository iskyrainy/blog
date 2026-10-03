---
title: High Performance MySQL 3
category: Tech
tag: MySQL
date: 2025-05-08T00:01:29+08:00
---


# HighPerformanceMySQL-3
> 깊이 이해한 후에 바꿔라.
> 
> MySQL 공식 문서는 [MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/preface.html)를 참조하세요.

## Part 6 스키마 설계 및 관리
### 6.1 더 나은 데이터 타입 선택
다음 규칙을 따르세요:
- 작을수록 좋다: 작은 데이터 타입은 일반적으로 더 빠르게 실행되고 캐시/메모리/디스크를 적게 차지하며 처리에 필요한 CPU 시간도 적다. 하지만 정확성을 잃거나 오버플로가 발생하지 않도록 주의해야 한다.
- 단순할수록 좋다: 단순한 데이터 타입은 처리에 필요한 CPU 시간이 적다. `int`가 `varchar`보다 낫고, `timestamp`가 `datetime/date`보다 낫고, `datetime/date`가 `varchar`보다 낫다.
- 기본 `NULL` 피하기: `NULL`을 저장하는 컬럼은 MySQL이 최적화하기 어렵고, `NULL`은 인덱스, 인덱스 통계, 값을 더 복잡하게 만들며, `NULL`이 가능한 컬럼은 더 많은 저장 공간을 차지한다(다소 직관에 반하는 점이다).
- enum으로 문자열 대체: 몇 가지 기본값만 있는 필드의 경우 `enum`을 사용하는 것이 더 나은 선택이다. MySQL `enum`은 정수와 문자열로 저장된다. 기본적으로 MySQL은 `enum`을 문자열 값이 아닌 정수 값으로 정렬하며, `FIELD()`로 정렬 규칙을 명시적으로 지정할 수 있다.
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

타입 정보:
1. 정수(整形): `tinyint(8bit)`, `smallint(16bit)`, `mediumint(24bit)`, `int(32bit)`, `bigint(64bit)`. 그리고 `unsigned`를 설정하여 범위를 넓힐 수 있으며, 저장 공간과 성능은 동일하다.
2. 실수(浮点数): `float`, `double`, `decimal`. `float`와 `double`은 OS의 표준 부동 소수점 계산을 사용한다. 정확하게 계산해야 하는 데이터에는 `decimal`을 사용하여 저장하라.
3. 문자열(字符串): `varchar`, `char`, `binary`, `varbinary`. MySQL은 각 엔진에서 이들을 다르게 구현한다. 
   - `varchar`: `char`보다 저장 공간을 적게 사용한다. `varchar`는 필요한 공간만 사용한다. `varchar`는 문자열 길이를 저장하기 위해 추가로 1 또는 2 바이트가 필요하다. **하지만 최선의 전략은 실제로 필요한 공간만 할당하는 것이다.**
   - `char`: 매우 짧은 문자열을 저장하거나 모든 값이 거의 같은 길이인 상황에 적합하다. 더 이상 변하지 않을 데이터의 경우 `char`가 `varchar`보다 성능 면에서 낫다.
   - `binary`/`varbinary`: 이진 바이트로 저장하며 더 나은 성능을 가진다.
4. blob/text(大数据): MySQL은 전체 blob/text를 인덱스에 저장하지 않으며, 인덱스로 정렬할 수도 없다.
   - blob: `tinyblob`, `smallblob(blob)`, `mediumblob`, `longblob`. 이진 바이트를 저장하며 인코딩이나 정렬 규칙이 없다.
   - text: `tinytext`, `smalltext(text)`, `mediumtext`, `longtext`. 인코딩과 정렬 규칙이 있는 문자열을 저장한다.
5. date/time(时间): `datetime`, `timestamp`.
   - `datetime`: 8 바이트. 범위는 서기 1000년부터 서기 9999년까지이며, 정밀도는 마이크로초이고, 타임존과 무관하며, 정렬할 수 있다.
   - `timestamp`: 4 바이트. 범위는 서기 1970.1.1부터 서기 2038.1.19까지이며, 기본적으로 not null이고, 값을 지정하지 않고 삽입하거나 업데이트하면 MySQL이 현재 시간 값을 설정한다.
6. bit(位): `bit`, `set`.
   - `bit`: 최대 길이는 64b이며, MySQL이 문자열 타입(ASCII)으로 처리하므로 `bit` 타입 사용을 피하는 것이 좋다. MySQL은 `bit` 데이터를 가장 가까운 정수 타입(1-8b->tinyint)으로 저장한다. 
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
   - `set`: 여러 개의 true/false 값의 집합.
7. json: 성능과 저장 면에서 모두 일반 SQL 필드보다 낫지 않다.

우리가 주의해야 할 또 다른 점은 식별자(기본 키 또는 기본 키의 일부, 보통 다른 테이블과 조인하는 연결 필드)로 적합한 타입을 선택하는 것이다. **대부분의 상황에서 정수가 최선의 선택이다.** 정수는 좋은 성능을 가지며 자동 증가할 수 있다(*정수의 오버플로에 주의하라*). `enum`이나 `set`을 식별자로 선택하지 마라. 가능하면 문자열 타입을 식별자로 사용하는 것을 피하라. 문자열 타입은 정수에 비해 더 많은 저장 공간을 차지하고 처리 속도가 느리기 때문이다. 일부 무작위 문자열 생성 알고리즘(UUID 등)에 주의하라: 무작위 값은 무작위 인덱스 상황을 초래하여 `INSERT`와 `SELECT`를 느리게 만든다. `UUID`를 식별자로 사용할 때는 `-`를 제거하고, 더 나아가 `UNHEX()` 함수를 사용하여 UUID 값을 16바이트 숫자로 변환하여 BINARY(16) COLUMN에 저장하는 것이 좋다. 값은 `HEX()` 함수를 사용하여 16진수 형식으로 검색할 수 있다.

IPv4와 같은 일부 특수 데이터의 경우, MySQL은 `INET_ATON()`과 `INET_NTOA()`를 제공하여 IP와 부호 없는 정수 사이의 값을 교환하며, 저장 공간을 16 바이트에서 32 비트로 줄인다.

### 6.2 스키마의 함정
1. 필드가 너무 많음: MySQL은 데이터를 행 단위로 캐시한 다음 서버가 캐시를 컬럼으로 디코딩한다. 따라서 컬럼이 많을수록 비용이 더 많이 든다.
2. 조인이 너무 많음: 적절한 중복 설계는 합리적이다.
3. `enum` 과다 사용

## Part 7 고성능 인덱스
### 7.1 인덱스
인덱싱은 서버 계층이 아닌 스토리지 엔진 계층에서 구현된다.
1. `b-tree index`<sup>[1]</sup>: InnoDB는 B+ 트리<sup>[2]</sup>를 사용한다. B-tree 인덱스는 전체 키 값 및 키 값 범위 또는 키 접두사 조회에 적합하다. 여기서 키 접두사 조회는 가장 왼쪽 접두사를 기반으로 하는 조회에만 사용할 수 있다. 
   - 전체 키 값(全值匹配): 인덱스의 모든 컬럼과 일치한다.
   - 가장 왼쪽 접두사 일치(最左前缀): index(field1, field2, ...)의 경우 field1 또는 (field1, field2) 또는 (field1, field2, ...)에 유효한 조건.
   - 컬럼 접두사 일치(列前缀): 컬럼 값의 시작 부분만 일치한다.
   - 범위 값 일치(范围值)
   - 가장 왼쪽 접두사 일치 및 컬럼 접두사 일치: index(field1, field2, ...)의 경우 (field1, field2의 시작 부분)에 유효한 조건.
2. `hash index`: `=` 또는 `<>`에서 더 나은 성능을 보이지만 범위 쿼리에서는 더 나쁘다<sup>[3]</sup>.
적응형 해시 인덱싱: *InnoDB가 특정 인덱스 값이 매우 자주 접근되는 것을 발견하면, 원래 B-tree 인덱스 위에 메모리에 해시 인덱스를 구축한다. 이렇게 하면 B-tree 인덱스도 해시 인덱싱의 일부 이점을 가지게 된다*.

### 7.2 고성능 인덱스 전략
- 접두사 인덱스: 저장 비용을 낮추기 위해 접두사 인덱스는 필드의 일부 접두사만 저장한다. 고유 인덱스 값과 데이터 테이블의 총 레코드 수의 비율(선택도<sup>[4]</sup>)은 접두사 인덱스의 성능을 나타낸다. 비율이 1이면 접두사 인덱스의 인덱싱 성능은 고유 인덱스와 동일하며 더 짧은 문자만 처리하면 된다.
- 다중 컬럼 인덱스: 인덱스 병합 대신 다중 컬럼 인덱스를 사용하라. 일반적으로 선택도가 높은 필드를 다중 컬럼 인덱스의 앞부분에 배치하는 것이 좋은 선택이다.
- 클러스터형 인덱스: 별도의 인덱스 타입이 아니라 **데이터를 저장하는** 방식이다. InnoDB는 기본 키(또는 보이지 않는 인덱스<sup>[5]</sup>)로만 데이터를 클러스터링한다. 
- 커버링 인덱스: 인덱스가 조회해야 하는 모든 필드의 값을 포함하면 이를 커버링 인덱스라고 한다. B-tree 인덱스만 커버링 인덱스로 사용할 수 있다는 점에 유의해야 한다.

다음과 같은 중복 인덱스 설계를 피하라:
- (A, B)와 (A)
- (A, ID): 보조 인덱스는 기본 키를 포함하므로 ID는 쓸모없다.

한 번도 사용되지 않은 인덱스를 삭제하라. `sys`에서는 `table_io_waits_summary_by_index_usage` 뷰에서 어떤 인덱스가 한 번도 사용되지 않았는지 확인하는 것이 매우 간단하다.

## Part 8 쿼리 성능 최적화
### 8.1 SQL이 느리게 실행되는 이유
쿼리를 하나의 작업으로 생각하면 일련의 하위 작업으로 구성되며, 각 하위 작업은 일정 시간을 소비한다. 쿼리를 최적화하려면 실제로 하위 작업을 최적화하는 것이다. 즉, 일부를 제거하거나, 하위 작업이 실행되는 횟수를 줄이거나, 하위 작업이 더 빠르게 실행되도록 만드는 것이다.

### 8.2 데이터 접근 최적화
1. 일부 데이터를 조회하지만 필요하지 않을 수 있음:
   - `limit`을 합리적으로 사용하라
   - `select *`를 사용하지 마라
   - 짧은 시간에 동일한 SQL을 반복 실행하는 것을 피하고, 결과를 캐시에 설정하라
2. MySQL이 추가 레코드를 스캔할 수 있음: **응답 시간, 스캔 행 수 및 결과 행 수를 고려하라**.
   - 커버링 인덱스를 사용하여 스캔하도록 노력하라
   - 테이블 구조를 변경하라
   - 복잡한 SQL을 재작성하라

### 8.3 SQL 재작성
느리고 복잡한 SQL의 경우, 여러 개의 작은 SQL 작업으로 분할하면 더 나은 성능을 얻을 수 있다. 복잡한 SQL은 긴 트랜잭션을 만들어 서버 자원을 대부분 소비하고 많은 행이나 테이블을 잠근다. 단순한 SQL은 그 반대이며, 반복적으로 실행되는 SQL의 경우 결과를 캐시에 설정할 수 있다.

### 8.4 실행의 기초
MySQL에 쿼리 요청을 보낸 후:
1. 클라이언트가 SQL을 보낸다;
2. 서버가 SQL을 파싱, 전처리, 최적화한다;
3. MySQL이 엔진 API를 호출하여 최적화된 SQL을 실행한다;
4. 클라이언트에 결과를 반환한다.
![MySQL workflow](https://i.postimg.cc/Kjp75GZD/My-SQL-workflow.png)

MySQL 옵티마이저:
MySQL 옵티마이저 전략은 정적 전략과 동적 전략의 두 가지로 나눌 수 있다. 정적 전략은 '컴파일 타임 최적화'와 같이 한 번 수행하고 항상 실행한다. 동적 전략은 '런타임 최적화'와 같이 실행할 때마다 다를 수 있다.

일부 최적화:
- 테이블 조인 순서 재정의
- 외부 조인을 내부 조인으로 변환
- 등가 대입: 항상 참인 판단과 항상 참이 아닌 판단을 제거하고, 상수로 표시할 수 있는 판단을 교체
- 인덱스와 필드 기본값으로 `COUNT()`, `MIN()`, `MAX()` 최적화
...

> 옵티마이저보다 자신이 더 똑똑하다고 쉽게 가정하지 마라.😂

**MySQL의 Join**:
모든 `join`에 대해 MySQL은 첫 번째 테이블에서 행을 조회한 다음 두 번째 테이블의 행을 일치시키며, 모든 테이블이 확인될 때까지 하나씩 수행하고 SQL에 지정된 컬럼을 반환한다.
MySQL 조인 옵티마이저는 더 나은 성능을 위해 조인 순서를 재정렬할 수 있으며, 옵티마이저는 각 연결 순서의 성능을 평가하고 어떤 연결 방법을 사용할지 결정한다. 조인할 테이블이 `optimizer_search_depth`를 초과하면 옵티마이저는 탐욕 알고리즘으로 조인 순서를 재정렬한다.

### 8.5 옵티마이저의 한계
1. `UNION` 한계: 때때로 MySQL은 외부에서 내부로 조건을 추론할 수 없다. 예: `(SELECT ...) UNION (SELECT ...) LIMIT 20;` MySQL은 두 SQL 결과를 모두 임시 테이블에 넣은 다음 20 행을 선택한다. 더 나은 방법은 SQL을 `(SELECT ... LIMIT 20) UNION (SELECT ... LIMIT 20) LIMIT 20;`으로 변환하는 것이며, 이제 임시 테이블은 40 행만 가지게 된다.
2. 등가 전달: 큰 `IN` 조건 목록을 전달할 때 실행 속도가 느려진다.

### 8.6 특정 SQL 최적화
1. `COUNT()` SQL: 행 수를 세려면 `COUNT(*)`를 사용하라. `SUM(IF(..., 1, 0))`을 `COUNT(... or NULL)`로 교체하라.
2. `JOIN` SQL: SQL이 인덱스를 사용할 수 있는지 확인하라.
3. `LIMIT/OFFSET` SQL: 가능하면 인덱스 오버레이 스캔을 사용하라. 그런 다음 필요에 따라 한 번 조인하고 결과 컬럼을 반환하라. 예: `SELECT id, name FROM user ORDER BY age LIMIT 10000, 5;` -> `SELECT id, name FROM user INNER JOIN (SELECT id FROM user ORDER BY age LIMIT 10000, 5) AS t ON user.id = t.id;`. 또는 `LIMIT`을 `BETWEEN ... AND ...`로 변경하여 SQL이 인덱스의 범위 스캔을 사용할 수 있도록 하라. 또는 마지막 쿼리 행 번호를 기록하라. 예: `SELECT ... FROM t ORDER BY id DESC LIMIT 20;` -> `SELECT ... FROM t WHERE id < ... ORDER BY id DESC LIMIT 20;`.
4. `UNION` SQL: `WHERE`, `LIMIT`, `ORDER BY` 등의 절을 UNION의 다양한 하위 쿼리로 수동으로 "푸시 다운"하여 옵티마이저가 이러한 조건을 최적화에 최대한 활용할 수 있도록 하라. 서버가 행을 중복 제거해야 하는 경우가 아니면 `UNION ALL`을 사용하는 것이 중요하다.


[1]: 자세한 내용은 *Relational Database Index Design and the Optimizers*를 참조하세요.
[2]: 자세한 내용은 [B树、B+树详解](https://www.cnblogs.com/lianzhilei/p/11250589.html)을 참조하세요.
[3]: 자세한 내용은 [10.3.9 Comparison of B-Tree and Hash Indexes](https://dev.mysql.com/doc/refman/8.4/en/index-btree-hash.html)을 참조하세요.
[4]: 자세한 내용은 [selectivity](https://dev.mysql.com/doc/refman/8.4/en/glossary.html#glos_selectivity)를 참조하세요.
[5]: 자세한 내용은 [10.3.12 Invisible Indexes](https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html)을 참조하세요.