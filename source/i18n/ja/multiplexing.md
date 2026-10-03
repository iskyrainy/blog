---
title: I/O多重化
category: Tech
tag: [Linux, Rust]
date: 2025-07-26T14:06:55+08:00
---


# I/O多重化
## Part 1 Socket
### 1.1 Socketモデル
プロセスはどのようにしてネットワーク越しに通信するのか？
現実世界では、名前などの情報によって相手を特定し、コミュニケーションを取ることができる。同様に、TCP/IPではIPアドレスでホストを特定し、ホスト内ではプロトコルとポートの組み合わせでプログラムのサービスを特定する。したがって、`protocol + IP + Port`によってネットワーク内のアプリケーションを一意に識別できる。TCP/IPプロトコルを利用するアプリケーションは、通常、アプリケーションプログラミングインターフェースであるUNIX BSDソケットを利用して、ネットワークプロセス間の通信を実現する。

**`socket`とは何か？**
ソースコードと構造の観点から見ると、socketはユーザー空間とカーネルのネットワークプロトコルスタックとの間の相互作用を統一的に抽象化したものである。Unix/Linuxの基本哲学の一つに「すべてはファイルである」というものがあり、すべては「open → read/write → close」のパターンで操作できる。Linuxシステムにとって、socketも特殊なファイルの一種であり、システムはそれを操作するためのインターフェース（`socket`、`bind`、`connect`、`accept`、`listen`、`send`、`recv`、`close`など）を提供している。

TCPソケット通信の場合：

1. **create**: `socket()`を呼び出してソケットを作成し、`bind()`を呼び出してソケットを`IP:port`にバインドする。
2. **listen**: `inet_listen()`を呼び出してTCPソケットをリスニング状態にし、ハーフコネクションキューを初期化し、ソケットを対応するプロトコルファミリのリスニングリストに追加することで、受信したSYNパケットをマッチングしてキューに入れられるようにする。
3. **connect/accept**:

   * **accept**: フルコネクションキューが空でない場合、`accept()`はカーネルのTCPフルコネクションキューから`struct sock *new_sk`を取り出す。
   * **connect**: カーネルの`struct sock`を割り当て、宛先IP/ポートを設定し、`connect()`を呼び出して3ウェイハンドシェイクを開始する。
4. **send/recv**: データの書き込みと読み取りを行い、通信を実行する。

### 1.2 マルチソケットモデル
最も基本的なソケットモデルでは、同期的・ブロッキングな1対1の通信しか行えない。しかし、サービスは単一の接続のみを処理するわけにはいかない。できるだけ多くの接続を処理できる能力は重要な関心事である。ファイルディスクリプタ（fd）とメモリによって制限されるため、サーバーが確立できる接続数は有限である。しかし、この有限の接続数であっても、同期ブロッキング通信モデルでは需要を満たせない。

`send/recv`操作はブロッキングであるため、サービスは接続確立のみに集中し、`send/recv`を子プロセスに委譲して処理するように設計できる。この**マルチプロセスモデル**は、複数の接続を同時に処理するという要件を満たす。

プロセスと比較して、スレッドはより軽量な実行単位であり、コンテキストスイッチとリソース消費を大幅に削減する。`send/recv`処理にプロセスの代わりにスレッドを使用し、スレッドプールを採用してスレッドの頻繁な生成と破棄を避けることで、このモデルは従来の性能を最大限に引き出せる（仮想スレッド/コルーチンを使用しない場合）。

しかし、スレッド数は無制限に作成できるわけではないため、このモデルは従来、サーバーの性能を理論上の最大値に近づけることはできなかった。

### 1.3 多重化
ほとんどの場合、I/O操作のCPU使用率は非常に低く、CPUはほとんどの時間をI/Oの待機に費やしている。このことから、各スレッドを単一のソケットの維持に割り当てることは非常に非効率的であることが明らかである。`select/poll/epoll`システムコールを使用することで、プログラムはカーネルから複数のI/Oイベントを取得できる（実際には、単一のスレッド内ではI/Oは依然として直列に処理されるが、各I/Oの処理時間が短いため、ほぼ並列処理のように感じられる）。このアプローチにより、単一のプロセスまたはスレッドで複数のソケット接続を維持できる。

`select`は、すべての接続されたソケットをファイルディスクリプタセットに格納し、`select`関数を呼び出してファイルディスクリプタセットをカーネルにコピーすることで多重化を実装する。カーネルはかなり粗い方法でネットワークイベントをチェックする。つまり、ファイルディスクリプタセットを走査する。イベントを検出すると、対応するソケットを読み取り可能または書き込み可能としてマークし、ファイルディスクリプタセット全体をユーザー空間にコピーして戻す。ユーザー空間では、プログラムは再びセットを走査して、処理する前に読み取り可能または書き込み可能なソケットを見つける必要がある。

