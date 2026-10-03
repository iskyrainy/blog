---
title: Tokio
category: Tech
tag: Rust
date: 2025-08-28T00:33:49+08:00
---


# Tokio - Rust 最佳的异步运行时
## 第一部分 异步 vs 同步
什么是同步编程和异步编程？
同步思维是人类最自然的思维方式。想象这样一个场景：你饿了，想买点吃的，于是你走进一家餐厅排队取餐。你一直排队等到轮到你，然后为你的餐食付款。
事件顺序：
1. 感到饥饿
2. 排队等了几分钟 😥
3. 为餐食付款
4. 餐食准备好后开始吃！

在同步编程中，每个事件按顺序依次发生，在当前操作完成之前会阻塞下一个操作。`sync` 确实契合人类的思维方式，写起来和调试起来都更简单。但有时它会**拖慢**代码的运行速度。

但在异步世界里则完全不同。看看事件顺序：
1. 感到饥饿
2. 无需排队，扫描二维码并输入你的桌号即可在线点餐 😊
3. 在服务员把餐食准备好送来之前，你可以做别的事情
4. 餐食准备好后开始吃！

这就是同步与异步最大的区别？
- 同步：**始终关注（阻塞等待或轮询）**被阻塞的任务
- 异步：需要接收被阻塞任务的完成通知，并在等待期间**执行其他非阻塞任务**

下面用表格清晰地对比同步与异步：
| 方面                      | **同步**                                                                             | **异步**                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **定义**                  | 任务一个接一个地执行；每个任务必须完成后下一个才开始。                               | 任务可以启动并继续执行，而无需等待其他任务完成。                                                                 |
| **执行流程**              | 阻塞：一个任务会阻塞其他任务的执行，直到它完成。                                     | 非阻塞：任务可以独立或并行运行。                                                                                 |
| **等待**                  | 调用方等待操作完成后才继续。                                                         | 调用方不等待；它可以继续做其他工作。                                                                             |
| **性能**                  | 在存在 I/O 或网络延迟的场景中较慢，因为等待期间 CPU 处于空闲状态。                   | 对于 I/O 密集型操作更快更高效，因为 CPU 可以在此期间处理其他任务。                                               |
| **复杂度**                | 编写、理解和调试都很简单。                                                           | 由于回调、promise 或 async/await 处理而更为复杂。                                                                |
| **使用场景**              | 适用于小型程序、必须顺序运行的任务、CPU 密集型操作。                                 | 适用于网络、文件 I/O、数据库查询、用户界面、高并发系统。                                                         |
| **示例（编程）**          | 函数在完成后直接返回结果。                                                           | 函数可能返回一个 *promise*、*future*，或使用回调/事件在稍后交付结果。                                            |
| **类比**                  | 在收银台前排队；你要等到前面的人结束。                                               | 把衣服送到干洗店；你离开去做别的事情，等他们洗好后再来取。                                                       |

## 第二部分 Rust std 中的异步
Rust 为*异步编程*提供了标准支持：Rust 的 Futures、Streams、`async` 和 `await` 语法。Rust 中异步编程的关键要素是 future 和 `async/await` 关键字<sup>[1]</sup>。

关键字：
- `async`：应用于代码块和函数，指定它们可以被中断和恢复
- `await`：在 async 代码块/函数内部，使用 await 来 *等待* 一个 *future*（等待它变为就绪）

