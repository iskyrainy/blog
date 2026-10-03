---
title: I/O 멀티플렉싱
category: Tech
tag: [Linux, Rust]
date: 2025-07-26T14:06:55+08:00
---


# I/O 멀티플렉싱
## Part 1 소켓
### 1.1 소켓 모델
프로세스는 네트워크를 통해 어떻게 통신할까?
현실 세계에서는 이름과 같은 정보로 사람을 식별할 수 있어 통신이 용이하다. 마찬가지로 TCP/IP에서는 IP 주소로 호스트를 식별하고, 호스트 내에서는 프로토콜과 포트의 조합으로 프로그램의 서비스를 식별한다. 따라서 `프로토콜 + IP + Port`로 네트워크에서 애플리케이션을 고유하게 식별할 수 있다. TCP/IP 프로토콜을 사용하는 애플리케이션은 일반적으로 응용 프로그래밍 인터페이스인 UNIX BSD 소켓을 통해 네트워크 프로세스 간 통신을 구현한다.

**`소켓`이란 무엇인가?**
소스 코드와 구조의 관점에서 소켓은 사용자 공간과 커널 네트워크 프로토콜 스택 간 상호작용을 위한 통일된 추상화이다. Unix/Linux의 기본 철학 중 하나는 "모든 것은 파일이다"이며, 이는 모든 것을 "열기 → 읽기/쓰기 → 닫기" 패턴으로 조작할 수 있음을 의미한다. Linux 시스템에서 소켓 역시 특수한 유형의 파일이며, 시스템은 이를 조작하기 위한 인터페이스(`socket`, `bind`, `connect`, `accept`, `listen`, `send`, `recv`, `close` 등)를 제공한다.

TCP 소켓 통신의 경우:

1. **create**: `socket()`을 호출하여 소켓을 생성한 다음, `bind()`를 호출하여 소켓을 `IP:port`에 바인딩한다.
2. **listen**: `inet_listen()`을 호출하여 TCP 소켓을 리스닝 상태로 전환하고, 반연결 큐를 초기화하며, 소켓을 해당 프로토콜 패밀리의 리스닝 리스트에 추가하여 수신되는 SYN 패킷이 매칭되어 큐에 들어갈 수 있도록 한다.
3. **connect/accept**:

   * **accept**: 완전 연결 큐가 비어 있지 않을 때, `accept()`가 커널의 TCP 완전 연결 큐에서 `struct sock *new_sk`를 가져온다.
   * **connect**: 커널 `struct sock`을 할당하고, 목적지 IP/포트를 설정한 다음, `connect()`를 호출하여 3-way 핸드셰이크를 시작한다.
4. **send/recv**: 데이터를 쓰고 읽어 통신을 수행한다.

### 1.2 멀티 소켓 모델
가장 기본적인 소켓 모델은 동기적이고 블로킹 방식의 일대일 통신만 수행할 수 있다. 그러나 서비스는 단일 연결만 서비스할 수 없으며, 가능한 한 많은 연결을 처리하는 능력은 중요한 관심사이다. 파일 디스크립터(fd)와 메모리의 제약으로 인해 서버가 설정할 수 있는 연결 수는 유한하다. 하지만 이 유한한 연결 수로도 동기 블로킹 통신 모델은 요구를 충족할 수 없다.

`send/recv` 작업이 블로킹이므로, 서비스가 연결 설정에만 집중하고 `send/recv`를 자식 프로세스에 위임하여 처리하도록 설계할 수 있다. 이러한 **멀티 프로세스 모델**은 여러 연결을 동시에 서비스한다는 요구를 충족한다.

프로세스와 비교하여 스레드는 더 가벼운 실행 단위로, 컨텍스트 스위칭과 자원 소비를 크게 줄인다. 프로세스 대신 스레드를 사용하여 `send/recv` 처리를 하고, 스레드 풀을 사용하여 스레드의 빈번한 생성과 소멸을 피하면, 이 모델은 (가상 스레드/코루틴을 사용하지 않고) 전통적인 성능을 최대한 발휘할 수 있다.

그러나 스레드 수를 무한정 생성할 수 없으므로, 이 모델은 전통적으로 여전히 서버 성능을 이론적 최대치에 가깝게 끌어올릴 수 없다.

