---
title: Tokio
category: Tech
tag: Rust
date: 2025-08-28T00:33:49+08:00
---


# Tokio - Rust 최고의 비동기 런타임
## Part 1 동기 vs 비동기
동기 프로그래밍과 비동기 프로그래밍이란 무엇인가?
동기적 사고는 인간의 가장 본능적인 사고 방식이다. 이런 상황을 생각해 보자: 배가 고파서 음식을 사 먹으려고 식당에 들어가 줄을 선다. 그러면 자신의 차례가 될 때까지 줄을 서서 기다린 후, 식사 값을 지불한다.
사건의 순서:
1. 배가 고프다
2. 줄에서 몇 분간 기다린다 😥
3. 식사 값을 지불한다
4. 음식이 준비된 후 식사를 시작한다!

동기 프로그래밍에서는 모든 사건이 순차적으로 발생하며, 현재 작업이 완료될 때까지 다음 작업을 차단한다. `sync`는 인간의 사고 방식과 정말 잘 맞고, 작성과 디버깅이 더 간단하다. 하지만 때로는 코드의 실행 속도를 **느리게** 만들기도 한다.

하지만 비동기 세계에서는 완전히 다르다. 사건의 순서를 보자:
1. 배가 고프다
2. 줄을 설 필요 없이, QR 코드를 스캔하고 테이블 번호를 입력하여 온라인으로 주문한다 😊
3. 웨이터가 음식을 가져다줄 때까지 기다리는 동안 다른 일을 할 수 있다
4. 음식이 준비된 후 식사를 시작한다!

이것이 동기와 비동기의 가장 큰 차이점인가?
- 동기: 차단된 작업에 **항상 주의를 기울인다(차단 대기 또는 폴링)**
- 비동기: 차단된 작업의 완료 알림을 받고, 대기 기간 동안 **다른 비차단 작업을 실행**해야 한다

다음은 동기 vs 비동기를 표로 명확하게 비교한 것이다:
| 측면                    | **동기**                                                                      | **비동기**                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **정의**            | 작업이 차례로 실행되며, 각 작업은 다음 작업이 시작되기 전에 완료되어야 한다.       | 작업은 다른 작업이 완료될 때까지 기다리지 않고 시작하고 계속할 수 있다.                                               |
| **실행 흐름**         | 차단: 하나의 작업이 완료될 때까지 다른 작업의 실행을 차단한다.              | 비차단: 작업은 독립적으로 또는 병렬로 실행될 수 있다.                                                      |
| **대기**               | 호출자는 작업이 완료될 때까지 기다린 후 다음으로 넘어간다.                           | 호출자는 기다리지 않고 다른 작업을 진행할 수 있다.                                                            |
| **성능**           | 대기 중 CPU가 유휴 상태이므로 I/O 또는 네트워크 지연이 있는 시나리오에서 느리다.       | I/O 바운드 작업에서 더 빠르고 효율적이며, 그동안 CPU가 다른 작업을 수행할 수 있다.                 |
| **복잡성**             | 작성, 이해, 디버깅이 간단하다.                                              | 콜백, 프로미스 또는 async/await 처리로 인해 더 복잡하다.                                                |
| **사용 사례**             | 소규모 프로그램, 순차적으로 실행되어야 하는 작업, CPU 바운드 작업에 적합하다. | 네트워킹, 파일 I/O, 데이터베이스 쿼리, 사용자 인터페이스, 고동시성 시스템에 적합하다.                  |
| **예시 (프로그래밍)** | 함수는 완료 후 결과를 직접 반환한다.                                   | 함수는 *promise*, *future*를 반환하거나 콜백/이벤트를 사용하여 나중에 결과를 전달할 수 있다.                      |
| **비유**               | 계산원 앞에 줄을 서서 앞 사람이 끝날 때까지 기다린다.   | 세탁소에 옷을 맡기고, 그들이 작업하는 동안 다른 일을 하다가 나중에 찾아간다.   |

## Part 2 Rust std의 비동기
Rust는 *비동기 프로그래밍*에 대한 표준 지원을 제공한다: Rust의 Futures, Streams, `async` 및 `await` 구문. Rust에서 비동기 프로그래밍의 핵심 요소는 future와 `async/await` 키워드이다<sup>[1]</sup>.