核心 Trait：
- `Future`：正如[第一部分](#第一部分-异步-vs-同步)所述，当你在网上下单后，服务员会把食物放到你所选桌号对应的桌子上。就像桌号一样，*future* 是一个**现在可能尚未就绪**但**在未来某个时刻会变为就绪**的值。Rust 提供了 `Future` trait 作为构建块，使得不同的异步操作可以用不同的数据结构实现，但拥有共同的接口。
  ```rust
    pub trait Future {
        /// The type of value produced on completion.
        type Output;

        /// Attempts to resolve the future to a final value, registering
        /// the current task for wakeup if the value is not yet available.
        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
    }
  ```
- `Poll<T>`：包含 `Ready(T)` 或 `Pending` 的枚举。
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
- `Context` + `Waker`：在任务就绪时唤醒任务的机制。

标准库没有提供执行器（executor），但为实现异步运行时或异步 I/O 提供了所有基础。迄今为止，`tokio` 仍然是 Rust 生态中最好且使用最广泛的异步运行时。

## 第三部分 tokio 异步运行时
`tokio`<sup>[2]</sup> 是 Rust 编程语言的异步运行时。它提供了高效执行异步代码所需的基础设施，能够开发高性能、并发的应用，尤其是在网络方面。

> `tokio` 提供了与 std 相同的模块，但使用异步实现。

### 3.1 runtime
异步应用需要运行时支持。具体来说，需要以下运行时服务：
- 一个 **I/O 事件循环**，称为 driver，它驱动 I/O 资源并将 I/O 事件分发给依赖它们的任务。
- 一个**调度器**，用于执行使用这些 I/O 资源的任务。
- 一个**定时器**，用于安排在设定时间之后运行的工作。

Tokio 的运行时将所有这些功能提供为单一类型：**[Runtime](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html)**。

> 创建

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

运行时的入口点是 [`block_on()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.block_on)。在 `block_on()` 中运行的 future 不会作为 worker 运行（就像 TcpListener 循环那样）。这里由 `block_on()` 的 future 提供的所有其他 future 都将作为 worker 被 spawn。

Tokio 提供**多线程调度器**和**当前线程调度器**。多线程调度器在*线程池*上执行 future，使用工作窃取（work-stealing）策略，默认会为每个可用的 CPU 核心启动一个 worker 线程。当前线程调度器提供*单线程*的 future 执行器。所有任务都将在当前线程上创建和执行。
```rust
use tokio::runtime;

// Multi-Thread Scheduler
let rt = runtime::Runtime::new()?;

// Current-Thread Scheduler
let rt = runtime::Builder::new_current_thread()
    .build()?;
```

而 Tokio 通过宏提供了更简便的创建运行时的方式，参见[宏](#38-宏)。

> 调度

一个*任务*是一个轻量的、非阻塞的执行单元。任务类似于操作系统线程，但它们不是由操作系统调度器管理，而是由 Tokio 运行时管理<sup>[3]</sup>。

任务的关键特性：
1. **轻量**：创建、运行、切换和销毁大量任务的开销非常低，尤其是与操作系统线程相比
2. **协作式**：当任务让出（yield）时，Tokio 运行时会切换到执行下一个任务
3. **非阻塞**：Tokio 提供了在异步上下文中运行阻塞操作的 API

运行时持续调度任务（通过调用 `poll`），直到任务集合为空，然后进入休眠。Tokio 的运行时提供了以下公平性保证以防止*任务饥饿*：如果任务总数不会无限制增长，且没有任务阻塞线程，那么就可以保证任务被公平调度。这基于以下两个假设：
- 存在某个数 `MAX_TASKS`，使得运行时在任意特定时间点上的任务总数永不超过 `MAX_TASKS`
- 存在某个数 `MAX_SCHEDULE`，使得对运行时上生成的任何任务调用 `poll` 都会在 `MAX_SCHEDULE` 时间单位内返回

`MAX_TASKS` 和 `MAX_SCHEDULE` 可以是任意数字，运行时的使用者可以选择它们。基于 `MAX_TASKS` 和 `MAX_SCHEDULE`，tokio 的运行时内部保持一个 `MAX_DELAY`，使得当任务被唤醒时，它将在 `MAX_DELAY` 时间单位内被运行时调度。

但 tokio 不保证运行时对所有任务都同样公平。对于任务，tokio 不保证所有任务获得相同的调度次数，但每个任务最终都会被调度。

运行时还管理 IO 资源和定时器。运行时会周期性地检查是否有任何 IO 资源或定时器已就绪，并唤醒相关任务以便其被调度。这些检查在**调度任务之间**周期性地执行。Tokio 保证它会在某个最大时间单位数内唤醒带有 IO 或定时器事件的任务。

- **当前线程运行时逻辑**：
  1. **任务队列**
     * 2 个 FIFO 队列：**local**、**global**
     * 调度规则：
       * 优先从本地队列中选择下一个要调度的任务
       * 本地队列为空，或者已连续从本地队列中取出任务 **31**（`global_queue_interval`，默认 `31`）次 → 从全局队列中取一个任务
  2. **IO/调度器检查**
     * 每当**没有任务**可调度时，或者已连续调度 **61**（`event_interval`，默认 `61`）个任务时 → 检查新的 IO 或定时器事件
  3. **任务唤醒规则**
     * 任务从运行在运行时上的任务内部被唤醒 → 加入**本地队列**
     * 任务从外部被唤醒 → 加入**全局队列**

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
- **多线程运行时逻辑**：
  1. **Worker 与队列**
     * 固定数量的 worker 线程（在启动时创建）。
     * 每个 worker 拥有：
       * **本地队列**（最多 256 个任务）。
         * 如果超出 → 一半的任务移到**全局队列**。
       * **LIFO 槽**（特殊优化）。
     * 共享的**全局队列**。
  2. **任务调度优先级**
     * 优先使用**本地队列**。
     * 如果本地为空，或从本地取出 `global_queue_interval` 次后，使用**全局队列**。
     * 默认 `global_queue_interval` 是动态计算的（约 10ms 检查一次全局队列）。
  3. **工作窃取**
     * 如果本地和全局队列都为空 → 从另一个 worker 的本地队列中窃取一半任务。
  4. **事件检查**
     * 在以下情况检查 IO/定时器：
       * 没有任务就绪，或
       * 已连续调度 61 个任务（`event_interval` 可配置）。
  5. **LIFO 槽优化**
     * 如果任务唤醒了另一个任务 → 放入 **LIFO 槽**（而不是队列）。
     * 如果 LIFO 已满 → 被移出的任务进入本地队列。
     * 完成一个任务时 → 立即从 LIFO 调度（如果有）。
     * 使用 LIFO 时不重置 coop 预算。
     * 如果连续使用 LIFO 3 次 → 暂时禁用，直到运行一个非 LIFO 任务。
     * 可以禁用（`disable_lifo_slot`）。
     * **注意**：LIFO 是每个线程独立的；不能被其他线程窃取。
  6. **从非 worker 线程唤醒任务**
     * 被唤醒的任务放入**全局队列**。

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

> 关闭

我们可以通过调用 `drop()`，或调用 [`shutdown_background()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_background) 或 [`shutdown_timeout()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_timeout) 来关闭运行时。
- `shutdown_background()`：关闭运行时，不等待任何已生成的工作停止。
- `shutdown_timeout()`：关闭运行时，最多等待给定持续时间让所有已生成的工作停止。

一旦运行时被 drop，绑定到它的任何未完成的 I/O 资源都将不再工作。对它们调用任何方法都会导致错误。

由 `Runtime::spawn` 生成的任务*不保证*会运行至完成，而由 `Runtime::spawn_blocking` 生成的任务会持续运行直到返回。

> 共享

- 使用 `Arc<Runtime>`：防止运行时关闭，当**只剩一个**强计数引用时关闭运行时
- 使用 [`Handle`](https://docs.rs/tokio/latest/tokio/runtime/struct.Handle.html)：不会阻止运行时关闭
- 通过 `Runtime::enter` 或 `Handle::enter` 进入运行时上下文：使用线程局部变量存储当前运行时，任何诸如 `tokio::spawn` 之类的方法都将使用你所在的上下文的运行时

### 3.2 fs
Tokio 使用阻塞文件操作来实现处理文件系统的异步实用方法，包括对文件的读/写以及对目录的操作。Tokio 在所有平台上都使用 `spawn_blocking`<sup>[4]</sup>。

让我们看看 `tokio::fs::read()` 的细节：
```rust
/// This is an async version of [`std::fs::read`].
pub async fn read(path: impl AsRef<Path>) -> io::Result<Vec<u8>> {
    let path = path.as_ref().to_owned();
    asyncify(move || std::fs::read(path)).await
}
```
事实上，`tokio::fs::read()` 是 `std::fs::read()` 的异步版本。内部函数 `asyncify` 通过 `spawn_blocking` 工作：
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

`spawn_blocking` 会有严重的性能影响。建议将操作批量合并为尽可能少的 `spawn_blocking` 调用。
- **写入 `String/Vec<u8>`**：
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
- **使用 `BufReader/BufWriter`**：`BufReader/BufWriter` 支持将许多小的读或写缓冲为少数大的读或写。调用 `File::set_max_buf_size` 来控制 Tokio 的 `File` 在单次 `spawn_blocking` 调用中将读取或写入的最大字节数，默认 `2MB`。
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
- **在 `spawn_blocking` 内手动使用 `std::fs`**：
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
Tokio 提供了自己的 trait（在 `tokio::io` 中），仿照 `std::io::Read/Write`，但是异步的：
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

标准库中大多数实现了 `Read` 和 `Write` 的类型在 tokio 中都有实现 `AsyncRead` 和 `AsyncWrite` 的异步对应物，例如 `File` 和 `TcpStream`。

以上所有函数都返回 `Poll`：
- **`Poll::Ready(Ok(...))`** → 操作完成
- **`Poll::Pending`** → 尚未就绪；运行时必须在稍后唤醒该任务

> 运行时如何调用这些函数？

运行时本身从不直接调用 `poll_read/poll_write`。相反：
1. 调用一个高层异步函数（`AsyncReadExt/AsyncWriteExt` 中的那些函数分别为所有实现了 AsyncRead 和 AsyncWrite 的值自动实现，比如 `AsyncReadExt::read`）
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
2. 该异步函数构建一个 `Future`，当被 poll 时：
   - 在底层 I/O 对象（`TcpStream` 等）上调用 `poll_read/poll_write`
   - 如果返回 `Poll::Pending`，该 future 会将任务的 `Waker` **注册**到 reactor
3. Tokio 的 reactor（基于 `epoll/kqueue/IOCP`）监控文件描述符的就绪状态
   - 当操作系统发出 "socket 可读" 或 "可写" 信号时，Tokio 调用 `Waker::wake()`
   - 这会唤醒阻塞在 `poll_read/poll_write` 上的任务
4. 执行器（`tokio::runtime`）随后重新 poll Future，此时 `poll_read/poll_write` 调用将成功

`f.read(&mut buffer[..]).await?` 的流程：
1. `read()`：返回一个 `Read` 对象，它是一个 `Future`，其 `poll` 封装了 `poll_read`：
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
2. 运行时 poll 该 Future（`Read`）
   - 调用 `File::poll_read`
   - 如果没有可用数据，返回 `Poll::Pending`
   - Future 将当前任务的 `Waker` 注册到 reactor（`mio`<sup>[5]</sup>）
3. Reactor 等待 `fd` 可读信号事件
4. 运行时唤醒该任务，再次 poll Future
5. 这次 poll_read() 成功，返回 `Poll::Ready`

基于字节的接口使用起来笨拙且可能低效，因此 tokio 提供了 `std::io::BufRead` trait 的异步版本 `AsyncBufRead`；以及异步 `BufReader` 和 `BufWriter` 结构体。
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
Tokio 包含类似 `std` 的 TCP/UDP/Unix 网络类型，可用于实现网络协议。`tokio::net` 基于 `mio`。

> TCP

`tokio::net::TcpListener` 抽象了 TCP socket 服务端，监听连接。
```rust
pub struct TcpListener {
    io: PollEvented<mio::net::TcpListener>,
}
```

绑定地址并接受连接：
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
`tokio::net::TcpStream` 抽象了本地 socket 与远程 socket 之间的流。`tokio::net::TcpStream` 也实现了 `AsyncRead` 和 `AsyncWrite` trait。
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

`tokio::net::UdpSocket` 抽象了 UDP socket。在 tokio 中使用 UdpSocket 基本上有两种主要方式：
- **一对多**：`bind` 端口并使用 `send_to` 和 `recv_from` 与许多不同的地址通信
- **一对一**：`connect` 并关联到单一地址，使用 `send` 和 `recv` 只与该远程地址通信
```rust
pub struct UdpSocket {
    io: PollEvented<mio::net::UdpSocket>,
}
```

一对多：
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

一对一：
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
与 `std::sync` 相似但不相同，`tokio::sync` 在此模块中提供了**更多**同步原语，以允许独立的任务相互通信。

> 消息传递

Tokio 程序中最常见的同步形式是消息传递。Tokio 提供了许多不同的 channel 种类，因为不同的消息传递模式最适合用不同的实现来处理。

|             | 生产者 | 产品  | 消费者 |
| :-          | :-:      | :-:      | :-:      |
| `oneshot`   | 单个   | 单个   | 单个   |
| `mpsc`      | 多个 | 多个 | 单个 |
| `broadcast` | 多个 | 多个 | 多个 |
| `watch`     | 多个 | 多个 | 多个 |

- `broadcast`：每个消费者都会收到**每个**值。
- `watch`：channel 中只存储**最近**的值。不保证消费者会看到**所有**值。`watch channel` 类似于容量为 1 的 `broadcast channel`。

示例：使用 watch channel 通知任务配置变更。
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

`mpsc` 如何工作？

`Chan` 的结构：
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
- `tx: CachePadded<list::Tx<T>>`：
  - *无锁* 列表，所有 `Sender` 都将值推入该列表。
  - 多生产者线程安全，内部使用原子 ptr/index（[Michael–Scott 无锁队列](https://www.cs.rochester.edu/u/scott/papers/1996_PODC_queues.pdf)）
  - 将频繁写入的 `tx` 放入单独的缓存行（`CachePadded`），以减少与其他原子字段的伪共享
- `rx_waker: CachePadded<AtomicW