### 1.3 멀티플렉싱
대부분의 경우 I/O 작업의 CPU 사용률은 매우 낮으며, CPU는 대부분의 시간을 I/O 대기에 소비한다. 이로부터 각 스레드가 단일 소켓을 유지하도록 할당하는 것이 매우 비효율적임을 알 수 있다. `select/poll/epoll` 시스템 호출을 사용하면 프로그램이 커널로부터 여러 I/O 이벤트를 얻을 수 있다(실제로는 단일 스레드 내에서 I/O가 여전히 직렬로 처리되지만, 각 I/O 처리 시간이 짧기 때문에 거의 병렬 처리처럼 느껴진다). 이 접근 방식은 단일 프로세스나 스레드가 여러 소켓 연결을 유지할 수 있게 한다.

`select`는 모든 연결된 소켓을 파일 디스크립터 집합에 넣은 다음, `select` 함수를 호출하여 파일 디스크립터 집합을 커널에 복사함으로써 멀티플렉싱을 구현한다. 커널은 파일 디스크립터 집합을 순회하는 다소 원시적인 방식으로 네트워크 이벤트를 확인한다. 이벤트를 감지하면 해당 소켓을 읽기 가능 또는 쓰기 가능으로 표시한 다음, 전체 파일 디스크립터 집합을 사용자 공간으로 다시 복사한다. 사용자 공간에서는 프로그램이 다시 집합을 순회하여 읽기 또는 쓰기 가능한 소켓을 찾은 후 처리해야 한다.

`select`는 고정 길이 비트맵을 사용하여 파일 디스크립터 집합을 표현하며, 지원되는 파일 디스크립터 수가 제한된다. Linux에서는 이 제한이 커널의 `FD_SETSIZE`로 정의되며, 기본 최대값은 1024이다.

> Linux에서 select()는 소켓 파일 디스크립터를 "읽기 준비 완료"로 보고할 수 있지만, 이후의 읽기는 블로킹될 수 있다. 예를 들어 데이터가 도착했지만 검사 결과 체크섬이 잘못되어 폐기된 경우에 이런 일이 발생할 수 있다. 파일 디스크립터가 잘못 준비 완료로 보고되는 다른 상황도 있을 수 있다. 따라서 블로킹되지 않아야 하는 소켓에는 O_NONBLOCK을 사용하는 것이 더 안전할 수 있다.

`poll`은 기본적으로 더 많은 fd를 저장할 수 있는 연결 리스트를 사용한다. `poll`과 `select` 모두 전체 fd 집합을 순회해야 하며 시간 복잡도는 O(n)이고, **사용자 공간과 커널 공간 간에 fd 집합을 자주 복사해야 하므로** 성능이 낮다.

`epoll`은 `select/poll`의 두 가지 문제점을 해결한다:

1. 레드-블랙 트리를 사용하여 모니터링할 fd를 추적하므로 작업 시간 복잡도가 O(logn)으로 줄어든다. `epoll`은 매번 전체 소켓 집합이 아닌 모니터링할 소켓만 전달하면 되므로 데이터 복사와 메모리 할당이 크게 줄어든다.
2. `epoll`은 *EventLoop* 메커니즘을 채택한다. 소켓 이벤트가 발생하면 `콜백 함수`를 통해 준비 이벤트 큐에 추가된다. 사용자는 `epoll_wait()`를 호출하여 준비 큐를 가져오며, 전체 소켓 집합을 스캔하지 않아 효율성이 향상된다.

`epoll` 트리거 모드는 기본적으로 LT이다:

* 엣지 트리거(ET): 엣지 트리거 모드를 사용할 때, 모니터링되는 소켓 디스크립터에 읽기 가능 이벤트가 있으면 **서버는 `epoll_wait`에서 한 번만 깨어난다**. 프로세스가 `read`를 호출하여 커널에서 데이터를 가져오지 않더라도 여전히 한 번만 깨어난다. 따라서 프로그램은 커널 버퍼의 모든 데이터를 한 번에 읽어야 한다.
* 레벨 트리거(LT): 레벨 트리거 모드를 사용할 때, 모니터링되는 소켓에 읽기 가능 이벤트가 있으면 **서버는 커널 버퍼 데이터가 `read` 함수에 의해 완전히 읽힐 때까지 계속 `epoll_wait`에서 깨어난다**. 이는 읽을 데이터가 있음을 알리기 위한 것이다.