키워드:
- `async`: 블록과 함수에 적용하여 중단되고 재개될 수 있음을 지정한다
- `await`: async 블록/함수 내에서 await를 사용하여 *future*를 *await*한다(준비될 때까지 기다린다)

핵심 트레이트:
- `Future`: [Part 1](#part-1-동기-vs-비동기)에서 언급했듯이, 온라인으로 주문한 후 웨이터가 선택한 테이블 번호에 해당하는 테이블에 음식을 놓는다. 테이블 번호와 마찬가지로, *future*는 지금은 **준비되지 않았을 수** 있지만 미래의 어느 시점에 **준비될** 값이다. Rust는 `Future` 트레이트를 빌딩 블록으로 제공하여 서로 다른 비동기 작업이 서로 다른 데이터 구조로 구현되지만 공통 인터페이스를 가질 수 있도록 한다.
  ```rust
    pub trait Future {
        /// The type of value produced on completion.
        type Output;

        /// Attempts to resolve the future to a final value, registering
        /// the current task for wakeup if the value is not yet available.
        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
    }
  ```
- `Poll<T>`: `Ready(T)` 또는 `Pending`을 가진 enum.
  ```rust
    pub enum Poll<T> {
        /// Represents that a value is immediately ready.
        Ready(T),

        /// Represents that a value is not ready yet.
        ///
        /// When a function returns `Pending`, the function *must* also
        /// ensure that the current task is scheduled to be awoken when
        /// progress can be made.
        Pending,
    }
  ```
- `Context` + `Waker`: 작업이 준비되었을 때 깨우는 메커니즘.

표준 라이브러리는 executor를 제공하지 않지만, 비동기 런타임이나 비동기 I/O를 구현하기 위한 모든 기반을 제공한다. 현재까지 `tokio`는 여전히 Rust 생태계에서 가장 우수하고 가장 널리 사용되는 비동기 런타임이다.

## Part 3 tokio 비동기 런타임
`tokio`<sup>[2]</sup>는 Rust 프로그래밍 언어를 위한 비동기 런타임이다. 비동기 코드를 효율적으로 실행하는 데 필요한 인프라를 제공하여, 특히 네트워킹에서 고성능 동시성 애플리케이션의 개발을 가능하게 한다.

> `tokio`는 std와 동일한 모듈을 제공하지만 비동기 구현을 사용한다.

### 3.1 runtime
비동기 애플리케이션은 런타임 지원이 필요하다. 특히 다음과 같은 런타임 서비스가 필요하다:
- I/O 리소스를 구동하고 I/O 이벤트를 해당 이벤트에 의존하는 작업에 디스패치하는 **I/O 이벤트 루프**(드라이버라고 함).
- 이러한 I/O 리소스를 사용하는 작업을 실행하는 **스케줄러**.
- 설정된 기간 후에 실행할 작업을 예약하기 위한 **타이머**.

Tokio의 런타임은 모든 기능을 단일 타입으로 제공한다: **[Runtime](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html)**.

> 생성

```rust
use tokio::net::{TcpListener, TcpStream};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::runtime::Runtime;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create the runtime
    let rt  = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");

    // Spawn the root task
    rt.block_on(async {
        let listener = TcpListener::bind("127.0.0.1:8080").await?;

        loop {
            let (mut socket, _) = listener.accept().await?;

            tokio::spawn(async move {
                // read or write by socket
                handle_socket(socket);
            });
        }
    })
}

fn handle_socket(mut socket: TcpStream) {
  // ...
}
```

런타임의 진입점은 [`block_on()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.block_on)이다. `block_on()`에서 실행되는 future는 워커로 실행되지 않는다(TcpListener 루프처럼). 여기서 제공된 `block_on()`의 future에서 파생된 다른 모든 future는 워커로 스폰된다.

Tokio는 **멀티 스레드 스케줄러**와 **현재 스레드 스케줄러**를 제공한다. 멀티 스레드 스케줄러는 *스레드 풀*에서 future를 실행하며, work-stealing 전략을 사용하고 기본적으로 사용 가능한 각 CPU 코어에 대해 워커 스레드를 시작한다. 현재 스레드 스케줄러는 *단일 스레드* future executor를 제공한다. 모든 작업은 현재 스레드에서 생성되고 실행된다.
```rust
use tokio::runtime;

// Multi-Thread Scheduler
let rt = runtime::Runtime::new()?;

// Current-Thread Scheduler
let rt = runtime::Builder::new_current_thread()
    .build()?;
```

그리고 Tokio는 매크로를 통해 런타임을 생성하는 더 쉬운 방법을 제공한다, [macro](#38-macro)를 참조하라.

> 스케줄

*작업*은 가볍고 비차단적인 실행 단위이다. 작업은 OS 스레드와 유사하지만, OS 스케줄러에 의해 관리되는 대신 Tokio 런타임에 의해 관리된다<sup>[3]</sup>.

작업의 주요 특징:
1. **가벼움**: 대량의 작업을 생성, 실행, 전환 및 파괴하는 것이 특히 OS 스레드에 비해 상당히 저렴하다
2. **협력적**: 작업이 양보하면 Tokio 런타임이 다음 작업 실행으로 전환한다
3. **비차단**: Tokio는 비동기 컨텍스트에서 차단 작업을 실행하기 위한 API를 제공한다

런타임은 작업 컬렉션이 빌 때까지 스케줄 작업(`poll` 호출)을 유지한 다음 잠든다. Tokio의 런타임은 *작업 기아*를 방지하기 위해 다음과 같은 공정성 보장을 제공한다: 총 작업 수가 무한히 증가하지 않고 어떤 작업도 스레드를 차단하지 않으면, 작업이 공정하게 스케줄링되는 것이 보장된다. 다음 두 가지 가정 하에:
- 특정 시점에 런타임의 총 작업 수가 절대 `MAX_TASKS`를 초과하지 않는 어떤 수 `MAX_TASKS`가 존재한다
- 런타임에 스폰된 모든 작업에 대해 `poll`을 호출하면 `MAX_SCHEDULE` 시간 단위 내에 반환되는 어떤 수 `MAX_SCHEDULE`이 존재한다

`MAX_TASKS`와 `MAX_SCHEDULE`은 임의의 수일 수 있으며 런타임 사용자가 선택할 수 있다. `MAX_TASKS`와 `MAX_SCHEDULE`을 기반으로, tokio의 런타임 내부는 작업이 깨어났을 때 `MAX_DELAY` 시간 단위 내에 런타임에 의해 스케줄링되도록 하는 `MAX_DELAY`를 유지한다.

하지만 tokio는 런타임이 모든 작업에 동등하게 공정하다고 보장하지 않는다. 작업의 경우, tokio는 모든 작업이 동일한 스케줄 횟수를 얻는다고 보장하지 않지만, 모든 작업은 결국 스케줄링된다.

런타임은 또한 IO 리소스와 타이머를 관리한다. 런타임은 주기적으로 준비된 IO 리소스나 타이머가 있는지 확인하고, 관련 작업을 깨워 스케줄링되도록 한다. 이러한 확인은 **작업 스케줄링 사이에** 주기적으로 수행된다. Tokio는 IO 또는 타이머 이벤트로 작업을 깨우는 것이 일정 최대 시간 단위 내에 이루어지도록 보장한다.

- **현재 스레드 런타임 로직**:
  1. **작업 큐**
     * 2개의 FIFO 큐: **local**, **global**
     * 스케줄링 규칙:
       * 로컬 큐에서 다음 스케줄할 작업을 선택하는 것을 선호한다
       * 로컬 큐가 비어 있거나, 로컬 큐에서 작업을 연속으로 **31**(`global_queue_interval`, 기본 `31`)번 선택한 경우 → 글로벌 큐에서 작업을 선택한다
  2. **IO/스케줄러 확인**
     * 스케줄할 준비가 된 **작업이 없을 때마다**, 또는 작업을 연속으로 **61**(`event_interval`, 기본 `61`)개 스케줄한 경우 → 새로운 IO 또는 타이머 이벤트를 확인한다
  3. **작업 깨우기 규칙**
     * 런타임에서 실행 중인 작업 내에서 깨어난 작업 → **로컬 큐**에 추가된다
     * 외부에서 깨어난 작업 → **글로벌 큐**에 추가된다

  ```sql
  ┌──────────────────────────────┐
  │         Tokio Current        │
  │     Thread Runtime Logic     │
  └──────────────────────────────┘

            ┌───────────────┐
            │ Two Queues    │
            │ Local / Global│
            └───────┬───────┘
                    │
        ┌───────────┴───────────────────────────┐
        │                                       │
  Local Queue Priority                    Global Queue
  - Preferred                             - Picked if local empty
  - If chosen 31 times → switch           - Or after 31 local picks
  (`global_queue_interval`)              

        ┌──────────────────────────────────────┘
        │
        ▼
  ┌───────────────┐
  │ Task Scheduled│
  └───────┬───────┘
          │
          ▼
    ┌───────────────┐
    │ Event Check?  │
    └───────┬───────┘
            │
    ┌───────┴───────────────────────────┐
    │ No tasks ready                    │
    │ Or scheduled 61 tasks in a row    │
    │ (`event_interval`)                │
    └───────────────────────────────────┘

  ┌───────────────────────────────────────┐
  │         Task Wakeup Handling          │
  ├───────────────────────────────────────┤
  │ - Woken inside runtime → Local Queue  │
  │ - Woken outside runtime → Global Queue│
  └───────────────────────────────────────┘

  ⚠️ Note: LIFO slot optimization not used
  ```
- **멀티 스레드 런타임 로직**:
  1. **워커 & 큐**
     * 고정된 수의 워커 스레드(시작 시 생성됨).
     * 각 워커는 다음을 가진다:
       * **로컬 큐**(최대 256개 작업).
         * 초과 시 → 절반의 작업이 **글로벌 큐**로 이동한다.
       * **LIFO 슬롯**(특수 최적화).
     * 공유 **글로벌 큐**.
  2. **작업 스케줄링 우선순위**
     * **로컬 큐**를 선호한다.
     * 로컬이 비어 있거나, 로컬에서 `global_queue_interval`번 선택한 후 **글로벌 큐**를 사용한다.
     * 기본 `global_queue_interval`은 동적으로 계산된다(글로벌 큐 확인 사이 약 10ms).
  3. **Work Stealing**
     * 로컬 및 글로벌 큐가 모두 비어 있으면 → 다른 워커의 로컬 큐에서 절반의 작업을 훔친다.
  4. **이벤트 확인**
     * 다음과 같은 경우 IO/타이머를 확인한다:
       * 준비된 작업이 없거나, 또는
       * 작업을 연속으로 61개 스케줄한 경우(`event_interval` 구성 가능).
  5. **LIFO 슬롯 최적화**
     * 작업이 다른 작업을 깨우면 → **LIFO 슬롯**에 배치한다(큐 대신).
     * LIFO가 이미 가득 차 있으면 → 밀려난 작업은 로컬 큐로 간다.
     * 작업을 완료할 때 → LIFO에서 즉시 스케줄한다(가능한 경우).
     * LIFO가 사용될 때 Coop 예산은 재설정되지 않는다.
     * LIFO가 연속으로 3번 사용되면 → 비 LIFO 작업이 실행될 때까지 일시적으로 비활성화된다.
     * 비활성화할 수 있다(`disable_lifo_slot`).
     * **참고**: LIFO는 스레드별이며, 다른 스레드가 훔칠 수 없다.
  6. **비 워커 스레드에서의 작업 깨우기**
     * 깨어난 작업은 **글로벌 큐**에 배치된다.

  ```sql
  ┌──────────────────────────────┐
  │  Tokio Multi-thread Runtime  │
  └──────────────────────────────┘

  Workers
   ├─ Each worker has:
   │   ├─ Local Queue (max 256 tasks)
   │   │    └─ Overflow → half moved to Global Queue
   │   └─ LIFO Slot (special fast scheduling slot)
   └─ Shared Global Queue

  Task Scheduling
   ├─ Prefer Local Queue
   ├─ Use Global Queue if:
   │    - Local empty, OR
   │    - After global_queue_interval local picks
   └─ global_queue_interval ≈ 10ms heuristic if unset

  Work Stealing
   └─ If Local & Global empty → steal half from another worker’s Local Queue

  Event Checking
   └─ Triggered when:
       - No tasks ready, OR
       - 61 tasks scheduled in a row
       (event_interval configurable)

  LIFO Slot
   ├─ Wakeup → goes to LIFO slot
   ├─ If slot occupied → old task → Local Queue
   ├─ After scheduling task → run LIFO task immediately
   ├─ Coop budget not reset on LIFO
   ├─ If used 3 times in a row → temporarily disabled
   └─ Not stealable, can disable via setting

  Task Wakeup from Non-worker
   └─ Task placed in Global Queue
  ```

> 종료

`drop()`을 호출하거나 [`shutdown_background()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_background) 또는 [`shutdown_timeout()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_timeout)을 호출하여 런타임을 종료할 수 있다.
- `shutdown_background()`: 스폰된 작업이 중지될 때까지 기다리지 않고 런타임을 종료한다.
- `shutdown_timeout()`: 모든 스폰된 작업이 중지될 때까지 최대 지정된 기간 동안 기다린 후 런타임을 종료한다.

런타임이 drop된 후에는, 여기에 바인딩된 모든 미완료 I/O 리소스가 더 이상 작동하지 않는다. 이들에 대한 메서드를 호출하면 오류가 발생한다.

`Runtime::spawn`에 의해 스폰된 작업은 완료까지 실행되는 것이 *보장*되지 않으며, `Runtime::spawn_blocking`에 의해 스폰된 작업은 반환될 때까지 계속 실행된다.

> 공유

- `Arc<Runtime>` 사용: 런타임이 종료되는 것을 방지하며, **단 하나의** 강한 참조 카운트만 남았을 때 런타임을 종료한다
- [`Handle`](https://docs.rs/tokio/latest/tokio/runtime/struct.Handle.html) 사용: 런타임이 종료되는 것을 방지하지 않는다
- `Runtime::enter` 또는 `Handle::enter`로 런타임 컨텍스트에 진입: 스레드 로컬 변수를 사용하여 현재 런타임을 저장하며, `tokio::spawn`과 같은 모든 메서드는 컨텍스트 내부의 런타임을 사용한다

### 3.2 fs
Tokio는 차단 파일 작업을 사용하여 파일 시스템 작업을 위한 비동기 유틸리티 메서드를 구현하며, 파일 읽기/쓰기 및 디렉터리 작업을 포함한다. Tokio는 모든 플랫폼에서 항상 `spawn_blocking`을 사용한다<sup>[4]</sup>.

`tokio::fs::read()`의 세부 사항을 보자:
```rust
/// This is an async version of [`std::fs::read`].
pub async fn read(path: impl AsRef<Path>) -> io::Result<Vec<u8>> {
    let path = path.as_ref().to_owned();
    asyncify(move || std::fs::read(path)).await
}
```
사실, `tokio::fs::read()`는 `std::fs::read()`의 비동기 버전이다. 내부 함수 `asyncify`는 `spawn_blocking`으로 작동한다:
```rust
pub(crate) async fn asyncify<F, T>(f: F) -> io::Result<T>
where
    F: FnOnce() -> io::Result<T> + Send + 'static,
    T: Send + 'static,
{
    match spawn_blocking(f).await {
        Ok(res) => res,
        Err(_) => Err(io::Error::new(
            io::ErrorKind::Other,
            "background task failed",
        )),
    }
}
```

`spawn_blocking`은 심각한 성능 영향을 미친다. 작업을 가능한 한 적은 `spawn_blocking` 호출로 일괄 처리하는 것이 좋다.
- **`String/Vec<u8>`에 쓰기**:
  ```rust
  // recommend
  let mut contents = String::new();

  contents.push_str("First line.\n");
  contents.push_str("Second line.\n");
  contents.push_str("Third line.\n");

  tokio::fs::write("my_file.txt", contents.as_bytes()).await?;

  // not recommend
  tokio::fs::write("my_file.txt", "First line.\n".as_bytes()).await?;
  tokio::fs::write("my_file.txt", "Second line.\n".as_bytes()).await?;
  tokio::fs::write("my_file.txt", "Third line.\n".as_bytes()).await?;
  ```
- **`BufReader/BufWriter` 사용**: `BufReader/BufWriter`는 많은 작은 읽기 또는 쓰기를 몇 개의 큰 읽기/쓰기로 버퍼링하는 것을 지원한다. `File::set_max_buf_size`를 호출하여 Tokio의 `File`이 단일 `spawn_blocking` 호출에서 읽거나 쓸 최대 바이트 양을 제어하며, 기본값은 `2MB`이다.
  ```rust
  use tokio::fs::File;
  use tokio::io::{AsyncWriteExt, BufWriter};

  let mut file = BufWriter::new(File::create("my_file.txt").await?);

  file.write_all(b"First line.\n").await?;
  file.write_all(b"Second line.\n").await?;
  file.write_all(b"Third line.\n").await?;

  // Due to the BufWriter, the actual write and spawn_blocking
  // call happens when you flush.
  file.flush().await?;
  ```
- **`spawn_blocking` 내에서 수동으로 `std::fs` 사용**:
  ```rust
  use std::fs::File;
  use std::io::{self, Write};
  use tokio::task::spawn_blocking;

  spawn_blocking(move || {
      let mut file = File::create("my_file.txt")?;

      file.write_all(b"First line.\n")?;
      file.write_all(b"Second line.\n")?;
      file.write_all(b"Third line.\n")?;

      // Unlike Tokio's file, the std::fs file does
      // not need flush.

      io::Result::Ok(())
  }).await.unwrap()?;
  ```

### 3.3 io
Tokio는 `std::io::Read/Write`를 모델로 한 자체 트레이트(`tokio::io`에 있음)를 제공하지만 비동기식이다:
```rust
pub trait AsyncRead {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>
    ) -> Poll<io::Result<()>>;
}

pub trait AsyncWrite {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>>;

    fn poll_flush(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>>;

    fn poll_shutdown(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>>;
}
```

표준 라이브러리에서 `Read`와 `Write`를 구현하는 대부분의 타입은 `AsyncRead`와 `AsyncWrite`를 구현하는 tokio의 비동기 대응물을 가지고 있다, 예를 들어 `File`과 `TcpStream`.

위의 모든 함수는 `Poll`을 반환한다:
- **`Poll::Ready(Ok(...))`** → 작업 완료
- **`Poll::Pending`** → 아직 준비되지 않음; 런타임이 나중에 작업을 깨워야 함

> 런타임은 이러한 함수를 어떻게 호출하는가?

런타임 자체는 `poll_read/poll_write`를 직접 호출하지 않는다. 대신:
1. 고수준 비동기 함수 호출(`AsyncReadExt/AsyncWriteExt`의 함수는 각각 AsyncRead와 AsyncWrite를 구현하는 모든 값에 대해 자동으로 구현된다, 예를 들어 `AsyncReadExt::read`)
    ```rust
    use tokio::fs::File;
    use tokio::io::{self, AsyncReadExt};

    #[tokio::main]
    async fn main() -> io::Result<()> {
        let mut f = File::open("foo.txt").await?;
        let mut buffer = [0; 10];

        // read up to 10 bytes
        let n = f.read(&mut buffer[..]).await?;

        println!("The bytes: {:?}", &buffer[..n]);
        Ok(())
    }
    ```
2. 그 비동기 함수는 폴링될 때 다음과 같은 `Future`를 빌드한다:
   - 기본 I/O 객체(`TcpStream` 등)에서 `poll_read/poll_write`를 호출한다
   - `Poll::Pending`을 반환하면, future는 작업의 `Waker`를 리액터에 **등록**한다
3. Tokio의 리액터(`epoll/kqueue/IOCP` 기반)는 파일 디스크립터의 준비 상태를 모니터링한다
   - OS가 "소켓 읽기 가능" 또는 "쓰기 가능"을 신호하면, Tokio는 `Waker::wake()`를 호출한다
   - 이는 `poll_read/poll_write`에서 차단된 작업을 깨운다
4. executor(`tokio::runtime`)는 그런 다음 Future를 다시 폴링하고, 이제 `poll_read/poll_write` 호출이 성공할 것이다

`f.read(&mut buffer[..]).await?`의 흐름:
1. `read()`: `Future`이고 `poll`이 `poll_read`를 감싸는 `Read` 객체를 반환한다:
    ```rust
    pub(crate) fn read<'a, R>(reader: &'a mut R, buf: &'a mut [u8]) -> Read<'a, R>
    where
        R: AsyncRead + Unpin + ?Sized,
    {
        Read {
            reader,
            buf,
            _pin: PhantomPinned,
        }
    }

    pub struct Read<'a, R: ?Sized> {
        reader: &'a mut R,
        buf: &'a mut [u8],
        // Make this future `!Unpin` for compatibility with async trait methods.
        #[pin]
        _pin: PhantomPinned,
    }

    impl<R> Future for Read<'_, R>
    where
        R: AsyncRead + Unpin + ?Sized,
    {
        type Output = io::Result<usize>;

        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<usize>> {
            let me = self.project();
            let mut buf = ReadBuf::new(me.buf);
            // inner call poll_read()
            ready!(Pin::new(me.reader).poll_read(cx, &mut buf))?;
            Poll::Ready(Ok(buf.filled().len()))
        }
    }
    ```
2. 런타임이 그 Future(`Read`)를 폴링한다
   - `File::poll_read` 호출
   - 사용 가능한 데이터가 없으면 `Poll::Pending` 반환
   - Future는 현재 작업의 `Waker`를 리액터(`mio`<sup>[5]</sup>)에 등록한다
3. 리액터는 `fd` 읽기 가능 신호 이벤트를 기다린다
4. 런타임이 작업을 깨우고, Future를 다시 폴링한다
5. 이번에는 poll_read()가 성공하고 `Poll::Ready`를 반환한다

바이트 기반 인터페이스는 다루기 어렵고 비효율적일 수 있으므로, tokio는 `std::io::BufRead` 트레이트의 비동기 버전인 `AsyncBufRead`와 비동기 `BufReader` 및 `BufWriter` 구조체를 제공한다.
```rust
use tokio::io::{self, BufReader, AsyncBufReadExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let f = File::open("foo.txt").await?;
    let mut reader = BufReader::new(f);
    let mut buffer = String::new();

    // read a line into buffer
    reader.read_line(&mut buffer).await?;

    println!("{}", buffer);
    Ok(())
}
```
```rust
use tokio::io::{self, BufWriter, AsyncWriteExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let f = File::create("foo.txt").await?;
    {
        let mut writer = BufWriter::new(f);

        // Write a byte to the buffer.
        writer.write(&[42u8]).await?;

        // Flush the buffer before it goes out of scope.
        writer.flush().await?;

    } // Unless flushed or shut down, the contents of the buffer is discarded on drop.

    Ok(())
}
```

### 3.4 net
Tokio는 `std`와 유사한 TCP/UDP/Unix 네트워킹 타입을 포함하며, 네트워킹 프로토콜을 구현하는 데 사용할 수 있다. `tokio::net`은 `mio`를 기반으로 한다.

> TCP

`tokio::net::TcpListener`는 TCP 소켓 서버를 추상화하여 연결을 수신 대기한다.
```rust
pub struct TcpListener {
    io: PollEvented<mio::net::TcpListener>,
}
```

주소를 바인딩하고 연결을 수락한다:
```rust
use tokio::net::TcpListener;

use std::io;

async fn process_socket<T>(socket: T) {
    // do work with socket here
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;

    loop {
        let (socket, _) = listener.accept().await?;
        process_socket(socket).await;
    }
}
```
`tokio::net::TcpStream`은 로컬 소켓과 원격 소켓 사이의 스트림을 추상화한다. `tokio::net::TcpStream`은 또한 `AsyncRead`와 `AsyncWrite` 트레이트를 구현한다.
```rust
use tokio::net::TcpStream;
use tokio::io::AsyncWriteExt;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Connect to a peer
    let mut stream = TcpStream::connect("127.0.0.1:8080").await?;

    // Write some data.
    stream.write_all(b"hello world!").await?;

    Ok(())
}
```

> UDP

`tokio::net::UdpSocket`은 UDP 소켓을 추상화한다. tokio에서 UdpSocket을 사용하는 기본적으로 두 가지 주요 방법이 있다:
- **일대다**: `bind` 포트하고 `send_to`와 `recv_from`을 사용하여 여러 다른 주소와 통신한다
- **일대일**: `connect`하고 단일 주소와 연관시켜 `send`와 `recv`를 사용하여 해당 원격 주소와만 통신한다
```rust
pub struct UdpSocket {
    io: PollEvented<mio::net::UdpSocket>,
}
```

일대다:
```rust
use tokio::net::UdpSocket;
use std::io;

#[tokio::main]
async fn main() -> io::Result<()> {
    let sock = UdpSocket::bind("0.0.0.0:8080").await?;
    let mut buf = [0; 1024];
    loop {
        let (len, addr) =