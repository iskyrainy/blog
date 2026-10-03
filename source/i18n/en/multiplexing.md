---
title: I/O 多路复用
category: Tech
tag: [Linux, Rust]
date: 2025-07-26T14:06:55+08:00
---


# I/O 多路复用
## 第 1 部分 Socket
### 1.1 Socket 模型
进程之间如何通过网络进行通信？
在现实世界中，我们可以通过姓名等信息来识别一个人，从而方便地与他交流。类似地，TCP/IP 使用 IP 地址来标识一台主机，而在主机内部，使用协议和端口的组合来标识一个程序的服务。因此，`协议 + IP + 端口`可以在网络中唯一标识一个应用。使用 TCP/IP 协议的应用通常依赖一套应用程序编程接口——UNIX BSD 套接字——来实现网络进程之间的通信。

**什么是 `socket`？**
从源码和结构的角度来看，socket 是用户空间与内核网络协议栈之间交互的统一抽象。Unix/Linux 的基本哲学之一是“一切皆文件”，意味着一切都可以用“打开 → 读/写 → 关闭”的模式来操作。对于 Linux 系统而言，socket 也是一种特殊的文件，系统提供了操作它的接口（`socket`、`bind`、`connect`、`accept`、`listen`、`send`、`recv`、`close` 等）。

对于 TCP socket 通信：

1. **create**：调用 `socket()` 创建 socket，然后调用 `bind()` 将 socket 绑定到 `IP:port`。
2. **listen**：调用 `inet_listen()` 使 TCP socket 进入监听状态，初始化半连接队列，并将该 socket 加入对应协议族的监听列表，以便匹配并排队到来的 SYN 包。
3. **connect/accept**：

   * **accept**：当全连接队列不为空时，`accept()` 从内核的 TCP 全连接队列中取出一个 `struct sock *new_sk`。
   * **connect**：分配内核 `struct sock`，设置目的 IP/端口，并调用 `connect()` 发起三次握手。
4. **send/recv**：写入和读取数据以进行通信。

### 1.2 多 Socket 模型
最基本的 socket 模型只能进行同步、阻塞、一对一的通信。但是，一个服务不能只服务单个连接——能够处理尽可能多的连接是一个关键问题。受限于文件描述符（fd）和内存，服务器能够建立的连接数是有限的。但即便是这个有限的连接数，同步阻塞通信模型也无法满足需求。

由于 `send/recv` 操作是阻塞的，我们可以将服务设计为只专注于连接建立，把 `send/recv` 委托给子进程来处理。这种**多进程模型**满足了同时服务多个连接的需求。

与进程相比，线程是更轻量的执行单元，大大减少了上下文切换和资源消耗。通过使用线程代替进程来处理 `send/recv`——并采用线程池来避免频繁创建和销毁线程——该模型可以最大化传统性能（不使用虚拟线程/协程）。

然而，由于线程数量不能无限制地创建，该模型传统上仍然无法将服务器性能推向理论最大值附近。

### 1.3 多路复用
在大多数情况下，I/O 操作的 CPU 使用率非常低——CPU 大部分时间都在等待 I/O。由此可以清楚地看出，为每个线程分配一个 socket 来维护是极其低效的。通过使用 `select/poll/epoll` 系统调用，程序可以从内核获取多个 I/O 事件（实际上，在单个线程内，I/O 仍然是串行处理的；不过，由于每次 I/O 处理时间很短，感觉上几乎像是并行处理）。这种方法允许单个进程或线程维护多个 socket 连接。

`select` 通过将所有已连接的 socket 放入一个文件描述符集合来实现多路复用，然后调用 `select` 函数将该文件描述符集合复制到内核。内核以一种相当粗糙的方式检查网络事件——遍历文件描述符集合。当检测到事件时，它将相应的 socket 标记为可读或可写，然后将整个文件描述符集合复制回用户空间。在用户空间中，程序必须再次遍历该集合以找到可读或可写的 socket，然后才能处理它们。

`select` 使用固定长度的位图来表示文件描述符集合，支持的文件描述符数量有限。在 Linux 中，这个限制由内核中的 `FD_SETSIZE` 定义，默认最大值为 1024。

> 在 Linux 下，select() 可能会报告一个 socket 文件描述符“可读”，但随后的读取却阻塞了。例如，当数据已到达但经检查后发现校验和错误并被丢弃时，就可能发生这种情况。还可能存在其他情况导致文件描述符被虚假地报告为就绪。因此，对于不应阻塞的 socket，使用 O_NONBLOCK 可能更安全