## Part 2 Reactor
`epoll`이 폴링 대신 *EventLoop*를 사용하여 동작에 응답하는 방식은 **Reactor 패턴**이라고도 한다.

### 2.1 단일 Reactor 단일 프로세스/단일 스레드
아키텍처 다이어그램:
![단일 Reactor 단일 프로세스/단일 스레드](https://i.postimg.cc/P53gFj6M/Reactor.webp)

* Reactor: 이벤트를 수신하고 디스패치한다
* Acceptor: Reactor가 디스패치한 **연결 설정** 이벤트를 수신하고 새 연결을 설정한다
* Handler: Reactor가 디스패치한 **비즈니스** 이벤트를 수신하고 비즈니스 로직을 처리한다

단일 프로세스/단일 스레드의 단점은 명백하다:

1. 멀티 코어 CPU 성능을 충분히 활용할 수 없다
2. Handler가 비즈니스 로직을 처리하는 동안 다른 연결의 이벤트에 응답할 수 없다

> 이 패턴은 기본적으로 더 이상 사용되지 않으며, 최신 버전의 Redis도 단일 스레드 모드를 포기했다.


### 2.2 단일 Reactor 다중 프로세스/스레드
아키텍처 다이어그램:
![단일 Reactor 다중 프로세스/스레드](https://i.postimg.cc/8C7q209g/Reactor.webp)

다중 프로세스/스레드 + 스레드 풀을 사용하면 단일 프로세스/단일 스레드의 문제를 부분적으로 해결한다:

1. 다중 프로세스/스레드가 CPU 성능을 충분히 활용한다
2. CPU 집약적인 비즈니스 로직의 경우 응답 속도가 향상된다

그러나 단일 Reactor에도 단점이 있다. Reactor 자체가 성능 병목이 된다. 장시간 지속되는 높은 요청 부하에서 Reactor의 성능이 전체 시스템의 성능에 영향을 미친다.

[nix](https://docs.rs/nix/0.26.4/nix/sys/index.html)를 사용한 Rust의 간단한 구현:
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

### 2.3 다중 Reactor 다중 프로세스/스레드

아키텍처 다이어그램:
![다중 Reactor 다중 프로세스/스레드](https://i.postimg.cc/QMvRhqZ9/Reactor.webp)

여러 Reactor를 도입하면 MainReactor는 연결 설정 이벤트를 처리하고 이 이벤트를 Acceptor에 디스패치하는 역할만 한다. Acceptor가 연결을 설정하면 새 연결을 SubReactor에 할당한다. SubReactor는 설정된 연결을 수신하고 이벤트를 Handler에 디스패치하여 이벤트 처리를 수행한다.

## Part 3 Proactor
세 가지 Reactor 아키텍처 설계가 있으며, 소켓이 블로킹 I/O를 사용하든 비블로킹 I/O를 사용하든 본질적으로 동기 작업이다. **사용자 공간에서 커널 공간으로의 전환**과 **`syscall`** 호출은 성능 오버헤드를 발생시킨다.

Proactor는 **비동기 I/O**를 통해 컨텍스트 스위치와 `syscall` 호출을 줄여 네트워크 모델의 성능을 더욱 향상시킨다.

Proactor와 Reactor의 차이점:

* Reactor: 커널이 애플리케이션/스레드에 "fd가 읽기/쓰기 가능"임을 알리면, 애플리케이션이 직접 `read/write`를 시작한다. 커널은 해당 `read/write` 호출 중에 데이터를 애플리케이션 버퍼로 복사한다.
* Proactor: 애플리케이션/스레드가 먼저 비동기 I/O 요청을 제출한다(보통 버퍼를 커널/드라이버에 전달). 커널/드라이버가 백그라운드에서 데이터 전송을 완료하고 데이터를 해당 버퍼에 직접 쓴 다음, 애플리케이션/스레드에 "완료 이벤트"를 알린다(결과/바이트 수 포함).

![Reactor-Proactor-Time-Flow](https://i.postimg.cc/gjfkBYhX/Reactor-Proactor-Time-Flow.png)

서로 다른 비동기 구현은 버퍼와 커널 데이터 전송에 관해 약간의 차이가 있다:

* 버퍼: 버퍼는 사용자 공간에 존재한다. 진정한 Proactor 구현(Windows IOCP, Linux io\_uring)에서 커널은 버퍼의 물리 페이지를 고정/등록한 다음, **커널이 쓰거나 DMA 전송**하여 데이터를 버퍼에 직접 쓴다. 호환성을 위한 일부 사용자 공간 비동기 구현은 먼저 데이터를 커널 버퍼에 쓴 다음, 커널 버퍼에서 사용자 버퍼로 복사한다.
* 데이터 전송: 비동기 I/O 요청을 제출하는 애플리케이션/스레드는 데이터 준비에 대해 걱정할 필요가 없다. Proactor에서는 데이터 준비와 전송을 커널이 처리한다. 역사적으로 많은 Linux 구현의 POSIX AIO는 커널 스레드 풀을 사용하여 비동기를 시뮬레이션한다(커널이 스레드를 생성하여 동기 읽기를 수행한 다음 알림). 의미적으로는 Proactor처럼 보이지만, 기본 메커니즘은 여전히 스레드가 수행하는 동기 I/O이다. 최신 커널의 `io_uring`은 "커널이 완료한 I/O를 사용자 버퍼에 직접 쓰는" 기능에 가까운 능력을 제공하며, 고정 및 등록된 버퍼로 추가 복사를 줄이거나 피할 수 있다.

의심할 여지 없이 Reactor는 더 성숙하고 널리 채택된 크로스 플랫폼 설계이다. 진정한 Proactor는 OS/드라이버 수준의 지원이 필요하다. Windows IOCP는 성숙한 예이며, Linux의 `io_uring`은 점점 진정한 Proactor에 가까워지고 있지만 모든 플랫폼이 이를 지원하는 것은 아니다.

## Part 4 Reactor/Proactor의 최소 구현

### 4.1 최소 `epoll` (Reactor) 에코 서버

비블로킹 소켓 + `epoll` 이벤트 알림을 사용한다. 커널은 소켓이 "읽기 가능"할 때 알리며, 프로그램은 `recv`를 호출하여 데이터를 읽는다(애플리케이션이 시작하는 I/O).

* 애플리케이션은 fd를 `epoll`에 등록하고, 커널은 fd가 읽기/쓰기 가능할 때 애플리케이션에 알린다(`epoll_wait` 반환을 통해)
* 이벤트를 받으면 애플리케이션이 `recv/read`를 호출하여 커널에서 데이터를 읽는다(실제 데이터 복사는 애플리케이션이 시작)
* 일반적인 경로는 `epoll_wait`(알림) + `read`(데이터 복사), 두 번의 사용자/커널 전환을 포함한다

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

컴파일:
```bash
gcc -std=gnu11 -O2 -Wall epoll_echo.c -o epoll_echo
./epoll_echo
```

### 4.2 io\_uring (Proactor 유사) 최소 에코 서버

`liburing`을 사용하여 비동기 `accept/read/send` 요청을 제출한다. 커널(또는 드라이버)이 백그라운드에서 I/O를 완료하고 완료 시 `completion`을 통해 사용자에게 알린다. `io_uring`을 지원하는 Linux 커널이 필요하다.

* 애플리케이션은 I/O 요청(`accept/read/write`)을 커널(Submission Queue, SQ)에 제출한다. 커널/드라이버는 백그라운드에서 I/O를 완료하고 완료 결과를 Completion Queue(CQ)에 넣는다.
* 애플리케이션은 Completion Queue Events(CQE)를 통해 "완료된" 결과를 얻으며, 제출 시 쓸 사용자 버퍼를 직접 지정할 수 있다.

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

컴파일:
```bash
gcc -std=gnu11 -O2 -Wall uring_echo.c -o uring_echo -luring
./uring_echo
```

## Part 5 코루