---
title: Tokio
category: Tech
tag: Rust
date: 2025-08-28T00:33:49+08:00
---


# Tokio - The Best Asynchronous Runtime of Rust
## Part 1 Asynchronous vs Synchronous
What is synchronous programming and asynchronous programming?
Synchronous thinking is the most nature thinking way of humans. Think about this scenario: you are hungry and want to buy some food to eat, then you walk into a restaurant queue up for food. So you wait in line until it's your turn, then pay for your meal.
The sequence of events:
1. Feel hungry
2. Wait some mins in line 😥
3. Pay for meal
4. Start eating after meal is ready!

In synchonous programming, every events happened sequentially, blocking the next operation until the current one completes. `sync` really matchs human thinking way, it's simpler to write and debug. But sometimes it **slow down** the code's run speed.

But it's totally different in asynchonous world. See the sequence of events:
1. Feel hungry
2. No need to queue up, scan QR-code and input your table number to order online 😊
3. You can do something else before waiter send you meal when it's ready
4. Start eating after meal is ready!

This is the biggest difference between synchronous and asynchronous?
- Synchronous: **Always pay attention to (blocking waiting or polling)** blocked tasks
- Asynchronous: Need to receive completion notification of the blocked task and **execute other non-blocking tasks** during the waiting period

Here’s a clear comparison of Synchronous vs Asynchronous in a table:
| Aspect                    | **Synchronous**                                                                      | **Asynchronous**                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Definition**            | Tasks are executed one after another; each must finish before the next begins.       | Tasks can start and continue without waiting for others to finish.                                               |
| **Execution Flow**        | Blocking: one task blocks the execution of others until it completes.              | Non-blocking: tasks can run independently or in parallel.                                                      |
| **Waiting**               | Caller waits for the operation to finish before moving on.                           | Caller does not wait; it can proceed with other work.                                                            |
| **Performance**           | Slower in scenarios with I/O or network delays since CPU is idle during waits.       | Faster and more efficient for I/O-bound operations, since CPU can work on other tasks meanwhile.                 |
| **Complexity**            | Simple to write, understand, and debug.                                              | More complex due to callbacks, promises, or async/await handling.                                                |
| **Use Cases**             | Suitable for small programs, tasks that must run sequentially, CPU-bound operations. | Suitable for networking, file I/O, database queries, user interfaces, high concurrency systems.                  |
| **Example (Programming)** | Function returns result directly after completion.                                   | Function may return a *promise*, *future*, or use callbacks/events to deliver result later.                      |
| **Analogy**               | Standing in line at a cashier; you wait until the person in front of you finishes.   | Dropping off clothes at the dry cleaner; you leave and do other things while they work, then pick them up later. |

## Part 2 Async in Rust std
Rust offers the standard support for *asynchronous programming*: Rust’s Futures, Streams, the `async` and `await` syntax. The key elements of asynchronous programming in Rust are futures and `async/await` keywords<sup>[1]</sup>.

Keyword:
- `async`: Apply to blocks and functions to specify that they can be interrupted and resumed
- `await`: Within an async block/function, use await to *await* a *future*(wait for it to become ready)