`poll` 使用链表，默认情况下可以存储更多的 fd。`poll` 和 `select` 都需要遍历整个 fd 集合，时间复杂度为 O(n)，**并且需要在用户空间和内核空间之间频繁复制 fd 集合**，导致性能较低。

`epoll` 解决了 `select/poll` 的两个痛点：

1. 使用红黑树来跟踪要监视的 fd，将操作时间复杂度降低到 O(logn)；`epoll` 每次只需要传入要监视的 socket，而不是整个 socket 集合，大大减少了数据复制和内存分配。
2. `epoll` 采用 *EventLoop* 机制。当 socket 事件发生时，通过 `call back function` 将其添加到就绪事件队列中。用户通过调用 `epoll_wait()` 获取就绪队列，而不是扫描整个 socket 集合，从而提高了效率。

`epoll` 触发模式默认为 LT：

* 边缘触发（ET）：在使用边缘触发模式时，当被监视的 socket 描述符有可读事件时，**服务器只会从 `epoll_wait` 中唤醒一次**，即使进程没有调用 `read` 从内核中获取数据，它也只会唤醒一次。因此，程序必须确保一次性从内核缓冲区读取所有数据。
* 水平触发（LT）：在使用水平触发模式时，当被监视的 socket 有可读事件时，**服务器会不断从 `epoll_wait` 中唤醒，直到内核缓冲区数据被 `read` 函数完全读取**，目的是通知有数据需要读取。

## 第 2 部分 Reactor
`epoll` 使用 *EventLoop* 而不是轮询来响应动作的这种模式也被称为 **Reactor 模式**。

