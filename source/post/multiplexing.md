---
title: I/O Multiplexing
category: Tech
tag: [Linux, Rust]
date: 2025-07-26T14:06:55+08:00
---


# I/O Multiplexing
## Part 1 Socket
### 1.1 Socket Model
How do processes communicate over a network?
In real world, we can identify a person by information such as their name, which makes it easy to communicate with them. Similarly, TCP/IP uses an IP address to identify a host, and within the host, a combination of protocol and port to identify a program’s service. Therefore, `protocol + IP + Port` can uniquely identify an application in the network. Applications that use the TCP/IP protocol typically rely on an application programming interface — UNIX BSD sockets — to implement communication between network processes.

**What is a `socket`?**
From the perspective of source code and structure, a socket is a unified abstraction for interaction between user space and the kernel’s network protocol stack. One of the fundamental philosophies of Unix/Linux is “everything is a file,” meaning everything can be operated on using the “open → read/write → close” pattern. For the Linux system, a socket is also a special type of file, and the system provides interfaces for operating on it (`socket`, `bind`, `connect`, `accept`, `listen`, `send`, `recv`, `close`, etc.).

For TCP socket communication:

1. **create**: Call `socket()` to create a socket, then call `bind()` to bind the socket to an `IP:port`.
2. **listen**: Call `inet_listen()` to put the TCP socket into the listening state, initialize the half-connection queue, and add the socket to the corresponding protocol family’s listening list so that incoming SYN packets can be matched and queued.
3. **connect/accept**:

   * **accept**: When the full-connection queue is not empty, `accept()` retrieves a `struct sock *new_sk` from the kernel’s TCP full-connection queue.
   * **connect**: Allocate a kernel `struct sock`, set the destination IP/port, and call `connect()` to initiate the three-way handshake.
4. **send/recv**: Write and read data to perform communication.

### 1.2 Multi-Socket Model
The most basic socket model can only perform synchronous, blocking, one-to-one communication. But, a service cannot only serve a single connection — the ability to handle as many connections as possible is a critical concern. Limited by file descriptors (fd) and memory, the number of connections a server can establish is finite. But even with this finite number of connections, the synchronous blocking communication model cannot meet the demand.

Since `send/recv` operations are blocking, we can design the service to focus solely on connection establishment, delegating `send/recv` to child processes for handling. This **multi-process model** satisfies the requirement of serving multiple connections simultaneously.

Compared with processes, threads are a lighter-weight execution unit, greatly reducing context switching and resource consumption. By using threads instead of processes for `send/recv` handling — and employing a thread pool to avoid frequent creation and destruction of threads — this model can maximize traditional performance (without using virtual threads/coroutines).

However, since the number of threads cannot be created without limit, this model traditionally still cannot push server performance close to its theoretical maximum.

### 1.3 Multiplexing
In most cases, I/O operations have very low CPU usage — the CPU spends most of its time waiting for I/O. From this, it’s clear that assigning each thread to maintain a single socket is highly inefficient. By using the `select/poll/epoll` system calls, a program can obtain multiple I/O events from the kernel (in reality, within a single thread, I/O is still processed serially; however, since each I/O handling time is short, it feels almost like parallel processing). This approach allows a single process or thread to maintain multiple socket connections.

`select` implements multiplexing by placing all connected sockets into a file descriptor set, then calling the `select` function to copy the file descriptor set into the kernel. The kernel checks for network events in a rather crude way — by traversing the file descriptor set. When it detects an event, it marks the corresponding socket as readable or writable, then copies the entire file descriptor set back to user space. In user space, the program must again traverse the set to find readable or writable sockets before processing them.

`select` uses a fixed-length bitmap to represent the file descriptor set, and the number of supported file descriptors is limited. In Linux, this limit is defined by `FD_SETSIZE` in the kernel, with a default maximum value of 1024.

> Under Linux, select() may report a socket file descriptor as "ready for reading", while nevertheless a subsequent read blocks. This could for example happen when data has arrived but upon examination has wrong checksum and is discarded. There may be other circumstances in which a file descriptor is spuriously reported as ready. Thus it may be safer to use O_NONBLOCK on sockets that should not block

`poll` uses a linked list which can by default store more fds. Both `poll` and `select` need to traverse the entire fd set, with time complexity O(n), **and require frequent copying of the fd set between user space and kernel space**, resulting in lower performance.

`epoll` addresses two pain points of `select/poll`:

1. Uses a red-black tree to track the fds to be monitored, reducing operation time complexity to O(logn); `epoll` only needs to pass in the sockets to be monitored each time rather than the entire socket set, greatly reducing data copying and memory allocation.
2. `epoll` adopts an *EventLoop* mechanism. When a socket event occurs, it is added to the ready event queue through a `call back function`. The user retrieves the ready queue by calling `epoll_wait()`, instead of scanning the entire socket set, improving efficiency.

`epoll` trigger modes default to LT:

* Edge-triggered (ET): When using edge-triggered mode, when the monitored socket descriptor has a readable event, **the server only wakes up once from `epoll_wait`**, even if the process does not call `read` to fetch data from the kernel, it still only wakes once. Therefore, the program must ensure that it reads all the data from the kernel buffer in one go.
* Level-triggered (LT): When using level-triggered mode, when the monitored socket has readable events, **the server keeps waking up from `epoll_wait` until the kernel buffer data is fully read by the `read` function**, aiming to notify that there is data to be read.

## Part 2 Reactor
`epoll`’s mode of using an *EventLoop* instead of polling to respond to actions is also called the **Reactor Pattern**.