Core Traits:
- `Future`: As mentioned in [Part 1](#part-1-asynchronous-vs-synchronous), after you place your order online, the waiter will place the food on the table corresponding to the table number you selected. Like the table number, a *future* is a value that **may not be ready** now but **will become ready** at some point in the future. Rust provides a `Future` trait as a building block so that different async operations can be implemented with different data structures but with a common interface.
  ```rust
    pub trait Future {
        /// The type of value produced on completion.
        type Output;

        /// Attempts to resolve the future to a final value, registering
        /// the current task for wakeup if the value is not yet available.
        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
    }
  ```
- `Poll<T>`: enum with `Ready(T)` or `Pending`.
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
- `Context` + `Waker`: mechanism to wake tasks when they’re ready.

The standard library does not provide an executor, but provides the all foundations for implementing asynchronous runtimes or asynchronous I/O. To date, `tokio` is still the best and most widely used asynchronous runtime in the Rust ecosystem.

## Part 3 tokio Asynchronous Runtime
`tokio`<sup>[2]</sup> is an asynchronous runtime for the Rust programming language. It provides the necessary infrastructure to execute asynchronous code efficiently, enabling the development of high-performance, concurrent applications, especially in networking. 

> `tokio` provides the same modules as std but using asynchronous implementation.

### 3.1 runtime
Asynchronous applications require runtime support. In particular, the following runtime services are necessary:
- An **I/O event loop**, called the driver, which drives I/O resources and dispatches I/O events to tasks that depend on them.
- A **scheduler** to execute tasks that use these I/O resources.
- A **timer** for scheduling work to run after a set period of time.

Tokio's runtime provides all of features as a single type: **[Runtime](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html)**.

> Create

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

The runtime's entry point is [`block_on()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.block_on). The future running in `block_on()` does not run as a worker(like the TcpListener loop). All other futures from the `block_on()`'s future provided here will spawned as workers.

Tokio provides **Multi-Thread Scheduler** and **Current-Thread Scheduler**. The multi-thread scheduler executes futures on a *thread pool*, using a work-stealing strategy, default start a worker thread for each CPU core available. The current-thread scheduler provides a *single-threaded* future executor. All tasks will be created and executed on the current thread.
```rust
use tokio::runtime;

// Multi-Thread Scheduler
let rt = runtime::Runtime::new()?;

// Current-Thread Scheduler
let rt = runtime::Builder::new_current_thread()
    .build()?;
```

And Tokio give a more easy way to create runtime by macro, see [macro](#38-macro).

> Schedule

A *task* is a light weight, non-blocking unit of execution. A task is similar to an OS thread, but rather than being managed by OS scheduler, they are managed by the Tokio runtime<sup>[3]</sup>.

The key features of tasks:
1. **Light weight**: Creating, running, switching and destroying large numbers of tasks is quite cheap, especially compared to OS threads
2. **Cooperatively**: When a task yields, the Tokio runtime switches to executing the next task
3. **Non-blocking**: Tokio provides APIs for running blocking operations in an asynchronous context

Runtime keeping schedule task(by calling `poll`) until the collection of tasks is empty and then go sleep. Tokio's runtime provides the following fairness guarantee to prevent *task starve*: If the total number of tasks does not grow without bound, and no task is blocking the thread, then it is guaranteed that tasks are scheduled fairly. Under the following two assumptions:
- There is some number `MAX_TASKS` such that the total number of tasks on the runtime at any specific point in time never exceeds `MAX_TASKS`
- There is some number `MAX_SCHEDULE` such that calling `poll` on any task spawned on the runtime returns within `MAX_SCHEDULE` time units

`MAX_TASKS` and `MAX_SCHEDULE` can be any number and the user of the runtime may choose them. Basic on `MAX_TASKS` and `MAX_SCHEDULE`, tokio's runtime inner keep a `MAX_DELAY` such that when a task is woken, it will be scheduled by the runtime within `MAX_DELAY` time units.

But tokio has no guarantee that the runtime is equally fair to all tasks. For tasks, tokio do not guarantee all of the tasks get the same scheduled times, but everyone will scheduled eventually.

Runtime also manage IO resources and timers. Runtime periodically checking whether there are any IO resources or timers that are ready, and waking the relevant task so that it will be scheduled. These checks are performed periodically **between scheduling tasks**. Tokio guarantees that it will wake tasks with an IO or timer event within some maximum number of time units.

- **Current thread runtime logic**: 
  1. **Task queue**
     * 2 FIFO queue：**local**、**global**
     * scheduling rules：
       * prefer to choose the next task to schedule from the local queue
       * the local queue is empty, or if it has picked a task from the local queue **31**(`global_queue_interval`, default `31`) times in a row → pick a task from the global queue
  2. **IO/Scheduler check**
     * whenever there are **no tasks** ready to be scheduled, or when it has scheduled **61**(`event_interval`, default `61`) tasks in a row → check for new IO or timer events
  3. **Task woken rule**
     * task woken from within a task running on the runtime → added to **local queue**
     * task woken from outside → added to **global queue**

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
- **Multi threaded runtime logic**:
  1. **Workers & Queues**
     * Fixed number of worker threads (created at startup).
     * Each worker has:
       * **Local queue** (max 256 tasks).
         * If exceeded → half of tasks moved to **global queue**.
       * **LIFO slot** (special optimization).
     * Shared **global queue**.
  2. **Task Scheduling Priority**
     * Prefer **local queue**.
     * Use **global queue** if local is empty, or after `global_queue_interval` picks from local.
     * Default `global_queue_interval` is dynamically computed (\~10ms between global queue checks).
  3. **Work Stealing**
     * If both local & global queues are empty → steal half of tasks from another worker’s local queue.
  4. **Event Checking**
     * Check for IO/timers if:
       * No tasks are ready, OR
       * Scheduled 61 tasks in a row (`event_interval` configurable).
  5. **LIFO Slot Optimization**
     * If task wakes another task → place in **LIFO slot** (instead of queue).
     * If LIFO already full → displaced task goes to local queue.
     * When finishing a task → schedule from LIFO immediately (if available).
     * Coop budget not reset when LIFO is used.
     * If LIFO used 3 times in a row → temporarily disabled until a non-LIFO task runs.
     * Can be disabled (`disable_lifo_slot`).
     * **Note**: LIFO is per-thread; cannot be stolen by others.
  6. **Task Wakeup from Non-worker Thread**
     * Woken tasks are placed in **global queue**.

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

> Shutdown

We can shutdown a runtime by calling `drop()`, or calling [`shutdown_background()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_background) or [`shutdown_timeout()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_timeout).
- `shutdown_background()`: Shuts down the runtime, without waiting for any spawned work to stop.
- `shutdown_timeout()`: Shuts down the runtime, waiting for at most duration for all spawned work to stop.

Once the runtime has been dropped, any outstanding I/O resources bound to it will no longer function. Calling any method on them will result in an error.

Tasks which are spawned by `Runtime::spawn` are not *guaranteed* to run to completion, and those are spawned by `Runtime::spawn_blocking` will keep running until they return.

> Share

- Using an `Arc<Runtime>`: prevent the runtime from shutting down, shutdown runtime when **only one** strong count reference is left over
- Using a [`Handle`](https://docs.rs/tokio/latest/tokio/runtime/struct.Handle.html): not prevent the runtime from shutting down
- Entering the runtime context by `Runtime::enter` or `Handle::enter`: use a thread-local variable to store the current runtime, any methods such as `tokio::spawn` will use the runtime whose context you are inside

### 3.2 fs
Tokio use blocking file operations implement asynchronous utility methods for working with the file system, includes reading/writing to files and working with directories. Tokio always use `spawn_blocking` on all platforms<sup>[4]</sup>.

Let's see the detail of `tokio::fs::read()`:
```rust
/// This is an async version of [`std::fs::read`].
pub async fn read(path: impl AsRef<Path>) -> io::Result<Vec<u8>> {
    let path = path.as_ref().to_owned();
    asyncify(move || std::fs::read(path)).await
}
```
In fact, `tokio::fs::read()` is an async version of `std::fs::read()`. Inner function `asyncify` is working by `spawn_blocking`:
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

`spawn_blocking` has serious performance consequences. It is recommended to batch your operations into as few `spawn_blocking` calls as possible.
- **Write into `String/Vec<u8>`**: 
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
- **Use `BufReader/BufWriter`**: `BufReader/BufWriter` support buffer many small reads or writes into a few large ones. Call `File::set_max_buf_size` to controls the maximum amount of bytes that Tokio’s `File` will read or write in a single `spawn_blocking` call, default `2MB`.
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
- **Manually use `std::fs` inside `spawn_blocking`**:
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
Tokio provides its own traits (in `tokio::io`), modeled after `std::io::Read/Write`, but async:
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

Most types in the standard library that implement `Read` and `Write` have asynchronous equivalents in tokio that implement `AsyncRead` and `AsyncWrite`, such as `File` and `TcpStream`.

Above of all functions returns `Poll`:
- **`Poll::Ready(Ok(...))`** → operation completed
- **`Poll::Pending`** → not ready yet; runtime must wake the task later

> How the runtime calls those functions?

The runtime itself never calls `poll_read/poll_write` directly. Instead:
1. Call a high-level async function(those functions in `AsyncReadExt/AsyncWriteExt` are automatically implemented for all values that implement AsyncRead and AsyncWrite respectively, like `AsyncReadExt::read`)
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
2. That async function builds a `Future` that, when polled:
   - Call `poll_read/poll_write` on the underlying I/O object (`TcpStream` etc)
   - If it returns `Poll::Pending`, the future **registers** the task’s `Waker` with the reactor
3. Tokio’s reactor (based on `epoll/kqueue/IOCP`) monitors readiness of file descriptors
   - When the OS signals "socket readable" or "writable", Tokio calls `Waker::wake()`
   - This wakes the task that was blocked on `poll_read/poll_write`
4. The executor (`tokio::runtime`) then re-polls the Future, and now the `poll_read/poll_write` call will succeed

Flow of `f.read(&mut buffer[..]).await?`:
1. `read()`: return a `Read` object which is a `Future` and its `poll` wrapping `poll_read`:
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
2. Runtime polls that Future(`Read`)
   - call `File::poll_read`
   - if no data available, return `Poll::Pending`
   - Future registers current task’s `Waker` with reactor(`mio`<sup>[5]</sup>)
3. Reactor waits for `fd` readable signal event
4. Runtime wakes the task, poll the Future again
5. This time poll_read() succeeds, returns `Poll::Ready`

Byte-based interfaces are unwieldy and can be inefficient, so tokio provides an async version of the `std::io::BufRead` trait, `AsyncBufRead`; and async `BufReader` and `BufWriter` structs.
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
Tokio contains the TCP/UDP/Unix networking types, similar to the `std`, which can be used to implement networking protocols. `tokio::net` is based on `mio`.

> TCP

`tokio::net::TcpListener` abstract the TCP socket server, listening for connections. 
```rust
pub struct TcpListener {
    io: PollEvented<mio::net::TcpListener>,
}
```

Bind a addr and accept connect:
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
`tokio::net::TcpStream` abstract the stream between a local and a remote socket. `tokio::net::TcpStream` also implement the `AsyncRead` and `AsyncWrite` trait.
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

`tokio::net::UdpSocket` abstract the UDP socket. In tokio there are basically two main ways to use UdpSocket:
- **one to many**: `bind` port and use `send_to` and `recv_from` to communicate with many different addresses
- **one to one**: `connect` and associate with a single address, using `send` and `recv` to communicate only with that remote address
```rust
pub struct UdpSocket {
    io: PollEvented<mio::net::UdpSocket>,
}
```

One to many:
```rust
use tokio::net::UdpSocket;
use std::io;

#[tokio::main]
async fn main() -> io::Result<()> {
    let sock = UdpSocket::bind("0.0.0.0:8080").await?;
    let mut buf = [0; 1024];
    loop {
        let (len, addr) = sock.recv_from(&mut buf).await?;
        println!("{:?} bytes received from {:?}", len, addr);

        let len = sock.send_to(&buf[..len], addr).await?;
        println!("{:?} bytes sent", len);
    }
}
```

One to one:
```rust
use tokio::net::UdpSocket;
use std::io;

#[tokio::main]
async fn main() -> io::Result<()> {
    let sock = UdpSocket::bind("0.0.0.0:8080").await?;

    let remote_addr = "127.0.0.1:59611";
    sock.connect(remote_addr).await?;
    let mut buf = [0; 1024];
    loop {
        let len = sock.recv(&mut buf).await?;
        println!("{:?} bytes received from {:?}", len, remote_addr);

        let len = sock.send(&buf[..len]).await?;
        println!("{:?} bytes sent", len);
    }
}
```

### 3.5 sync
Like but not same `std::sync`, `tokio::sync` provides **more** synchronization primitives in this module to permit independent tasks to communicate together.

> Message passing

The most common form of synchronization in a Tokio program is message passing. Tokio offers many different channel flavors as different message passing patterns are best handled with different implementations.

|             | producer | product  | consumer |
| :-          | :-:      | :-:      | :-:      |
| `oneshot`   | single   | single   | single   |
| `mpsc`      | multiple | multiple | single   |
| `broadcast` | multiple | multiple | multiple |
| `watch`     | multiple | multiple | multiple |

- `broadcast`: Each consumer will receive **each** value.
- `watch`: Only the **most recent** value is stored in the channel. There is no guarantee that consumers will see **all** values. The `watch channel` is similar to a `broadcast channel` with capacity 1.

Example: use a watch channel to notify tasks of configuration changes.
```rust
use tokio::sync::watch;
use tokio::time::{self, Duration, Instant};

use std::io;

#[derive(Debug, Clone, Eq, PartialEq)]
struct Config {
    timeout: Duration,
}

impl Config {
    async fn load_from_file() -> io::Result<Config> {
        // file loading and deserialization logic here
    }
}

async fn my_async_operation() {
    // Do something here
}

#[tokio::main]
async fn main() {
    // Load initial configuration value
    let mut config = Config::load_from_file().await.unwrap();

    // Create the watch channel, initialized with the loaded configuration
    let (tx, rx) = watch::channel(config.clone());

    // Spawn a task to monitor the file.
    tokio::spawn(async move {
        loop {
            // Wait 10 seconds between checks
            time::sleep(Duration::from_secs(10)).await;

            // Load the configuration file
            let new_config = Config::load_from_file().await.unwrap();

            // If the configuration changed, send the new config value
            // on the watch channel.
            if new_config != config {
                tx.send(new_config.clone()).unwrap();
                config = new_config;
            }
        }
    });

    let mut handles = vec![];

    // Spawn tasks that runs the async operation for at most `timeout`. If
    // the timeout elapses, restart the operation.
    //
    // The task simultaneously watches the `Config` for changes. When the
    // timeout duration changes, the timeout is updated without restarting
    // the in-flight operation.
    for _ in 0..5 {
        // Clone a config watch handle for use in this task
        let mut rx = rx.clone();

        let handle = tokio::spawn(async move {
            // Start the initial operation and pin the future to the stack.
            // Pinning to the stack is required to resume the operation
            // across multiple calls to `select!`
            let op = my_async_operation();
            tokio::pin!(op);

            // Get the initial config value
            let mut conf = rx.borrow().clone();

            let mut op_start = Instant::now();
            let sleep = time::sleep_until(op_start + conf.timeout);
            tokio::pin!(sleep);

            loop {
                tokio::select! {
                    _ = &mut sleep => {
                        // The operation elapsed. Restart it
                        op.set(my_async_operation());

                        // Track the new start time
                        op_start = Instant::now();

                        // Restart the timeout
                        sleep.set(time::sleep_until(op_start + conf.timeout));
                    }
                    _ = rx.changed() => {
                        conf = rx.borrow_and_update().clone();

                        // The configuration has been updated. Update the
                        // `sleep` using the new `timeout` value.
                        sleep.as_mut().reset(op_start + conf.timeout);
                    }
                    _ = &mut op => {
                        // The operation completed!
                        return
                    }
                }
            }
        });

        handles.push(handle);
    }

    for handle in handles.drain(..) {
        handle.await.unwrap();
    }
}
```

How `mpsc` work?

Struct of `Chan`:
```rust
pub(super) struct Chan<T, S> {
    /// Handle to the push half of the lock-free list.
    tx: CachePadded<list::Tx<T>>,

    /// Receiver waker. Notified when a value is pushed into the channel.
    rx_waker: CachePadded<AtomicWaker>,

    /// Notifies all tasks listening for the receiver being dropped.
    notify_rx_closed: Notify,

    /// Coordinates access to channel's capacity.
    semaphore: S,

    /// Tracks the number of outstanding sender handles.
    ///
    /// When this drops to zero, the send half of the channel is closed.
    tx_count: AtomicUsize,

    /// Tracks the number of outstanding weak sender handles.
    tx_weak_count: AtomicUsize,

    /// Only accessed by `Rx` handle.
    rx_fields: UnsafeCell<RxFields<T>>,
}
```
- `tx: CachePadded<list::Tx<T>>`: 
  - *lock-free* list, all of `Sender` push value into the list.
  - Multiple producers thread safety, inner use atomic ptr/index([Michael–Scott Lock-free Queue](https://www.cs.rochester.edu/u/scott/papers/1996_PODC_queues.pdf))
  - Put frequently written `tx` into a separate cache line(`CachePadded`) to reduce false sharing with other atomic fields
- `rx_waker: CachePadded<AtomicWaker>`: 
  - `Receiver` register own `Waker` in `poll_recv`: when queue from empty into non-empty, call `waker` to wake up `rx`
  - Use `AtomicWaker`: lock-free waker registration/replacement to avoid locking on hot paths
- `notify_rx_closed: Notify`:
  - When `rx` is dropped, wake up all `tx` that wait for sending task, notify `tx` fail and exit as soon as possible
- `semaphore: S`: 
  - Capacity coordination/back pressure. 1 permit must be obtained before sending, and 1 permit must be released after receiving.
  - Generic `S`: Allows "bounded" and "unbounded" implementations to share the same kernel. "bounded" `S` inner object usually is `tokio::sync::Semaphore`; "unbounded" `S` implemented as a no-op (always successfully retrieved) to eliminate backpressure overhead
- `tx_count: AtomicUsize`: 
  - Strong reference count of the sender: Drops to 0 -> sender is closed
- `tx_weak_count: AtomicUsize`: 
  - Weak reference Sender count
- `rx_fields: UnsafeCell<RxFields<T>>`:
  - A complete set of receive-side state accessible only by the receiver Rx (e.g. pop-side `list::Rx<T>`, local cache/batch settings, shutdown flags, etc.)
  - `UnsafeCell`: `Chan` is shared across multiple threads using `Arc`, but it is agreed that only the receiving thread will touch these fields; `UnsafeCell` is used to bypass the compiler's alias mutability restrictions, while relying on **invariants** to ensure thread safety

`mpsc` send-recv workflow:
![send-recv](https://i.postimg.cc/VvBM0Nzm/Tokio-mpsc-flow.png)

Cross-thread safety and high perforemance:
- **`Arc<Chan<..>>`**: multi-thread safe sharing; lifecycle is managed by reference counting
- ***lock-free* queue**: multiple producers push concurrently, and the receiver pops in a single thread, avoiding global locks
- **Wake-up mechanism isolation**: 
  - `rx_waker`: "data available to read" events
  - `notify_rx_closed`: "receiver closed" event, wake up all waiters
- **`CachePadded`**: isolate hot atoms such as `tx` and `rx_waker` from other states in different cache lines, reduce cache jitter
- **Strict memory order**: push/pop uses Acquire/Release/CAS to ensure cross-core visibility and ordering

> State synchronization

The remaining synchronization primitives focus on synchronizing state. These are asynchronous equivalents to versions provided by `std`. They operate in a similar way as their `std` counterparts but will wait asynchronously instead of blocking the thread.

- `Barrier` Ensures multiple tasks will wait for each other to reach a point in the program, before continuing execution all together.
- `Mutex` Mutual Exclusion mechanism, which ensures that at most one thread at a time is able to access some data.
- `Notify` Basic task notification. Notify supports notifying a receiving task without sending data. In this case, the task wakes up and resumes processing.
- `RwLock` Provides a mutual exclusion mechanism which allows multiple readers at the same time, while allowing only one writer at a time. In some cases, this can be more efficient than a mutex.
- `Semaphore` Limits the amount of concurrency. A semaphore holds a number of permits, which tasks may request in order to enter a critical section. Semaphores are useful for implementing limiting or bounding of any kind.

All synchronization primitives provided by `tokio::sync` can be moved freely between different instances of the Tokio runtime or even use them from non-Tokio runtimes.

The core reason synchronization primitives(like `tokio::sync::Mutex<T>`) can be safely moved and shared between threads is that it stores the data internally in `UnsafeCell<T> `(allowing safe mutable aliasing) and uses a thread-safe `semaphore`(permit) to enforce mutual exclusion and wakeup. The source code restricts the implementation conditions of `Send/Sync` to `T: Send` through unsafe impl, and uses `acquire/release` synchronization semantics to ensure that access to `T` does not cause data races.

Workflow of `tokio::sync::Mutex<T>`:
![tokio::sync::Mutex<T>](https://i.postimg.cc/X7t75QM2/Tokio-mutex-flow.png)

So which type of `sync` between `std` and `tokio` should we choose?
1. `std` first: use `std::sync` implement function
2. check function logic: if `std::sync` cannot pass the compile runtime check, think about the `tokio::sync`; if `std::sync` will create a *dead-lock* or **an unacceptable blocking**, turn it into `tokio::sync`
3. check type of value wrapped by `sync`: if the value wrapped by `sync` belongs to I/O resources, conside change `sync` from `std` to `tokio`; if the value wrapped by `sync` is one kind of data object, keep using `std` will get a higher performance

### 3.6 stream
`Stream` is not included in `tokio`'s 1.0 release<sup>[6]</sup>.

### 3.7 time
This module provides a number of types for executing code after a set period of time.

- `Sleep` is a future that does no work and completes at a specific Instant in time.
    ```rust
    use std::time::Duration;
    use tokio::time::sleep;

    #[tokio::main]
    async fn main() {
        sleep(Duration::from_millis(100)).await;
        println!("100 ms have elapsed");
    }
    ```
- `Interval` is a stream yielding a value at a fixed period. It is initialized with a Duration and repeatedly yields each time the duration elapses.
    ```rust
    use tokio::time;

    async fn task_that_takes_a_second() {
        println!("hello");
        time::sleep(time::Duration::from_secs(1)).await
    }

    #[tokio::main]
    async fn main() {
        let mut interval = time::interval(time::Duration::from_secs(2));
        for _i in 0..5 {
            interval.tick().await;
            task_that_takes_a_second().await;
        }
    }
    ```
- `Timeout`: Wraps a future or stream, setting an upper bound to the amount of time it is allowed to execute. If the future or stream does not complete in time, then it is canceled and an error is returned.
    ```rust
    use tokio::time::{timeout, Duration};

    async fn long_future() {
        // do work here
    }

    let res = timeout(Duration::from_secs(1), long_future()).await;

    if res.is_err() {
        println!("operation timed out");
    }
    ```

### 3.8 macro
> Attribute Macro

Tokio provides two attribute macros to helps set up a `Runtime` without requiring the user to use `Runtime` or `Builder` directly:

- `#[main]`: Marks async function to be executed by the selected runtime. The async function marked with this macro does not run as a worker
  - `Multi-threaded runtime`:
    ```rust
    #[tokio::main(flavor = "multi_thread", worker_threads = 10)]

    // Equivalent code not using #[tokio::main]
    fn main() {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(10)
            .build()
            .unwrap().block_on(async {
                println!("Hello world");
            })
    }
    ```
  - `Current thread runtime`:
    ```rust
    #[tokio::main(flavor = "current_thread")]

    // Equivalent code not using #[tokio::main]
    fn main() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                println!("Hello world");
            })
    }
    ```
- `#[test]`: Suitable to test environment
  - `Multi-threaded runtime`:
    ```rust
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn my_test() {
        assert!(true);
    }

    // Equivalent code not using #[tokio::test]
    #[test]
    fn my_test() {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(1)
            .build()
            .unwrap()
            .block_on(async {
                assert!(true);
            })
    }
    ```
  - `Current thread runtime`:
    ```rust
    #[tokio::test]
    async fn my_test() {
        assert!(true);
    }

    // Equivalent code not using #[tokio::test]
    #[test]
    fn my_test() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                assert!(true);
            })
    }
    ```

> Macros

- `join!`: Waits on multiple concurrent branches, returning when all branches complete. By default, `join!` is fair with all futures, that mean future is polled more faster when it is woken more faster. Use `biased` control `join!` poll future from top to bottom.
    ```rust
    async fn do_stuff_async() {
        // async work
    }

    async fn more_async_work() {
        // more here
    }

    #[tokio::main]
    async fn main() {
        let (first, second) = tokio::join!(
            biased;
            do_stuff_async(),
            more_async_work()
        );

        // do something with the values
    }
    ```
- `try_join!`: Waits on multiple concurrent branches, returning when all branches complete with `Ok(_)` or on the first `Err(_)`. Same as `join!`, use `biased` control the polling order.
- `pin!`<sup>[7]</sup>: Pins a value on the stack. Most asynchronous tasks require self-reference, if the `Future` is moved arbitrarily, the pointer stored in it may become invalid, so `Future` usually requires: `Pin<&mut Future>`. There are two common situations:
  - work with `tokio::select!`:
    ```rust
    use tokio::{pin, select, time};

    #[tokio::main]
    async fn main() {
        let sleep1 = time::sleep(std::time::Duration::from_secs(1));
        let sleep2 = time::sleep(std::time::Duration::from_secs(2));

        pin!(sleep1);
        pin!(sleep2);

        select! {
            _ = &mut sleep1 => println!("sleep1 done"),
            _ = &mut sleep2 => println!("sleep2 done"),
        }
    }
    ```
  - poll `Future` handly:
    ```rust
    use tokio::pin;
    use std::future::Future;
    use std::task::{Context, Poll};
    use std::pin::Pin;

    async fn work() {}

    fn main() {
        let fut = work();
        pin!(fut);

        let waker = futures::task::noop_waker();
        let mut cx = Context::from_waker(&waker);

        match Future::poll(fut.as_mut(), &mut cx) {
            Poll::Ready(_) => println!("done"),
            Poll::Pending => println!("pending"),
        }
    }
    ```
- `select!`: Waits on multiple concurrent branches, returning when the **first** branch completes, cancelling the remaining branches. By default, `select!` randomly(have a CPU cost) picks a branch to check first. Use `biased` to make `select!` poll the futures in the order they appear from top to bottom. When using select! in a loop to receive messages from multiple sources, there needs user make sure that the receive call is *cancellation safe*<sup>[8]</sup> to avoid losing messages.
    ```rust
    use tokio::sync::mpsc;

    #[tokio::main]
    async fn main() {
        let (tx1, mut rx1) = mpsc::channel(128);
        let (tx2, mut rx2) = mpsc::channel(128);
        let (tx3, mut rx3) = mpsc::channel(128);

        loop {
            let msg = tokio::select! {
                Some(msg) = rx1.recv() => msg,
                Some(msg) = rx2.recv() => msg,
                Some(msg) = rx3.recv() => msg,
                else => { break }
            };

            println!("Got {}", msg);
        }

        println!("All channels have been closed.");
    }
    ```

## Part 4 When Not to Use tokio
Although Tokio is useful for many projects that need to do a lot of things simultaneously, there are also some use-cases where Tokio is not a good fit.
- Speeding up CPU-bound computations by running them in parallel on several threads. Tokio is designed for IO-bound applications where each individual task spends most of its time waiting for IO. If the only thing your application does is run computations in parallel, you should be using [rayon](https://docs.rs/rayon/). That said, it is still possible to "mix & match" if you need to do both. See [this blog post for a practical example](https://ryhl.io/blog/async-what-is-blocking/#the-rayon-crate).
- Reading a lot of files. Although it seems like Tokio would be useful for projects that simply need to read a lot of files, Tokio provides no advantage here compared to an ordinary threadpool. This is because operating systems generally do not provide asynchronous file APIs.
- Sending a single web request. The place where Tokio gives you an advantage is when you need to do many things at the same time. If you need to use a library intended for asynchronous Rust such as `reqwest`, but you don't need to do a lot of things at once, you should prefer the blocking version of that library, as it will make your project simpler. Using Tokio will still work, of course, but provides no real advantage over the blocking API.

Links:
[1]: [The Rust standard library](https://doc.rust-lang.org/stable/std/index.html)
[2]: This blog is base on [tokio-1.47.1](https://docs.rs/tokio/1.47.1/tokio/)
[3]: Another name for this general pattern is [green threads](https://en.wikipedia.org/wiki/Green_threads). Tokio’s tasks as something similar with [Coroutine](https://en.wikipedia.org/wiki/Coroutine)(Go’s goroutines or Kotlin’s coroutines)
[4]: Tokio may be changed to use asynchronous file system APIs such as `io_uring` in the future
[5]: Mio is a fast, low-level I/O library for Rust focusing on non-blocking APIs and event notification for building high performance I/O apps with as little overhead as possible over the OS abstractions. See more [mio](https://docs.rs/mio/1.0.4/mio/index.html)
[6]: Most of the Tokio stream utilities have been moved into the [`tokio-stream`](https://docs.rs/tokio-stream) crate
[7]: If rust version >= 1.68, recommend use `std::pin::pin!` to replace `tokio::pin!`
[8]: Methods are cancellation safe: [list](https://docs.rs/tokio/1.47.1/tokio/macro.select.html#cancellation-safety)