### 2.1 单 Reactor 单进程/单线程
架构图：
![单 Reactor 单进程/单线程](https://i.postimg.cc/P53gFj6M/Reactor.webp)

* Reactor：监听并分发事件
* Acceptor：接收 Reactor 分发的**连接建立**事件并建立新连接
* Handler：接收 Reactor 分发的**业务**事件并处理业务逻辑

单进程/单线程的缺点很明显：

1. 无法充分利用多核 CPU 性能
2. Handler 在处理业务逻辑时无法响应其他连接的事件

> 这种模式基本上已经不再使用；最新版本的 Redis 也放弃了单线程模式。


### 2.2 单 Reactor 多进程/多线程
架构图：
![单 Reactor 多进程/多线程](https://i.postimg.cc/8C7q209g/Reactor.webp)

使用多进程/多线程 + 线程池部分解决了单进程/单线程的问题：

1. 多进程/多线程充分利用 CPU 性能
2. 对于 CPU 密集型业务逻辑，它提高了响应速度

然而，单 Reactor 也有一个缺点：Reactor 本身成为性能瓶颈。在长时间持续的高请求负载下，Reactor 的性能会影响整个系统的性能。

在 [nix](https://docs.rs/nix/0.26.4/nix/sys/index.html) 下的一个简单 Rust 实现：
```rust
use nix::sys::epoll::*;
use nix::sys::socket::{setsockopt, sockopt::ReuseAddr};
use nix::unistd::{close};
use std::io::{Read, Write};
use std::net::SocketAddr;
use std::os::unix::io::{AsRawFd, FromRawFd, RawFd};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug)]
struct EventMsg {
    fd: RawFd,
    events: EpollFlags,
}

fn set_nonblocking(fd: RawFd) -> nix::Result<()> {
    use nix::fcntl::{fcntl, FcntlArg, OFlag};
    let flags = OFlag::from_bits_truncate(fcntl(fd, FcntlArg::F_GETFL)?);
    let new = flags | OFlag::O_NONBLOCK;
    fcntl(fd, FcntlArg::F_SETFL(new))?;
    Ok(())
}

fn epoll_ctl_del_and_close(epfd: RawFd, fd: RawFd) {
    if let Err(e) = epoll_ctl(epfd, EpollOp::EpollCtlDel, fd, None) {
        eprintln!("epoll_ctl DEL fd {} failed: {:?}", fd, e);
    }
    if let Err(e) = close(fd) {
        eprintln!("close fd {} failed: {:?}", fd, e);
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr: SocketAddr = "127.0.0.1:9000".parse()?;
    let listener = std::net::TcpListener::bind(addr)?;
    listener.set_nonblocking(true)?;
    let lfd = listener.as_raw_fd();
    let _ = setsockopt(lfd, ReuseAddr, &true);

    let epfd = epoll_create()?;
    let mut ev = EpollEvent::new(EpollFlags::EPOLLIN, lfd as u64);
    epoll_ctl(epfd, EpollOp::EpollCtlAdd, lfd, &mut ev)?;

    let (tx, rx) = mpsc::channel::<EventMsg>();
    let rx = Arc::new(Mutex::new(rx));
    let epfd_arc = Arc::new(epfd);

    // worker threads
    for i in 0..4 {
        let rx_clone = Arc::clone(&rx);
        let epfd_clone = Arc::clone(&epfd_arc);
        thread::spawn(move || worker_loop(i, rx_clone, epfd_clone));
    }

    // acceptor
    let listener_for_accept = listener.try_clone()?;
    let epfd_for_accept = Arc::clone(&epfd_arc);
    thread::spawn(move || acceptor_loop(listener_for_accept, epfd_for_accept));

    // reactor
    reactor_loop(epfd, tx)?;

    Ok(())
}

fn reactor_loop(epfd: RawFd, tx: mpsc::Sender<EventMsg>) -> nix::Result<()> {
    let mut events = vec![EpollEvent::empty(); 1024];
    loop {
        let n = epoll_wait(epfd, &mut events, -1)?;
        for i in 0..n {
            let e = events[i];
            let fd = e.data() as RawFd;
            let flags = e.events();
            let _ = tx.send(EventMsg { fd, events: flags });
        }
    }
}

fn acceptor_loop(listener: std::net::TcpListener, epfd: Arc<RawFd>) {
    loop {
        match listener.accept() {
            Ok((stream, peer)) => {
                let fd = stream.as_raw_fd();
                if let Err(e) = set_nonblocking(fd) {
                    eprintln!("acceptor: set_nonblocking failed: {:?}", e);
                    drop(stream);
                    continue;
                }
                println!("acceptor: accepted {:?}, fd {}", peer, fd);
                let mut ev = EpollEvent::new(EpollFlags::EPOLLIN, fd as u64);
                if let Err(err) = epoll_ctl(*epfd, EpollOp::EpollCtlAdd, fd, &mut ev) {
                    eprintln!("acceptor: epoll_ctl add failed: {:?}", err);
                    drop(stream);
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(e) => {
                eprintln!("acceptor: error: {:?}", e);
                thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

fn worker_loop(id: usize, rx: Arc<Mutex<mpsc::Receiver<EventMsg>>>, epfd: Arc<RawFd>) {
    loop {
        let evt = {
            let guard = rx.lock().unwrap();
            match guard.recv() {
                Ok(e) => e,
                Err(_) => return,
            }
        };

        println!("worker {}: got fd {} {:?}", id, evt.fd, evt.events);

        let mut stream = unsafe { std::net::TcpStream::from_raw_fd(evt.fd) };
        stream.set_nonblocking(true).ok();

        let mut buf = [0u8; 1024];
        match stream.read(&mut buf) {
            Ok(0) => {
                println!("worker {}: fd {} closed by peer", id, evt.fd);
                epoll_ctl_del_and_close(*epfd, evt.fd);
            }
            Ok(n) => {
                println!("worker {}: read {} bytes", id, n);
                if let Err(e) = stream.write_all(&buf[..n]) {
                    eprintln!("worker {}: write err: {:?}", id, e);
                    epoll_ctl_del_and_close(*epfd, evt.fd);
                } else {
                    std::mem::forget(stream);
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::mem::forget(stream);
            }
            Err(e) => {
                eprintln!("worker {}: read err: {:?}", id, e);
                epoll_ctl_del_and_close(*epfd, evt.fd);
            }
        }
    }
}

```

### 2.3 多 Reactor 多进程/多线程

架构图：
![多 Reactor 多进程/多线程](https://i.postimg.cc/QMvRhqZ9/Reactor.webp)

引入多个 Reactor 后，MainReactor 只负责处理连接建立事件并将这些事件分发给 Acceptor。当 Acceptor 建立连接后，它将新连接分配给一个 SubReactor。SubReactor 监听已建立的连接并将事件分发给 Handler 进行事件处理。

## 第 3 部分 Proactor
有三种 Reactor 架构设计，无论 socket 使用阻塞 I/O 还是非阻塞 I/O，它们本质上都是同步操作。**用户空间到内核空间的切换**和 **`syscall`** 调用都会带来性能开销。

Proactor 通过**异步 I/O** 减少上下文切换和 `syscall` 调用，进一步提高网络模型的性能。

Proactor 与 Reactor 的区别：

* Reactor：内核通知应用程序/线程“fd 可读/可写”，然后应用程序自己发起 `read/write`。内核在该 `read/write` 调用期间将数据复制到应用程序的缓冲区中。
* Proactor：应用程序/线程首先提交一个异步 I/O 请求（通常将缓冲区传递给内核/驱动）。内核/驱动在后台完成数据传输，将数据直接写入该缓冲区，然后通知应用程序/线程“完成事件”（以及结果/字节数）。

![Reactor-Proactor-Time-Flow](https://i.postimg.cc/gjfkBYhX/Reactor-Proactor-Time-Flow.png)

不同的异步实现在缓冲区和内核数据传输方面存在一些差异：

* 缓冲区：缓冲区位于用户空间。在真正的 Proactor 实现（Windows IOCP、Linux io\_uring）中，内核会固定/注册缓冲区的物理页，然后**由内核写入或 DMA 传输**数据直接到缓冲区。一些为了兼容性的用户空间异步实现会先将数据写入内核缓冲区，然后从内核缓冲区复制到用户缓冲区。
* 数据传输：提交异步 I/O 请求的应用程序/线程不需要关心数据准备；在 Proactor 中，数据准备和传输由内核处理。从历史上看，许多 Linux 实现中的 POSIX AIO 通过使用内核线程池来模拟异步（内核生成线程执行同步读取，然后通知）。语义上看起来像 Proactor，但底层机制仍然是由线程完成的同步 I/O。最新内核的 `io_uring` 提供了接近“内核完成的 I/O 直接写入用户缓冲区”的能力，通过固定和注册的缓冲区来减少或避免额外的复制。

毫无疑问，Reactor 是一种更成熟且被广泛采用的跨平台设计。真正的 Proactor 需要操作系统/驱动级别的支持。Windows IOCP 是一个成熟的例子；Linux 的 `io_uring` 越来越接近真正的 Proactor，但并非所有平台都支持它。

## 第 4 部分 Reactor/Proactor 的最小实现

### 4.1 最小 `epoll`（Reactor）Echo 服务器

使用非阻塞 socket + `epoll` 事件通知。当 socket “可读”时内核通知，程序调用 `recv` 读取数据（I/O 由应用程序发起）。

* 应用程序将 fd 注册到 `epoll`；当 fd 可读/可写时内核通知应用程序（通过 `epoll_wait` 返回）
* 收到事件后，应用程序调用 `recv/read` 从内核读取数据（实际数据复制由应用程序发起）
* 常见路径涉及：`epoll_wait`（通知）+ `read`（数据复制），两次用户/内核转换

```c
// epoll_echo.c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <sys/epoll.h>

#define PORT 12345
#define MAX_EVENTS 64
#define BUFSZ 4096

static int set_nonblock(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags == -1) return -1;
    return fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

int main() {
    signal(SIGPIPE, SIG_IGN);

    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd < 0) { perror("socket"); return 1; }

    int one = 1;
    setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

    struct sockaddr_in addr;
    memset(&addr,0,sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(PORT);

    if (bind(listen_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }
    if (listen(listen_fd, 128) < 0) { perror("listen"); return 1; }

    if (set_nonblock(listen_fd) < 0) { perror("set_nonblock"); return 1; }

    int epfd = epoll_create1(0);
    if (epfd < 0) { perror("epoll_create1"); return 1; }

    struct epoll_event ev;
    ev.events = EPOLLIN;
    ev.data.fd = listen_fd;
    if (epoll_ctl(epfd, EPOLL_CTL_ADD, listen_fd, &ev) < 0) { perror("epoll_ctl"); return 1; }

    struct epoll_event events[MAX_EVENTS];
    char buf[BUFSZ];

    printf("epoll echo server listening on %d\n", PORT);
    for (;;) {
        int n = epoll_wait(epfd, events, MAX_EVENTS, -1);
        if (n < 0) {
            if (errno == EINTR) continue;
            perror("epoll_wait"); break;
        }
        for (int i = 0; i < n; ++i) {
            int fd = events[i].data.fd;
            if (fd == listen_fd) {
                // accept loop (non-blocking accept)
                for (;;) {
                    int c = accept(listen_fd, NULL, NULL);
                    if (c < 0) {
                        if (errno == EAGAIN || errno == EWOULDBLOCK) break;
                        perror("accept"); break;
                    }
                    set_nonblock(c);
                    struct epoll_event cev;
                    cev.events = EPOLLIN | EPOLLET; // edge-triggered for client
                    cev.data.fd = c;
                    if (epoll_ctl(epfd, EPOLL_CTL_ADD, c, &cev) < 0) { perror("epoll_ctl add"); close(c); }
                }
            } else {
                // client readable or error
                if (events[i].events & (EPOLLERR | EPOLLHUP)) {
                    close(fd);
                    continue;
                }
                // read loop
                for (;;) {
                    ssize_t r = recv(fd, buf, sizeof(buf), 0);
                    if (r < 0) {
                        if (errno == EAGAIN || errno == EWOULDBLOCK) break;
                        perror("recv"); close(fd); break;
                    } else if (r == 0) {
                        close(fd); break; // client closed
                    } else {
                        // echo back (may be partial)
                        ssize_t written = 0;
                        while (written < r) {
                            ssize_t w = send(fd, buf + written, r - written, 0);
                            if (w < 0) {
                                if (errno == EAGAIN || errno == EWOULDBLOCK) {
                                    // in minimal example we break; production should buffer the remainder and wait for EPOLLOUT
                                    break;
                                } else {
                                    perror("send"); close(fd); break;
                                }
                            }
                            written += w;
                        }
                    }
                }
            }
        }
    }
    close(epfd);
    close(listen_fd);
    return 0;
}

```

编译：
```bash
gcc -std=gnu11 -O2 -Wall epoll_echo.c -o epoll_echo
./epoll_echo
```

### 4.2 io\_uring（类 Proactor）最小 Echo 服务器

使用 `liburing` 提交异步 `accept/read/send` 请求；内核（或驱动）在后台完成 I/O，并在完成时通过 `completion` 通知用户。需要 Linux 内核支持 `io_uring`。

* 应用程序向内核提交 I/O 请求（`accept/read/write`）（Submission Queue，SQ）；内核/驱动在后台完成 I/O，并将完成结果放入 Completion Queue（CQ）。
* 应用程序通过 Completion Queue Events（CQE）获取“已完成”的结果，并可以在提交时直接指定要写入的用户缓冲区。

```c
// uring_echo.c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <liburing.h>

#define PORT 12345
#define BUFSZ 4096
#define QD  64

enum { OP_ACCEPT = 1, OP_READ = 2, OP_WRITE = 3 };

struct io_data {
    int op;
    int fd;             // for read/write: client fd; for accept: listen fd
    struct sockaddr_in addr;
    socklen_t addrlen;
    ssize_t len;        // read/write length or result
    char buf[BUFSZ];
};

static int set_nonblock(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags == -1) return -1;
    return fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

int main() {
    signal(SIGPIPE, SIG_IGN);

    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd < 0) { perror("socket"); return 1; }
    int one = 1;
    setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

    struct sockaddr_in addr;
    memset(&addr,0,sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(PORT);

    if (bind(listen_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }
    if (listen(listen_fd, 128) < 0) { perror("listen"); return 1; }
    if (set_nonblock(listen_fd) < 0) { perror("set_nonblock"); return 1; }

    struct io_uring ring;
    if (io_uring_queue_init(QD, &ring, 0) < 0) { perror("io_uring_queue_init"); return 1; }

    // prepare and submit initial accept
    struct io_data *a = malloc(sizeof(*a));
    a->op = OP_ACCEPT;
    a->fd = listen_fd;
    a->addrlen = sizeof(a->addr);
    struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
    io_uring_prep_accept(sqe, listen_fd, (struct sockaddr*)&a->addr, &a->addrlen, 0);
    io_uring_sqe_set_data(sqe, a);
    io_uring_submit(&ring);

    printf("io_uring echo server listening on %d\n", PORT);

    while (1) {
        struct io_uring_cqe *cqe;
        int ret = io_uring_wait_cqe(&ring, &cqe);
        if (ret < 0) { fprintf(stderr, "wait cqe: %s\n", strerror(-ret)); break; }

        struct io_data *d = io_uring_cqe_get_data(cqe);
        int res = cqe->res;
        io_uring_cqe_seen(&ring, cqe);

        if (!d) continue;

        if (d->op == OP_ACCEPT) {
            if (res >= 0) {
                int client_fd = res;
                set_nonblock(client_fd);
                // allocate per-connection io_data for read
                struct io_data *r = malloc(sizeof(*r));
                r->op = OP_READ;
                r->fd = client_fd;

                // submit recv on client
                struct io_uring_sqe *s = io_uring_get_sqe(&ring);
                io_uring_prep_recv(s, client_fd, r->buf, BUFSZ, 0);
                io_uring_sqe_set_data(s, r);
                io_uring_submit(&ring);
            } else {
                fprintf(stderr, "accept failed: %s\n", strerror(-res));
            }
            // re-arm accept (reuse d)
            free(d); // free previous accept data
            struct io_data *a2 = malloc(sizeof(*a2));
            a2->op = OP_ACCEPT;
            a2->fd = listen_fd;
            a2->addrlen = sizeof(a2->addr);
            struct io_uring_sqe *sqe2 = io_uring_get_sqe(&ring);
            io_uring_prep_accept(sqe2, listen_fd, (struct sockaddr*)&a2->addr, &a2->addrlen, 0);
            io_uring_sqe_set_data(sqe2, a2);
            io_uring_submit(&ring);

        } else if (d->op == OP_READ) {
            if (res > 0) {
                d->len = res;
                d->op = OP_WRITE;
                // prepare send (echo)
                struct io_uring_sqe *sqe_w = io_uring_get_sqe(&ring);
                io_uring_prep_send(sqe_w, d->fd, d->buf, d->len, 0);
                io_uring_sqe_set_data(sqe_w, d);
                io_uring_submit(&ring);
            } else {
                // res == 0 => close, res < 0 => err
                close(d->fd);
                free(d);
            }
        } else if (d->op == OP_WRITE) {
            if (res >= 0) {
                // after write, re-arm read to continue echoing
                d->op = OP_READ;
                struct io_uring_sqe *sqe_r = io_uring_get_sqe(&ring);
                io_uring_prep_recv(sqe_r, d->fd, d->buf, BUFSZ, 0);
                io_uring_sqe_set_data(sqe_r, d);
                io_uring_submit(&ring);
            } else {
                close(d->fd);
                free(d);
            }
        } else {
            // unknown op
            free(d);
        }
    }

    io_uring_queue_exit(&ring);
    close(listen_fd);
    return 0;
}

```

编译：
```bash
gcc -std=gnu11 -O2 -Wall uring_echo.c -o uring_echo -luring
./uring_echo
```

## 第 5 部分 协程中的 Reactor（用户空间线程）
诸如 Go goroutine、Java 虚拟线程、Kotlin 协程等协程（即 *用户空间线程*）与操作系统线程相比更轻量，提供更快的上下文切换和更低的内存占用，使得轻松支持**高得多**的并发连接成为可能。

下面是使用 Rust 的 [tokio](https://docs.rs/tokio/1.47.1/tokio/index.html) 异步运行时对 Reactor 模型的一个简单实现：
```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use std::sync::Arc;
use std::net::SocketAddr;
use std::time::Duration;

/// worker pool size
const MAX_CONCURRENT_CONNECTIONS: usize = 1024;

#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr: SocketAddr = "127.0.0.1:9000".parse()?;
    let listener = TcpListener::bind(addr).await?;
    println!("listening on {}", addr);
    let sem = Arc::new(Semaphore::new(MAX_CONCURRENT_CONNECTIONS));

    loop {
        // accept
        let (socket, peer) = match listener.accept().await {
            Ok(pair) => pair,
            Err(e) => {
                eprintln!("accept error: {}", e);
                // small delay to avoid busy loop on transient errors
                tokio::time::sleep(Duration::from_millis(50)).await;
                continue;
            }
        };

        let permit = match sem.clone().acquire_owned().await {
            Ok(p) => p,
            Err(_) => {
                // semaphore closed -> shutdown
                eprintln!("semaphore closed, rejecting connection");
                drop(socket);
                continue;
            }
        };

        // spawn a new task to handle the connection
        tokio::spawn(handle_connection(socket, peer, permit));
    }
}

/// Handles a single TCP connection
async fn handle_connection(mut socket: TcpStream, peer: SocketAddr, _permit: OwnedSemaphorePermit) {
    println!("accepted connection from {}", peer);
    if let Err(e) = socket.set_nodelay(true) {
        eprintln!("set_nodelay error for {}: {}", peer, e);
    }

    let mut buf = vec![0u8; 4096];

    loop {
        match socket.read(&mut buf).await {
            Ok(0) => {
                // client closed the connection
                println!("peer {} closed connection", peer);
                return;
            }
            Ok(n) => {
                // echo data back to the client
                if let Err(e) = socket.write_all(&buf[..n]).await {
                    eprintln!("write error to {}: {}", peer, e);
                    return;
                }
            }
            Err(e) => {
                eprintln!("read error from {}: {}", peer, e);
                return;
            }
        }
    }
}

```