`select`は固定長のビットマップを使用してファイルディスクリプタセットを表現し、サポートされるファイルディスクリプタの数は制限されている。Linuxでは、この制限はカーネルの`FD_SETSIZE`によって定義され、デフォルトの最大値は1024である。

> Linuxでは、select()はソケットのファイルディスクリプタを「読み取り可能」と報告しても、その後のreadがブロックする可能性がある。これは例えば、データが到着したが検査時にチェックサムが間違っていて破棄された場合に起こりうる。ファイルディスクリプタが誤って準備完了と報告される他の状況も存在しうる。したがって、ブロックすべきでないソケットにはO_NONBLOCKを使用する方が安全である

`poll`はリンクリストを使用し、デフォルトでより多くのfdを格納できる。`poll`と`select`はどちらもfdセット全体を走査する必要があり、時間計算量はO(n)であり、**ユーザー空間とカーネル空間の間でfdセットを頻繁にコピーする必要がある**ため、性能が低い。

`epoll`は`select/poll`の2つの課題を解決する：

1. 監視するfdを追跡するために赤黒木を使用し、操作の時間計算量をO(logn)に削減する。`epoll`は毎回ソケットセット全体ではなく監視するソケットのみを渡すだけでよく、データコピーとメモリ割り当てを大幅に削減する。
2. `epoll`は*EventLoop*メカニズムを採用している。ソケットイベントが発生すると、`call back function`を介してレディイベントキューに追加される。ユーザーは`epoll_wait()`を呼び出すことでレディキューを取得し、ソケットセット全体をスキャンするのではなく、効率を向上させる。

`epoll`のトリガーモードはデフォルトでLTとなる：

* エッジトリガー（ET）: エッジトリガーモードを使用する場合、監視対象のソケットディスクリプタに読み取り可能イベントがあると、**サーバーは`epoll_wait`から一度だけウェイクアップする**。たとえプロセスがカーネルからデータを取得するために`read`を呼び出さなくても、一度しかウェイクアップしない。したがって、プログラムはカーネルバッファからすべてのデータを一度に読み取ることを保証しなければならない。
* レベルトリガー（LT）: レベルトリガーモードを使用する場合、監視対象のソケットに読み取り可能イベントがあると、**サーバーはカーネルバッファのデータが`read`関数によって完全に読み取られるまで`epoll_wait`からウェイクアップし続ける**。これは読み取るべきデータがあることを通知することを目的としている。

## Part 2 Reactor
`epoll`がポーリングの代わりに*EventLoop*を使用してアクションに応答するモードは、**Reactorパターン**とも呼ばれる。