### 2.1 Single Reactor Single Process/Single Thread
Architecture diagram:
![Single Reactor Single Process/Single Thread](https://i.postimg.cc/P53gFj6M/Reactor.webp)

* Reactor: Listens for and dispatches events
* Acceptor: Receives **connection establishment** events dispatched by the Reactor and establishes a new connection
* Handler: Receives **business** events dispatched by the Reactor and processes business logic

The drawbacks of single-process/single-thread are obvious:

1. Cannot fully utilize multi-core CPU performance
2. Handler cannot respond to events from other connections while processing business logic

> This pattern is basically no longer used; the latest version of Redis has also abandoned the single-threaded mode.


### 2.2 Single Reactor with Multiple Processes/Threads
Architecture diagram:
![Single Reactor Multiple Processes/Threads](https://i.postimg.cc/8C7q209g/Reactor.webp)

Using multiple processes/threads + thread pool partially solves the problems of single-process/single-thread:

1. Multiple processes/threads fully utilize CPU performance
2. For CPU-intensive business logic, it improves response speed

However, single Reactor also has a drawback: the Reactor itself becomes a performance bottleneck. Under long-lasting high request loads, the Reactor’s performance affects the entire system’s performance.

A simple implementation in Rust under [nix](https://docs.rs/nix/0.26.4/nix/sys/index.html):
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

### 2.3 Multiple Reactors with Multiple Processes/Threads

Architecture diagram:
![Multiple Reactors Multiple Processes/Threads](https://i.postimg.cc/QMvRhqZ9/Reactor.webp)

After introducing multiple Reactors, the MainReactor is only responsible for handling connection establishment events and dispatching these events to the Acceptor. When the Acceptor establishes a connection, it assigns the new connection to a SubReactor. The SubReactor listens to the established connections and dispatches events to the Handler for event processing.

## Part 3 Proactor
There are three Reactor architectural designs, and whether sockets use blocking I/O or non-blocking I/O, they are essentially synchronous operations. **user space to kernel space switching** and **`syscall`** calls incur performance overhead.

Proactor reduces context switches and `syscall` calls through **asynchronous I/O**, further improving the performance of network models.

Differences between Proactor and Reactor:

* Reactor: The kernel notifies the application/thread that the "fd is readable/writable," then the application initiates the `read/write` itself. The kernel copies data into the application’s buffer during that `read/write` call.
* Proactor: The application/thread submits an asynchronous I/O request first (usually passing the buffer to the kernel/driver). The kernel/driver completes data transfer in the background and writes data directly into that buffer, then notifies the application/thread of the "completion event" (along with results/byte counts).

![Reactor-Proactor-Time-Flow](https://i.postimg.cc/gjfkBYhX/Reactor-Proactor-Time-Flow.png)

Different asynchronous implementations have some differences regarding buffers and kernel data transfer:

* Buffer: Buffers reside in user space. In true Proactor implementations (Windows IOCP, Linux io\_uring), the kernel pins/registers physical pages of the buffer, then **the kernel writes or DMA transfers** data directly into the buffer. Some user-space async implementations for compatibility first write data into a kernel buffer, then copy it from the kernel buffer to the user buffer.
* Data transfer: The application/thread submitting the async I/O request does not need to worry about data preparation; in Proactor, data preparation and transfer are handled by the kernel. Historically, POSIX AIO in many Linux implementations simulates async by using kernel thread pools (kernel spawns threads to perform synchronous reads, then notifies). Semantically it looks like Proactor, but the underlying mechanism is still synchronous I/O done by threads. The latest kernel’s `io_uring` offers near "kernel-completed I/O writing directly into user buffers" capability, with fixed and registered buffers to reduce or avoid extra copies.

Undoubtedly, Reactor is a more mature and widely adopted cross-platform design. True Proactor requires OS/driver-level support. Windows IOCP is a mature example; Linux’s `io_uring` is increasingly close to true Proactor, but not all platforms support it.

## Part 4 Minimal Implementation of Reactor/Proactor

### 4.1 Minimal `epoll` (Reactor) Echo Server

Uses non-blocking sockets + `epoll` event notification. The kernel notifies when the socket is "readable," and the program calls `recv` to read data (I/O initiated by the application).

* The application registers the fd with `epoll`; the kernel notifies the application when the fd is readable/writable (via `epoll_wait` return)
* Upon receiving the event, the application calls `recv/read` to read data from the kernel (actual data copy initiated by the application)
* The common path involves: `epoll_wait` (notification) + `read` (data copy), two user/kernel transitions

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

Compile:
```bash
gcc -std=gnu11 -O2 -Wall epoll_echo.c -o epoll_echo
./epoll_echo
```

### 4.2 io\_uring (Proactor-like) Minimal Echo Server

Uses `liburing` to submit asynchronous `accept/read/send` requests; the kernel (or driver) completes I/O in the background and notifies the user upon completion via `completion`. Requires Linux kernel support for `io_uring`.

* The application submits I/O requests (`accept/read/write`) to the kernel (Submission Queue, SQ); the kernel/driver completes the I/O in the background and places the completion results into the Completion Queue (CQ).
* The application obtains the “completed” results through Completion Queue Events (CQE) and can directly specify the user buffer to write into at submission time.

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

Compile:
```bash
gcc -std=gnu11 -O2 -Wall uring_echo.c -o uring_echo -luring
./uring_echo
```

## Part 5 Reactor in Coroutines (User-space Threads)
Coroutines such as Go goroutines, Java virtual threads, Kotlin coroutines, etc. (i.e., *user-space threads*) are more lightweight compared to OS threads, offering faster context switching and lower memory usage, making it easy to support **much higher levels** of concurrent connections.

Below is a simple implementation of the Reactor model using Rust’s [tokio](https://docs.rs/tokio/1.47.1/tokio/index.html) async runtime:
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