### 2.1 シングルReactorシングルプロセス/シングルスレッド
アーキテクチャ図：
![シングルReactorシングルプロセス/シングルスレッド](https://i.postimg.cc/P53gFj6M/Reactor.webp)

* Reactor: イベントをリッスンしてディスパッチする
* Acceptor: Reactorからディスパッチされた**接続確立**イベントを受信し、新しい接続を確立する
* Handler: Reactorからディスパッチされた**ビジネス**イベントを受信し、ビジネスロジックを処理する

シングルプロセス/シングルスレッドの欠点は明らかである：

1. マルチコアCPUの性能を十分に活用できない
2. Handlerはビジネスロジックを処理している間、他の接続からのイベントに応答できない

> このパターンは基本的にもう使われていない。Redisの最新バージョンもシングルスレッドモードを放棄している。


### 2.2 シングルReactorマルチプロセス/マルチスレッド
アーキテクチャ図：
![シングルReactorマルチプロセス/マルチスレッド](https://i.postimg.cc/8C7q209g/Reactor.webp)

マルチプロセス/マルチスレッド + スレッドプールを使用することで、シングルプロセス/シングルスレッドの問題を部分的に解決できる：

1. マルチプロセス/マルチスレッドがCPU性能を十分に活用する
2. CPU集約型のビジネスロジックに対して、応答速度を向上させる

しかし、シングルReactorにも欠点がある。Reactor自体が性能のボトルネックとなる。長時間継続する高リクエスト負荷の下では、Reactorの性能がシステム全体の性能に影響を与える。

[nix](https://docs.rs/nix/0.26.4/nix/sys/index.html)を使用したRustでの簡単な実装：
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

### 2.3 マルチReactorマルチプロセス/マルチスレッド

アーキテクチャ図：
![マルチReactorマルチプロセス/マルチスレッド](https://i.postimg.cc/QMvRhqZ9/Reactor.webp)

マルチReactorを導入した後、MainReactorは接続確立イベントの処理のみを担当し、これらのイベントをAcceptorにディスパッチする。Acceptorが接続を確立すると、新しい接続をSubReactorに割り当てる。SubReactorは確立された接続をリッスンし、イベントをHandlerにディスパッチしてイベント処理を行う。

## Part 3 Proactor
Reactorのアーキテクチャ設計には3つあり、ソケットがブロッキングI/Oを使用するか非ブロッキングI/Oを使用するかに関わらず、本質的には同期操作である。**ユーザー空間からカーネル空間への切り替え**と**`syscall`**呼び出しは性能オーバーヘッドを生じさせる。

Proactorは**非同期I/O**を通じてコンテキストスイッチと`syscall`呼び出しを削減し、ネットワークモデルの性能をさらに向上させる。

ProactorとReactorの違い：

* Reactor: カーネルはアプリケーション/スレッドに「fdが読み取り可能/書き込み可能である」ことを通知し、その後アプリケーション自身が`read/write`を開始する。カーネルはその`read/write`呼び出し中にデータをアプリケーションのバッファにコピーする。
* Proactor: アプリケーション/スレッドはまず非同期I/Oリクエストを送信する（通常、バッファをカーネル/ドライバに渡す）。カーネル/ドライバはバックグラウンドでデータ転送を完了し、そのバッファに直接データを書き込み、その後アプリケーション/スレッドに「完了イベント」（結果/バイト数とともに）を通知する。

![Reactor-Proactor-Time-Flow](https://i.postimg.cc/gjfkBYhX/Reactor-Proactor-Time-Flow.png)

非同期実装の違いにより、バッファとカーネルデータ転送に関していくつかの相違がある：

* バッファ: バッファはユーザー空間に存在する。真のProactor実装（Windows IOCP、Linux io\_uring）では、カーネルはバッファの物理ページをピン留め/登録し、**カーネルが書き込みまたはDMA転送**によってデータをバッファに直接書き込む。互換性のための一部のユーザー空間非同期実装では、まずデータをカーネルバッファに書き込み、その後カーネルバッファからユーザーバッファにコピーする。
* データ転送: 非同期I/Oリクエストを送信するアプリケーション/スレッドは、データ準備を気にする必要がない。Proactorでは、データ準備と転送はカーネルによって処理される。歴史的に、多くのLinux実装におけるPOSIX AIOは、カーネルスレッドプールを使用して非同期をシミュレートしている（カーネルがスレッドを生成して同期読み取りを実行し、その後通知する）。意味的にはProactorのように見えるが、基盤となるメカニズムは依然としてスレッドによって行われる同期I/Oである。最新カーネルの`io_uring`は、「カーネルが完了したI/Oをユーザーバッファに直接書き込む」能力に近づいており、固定および登録されたバッファにより余分なコピーを削減または回避している。

間違いなく、Reactorはより成熟し、広く採用されているクロスプラットフォーム設計である。真のProactorはOS/ドライバレベルのサポートを必要とする。Windows IOCPは成熟した例であり、Linuxの`io_uring`はますます真のProactorに近づいているが、すべてのプラットフォームがサポートしているわけではない。

## Part 4 Reactor/Proactorの最小実装

### 4.1 最小`epoll`（Reactor）Echoサーバー

非ブロッキングソケット + `epoll`イベント通知を使用する。カーネルはソケットが「読み取り可能」になったときに通知し、プログラムは`recv`を呼び出してデータを読み取る（I/Oはアプリケーションが開始する）。

* アプリケーションはfdを`epoll`に登録し、カーネルはfdが読み取り可能/書き込み可能になったときにアプリケーションに通知する（`epoll_wait`の戻り値を介して）
* イベントを受信すると、アプリケーションは`recv/read`を呼び出してカーネルからデータを読み取る（実際のデータコピーはアプリケーションが開始する）
* 一般的なパスには、`epoll_wait`（通知）+ `read`（データコピー）が含まれ、2回のユーザー/カーネル遷移がある

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

コンパイル：
```bash
gcc -std=gnu11 -O2 -Wall epoll_echo.c -o epoll_echo
./epoll_echo
```

### 4.2 io\_uring（Proactor的）最小Echoサーバー

`liburing`を使用して非同期の`accept/read/send`リクエストを送信する。カーネル（またはドライバ）はバックグラウンドでI/Oを完了し、完了時に`completion`を介してユーザーに通知する。Linuxカーネルが`io_uring`をサポートしている必要がある。

* アプリケーションはI/Oリクエスト（`accept/read/write`）をカーネルに送信する（Submission Queue、SQ）。カーネル/ドライバはバックグラウンドでI/Oを完了し、完了結果をCompletion Queue（CQ）に入れる。
* アプリケーションはCompletion Queue Events（CQE）を通じて「完了した」結果を取得し、送信時に書き込み先のユーザーバッファを直接指定できる。

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

コンパイル：
```bash
gcc -std=gnu11 -O2 -Wall uring_echo.c -o uring_echo -luring
./uring_echo
```

## Part 5 コルーチン（ユーザー空間スレッド）におけるReactor
Goのgoroutine、Javaの仮