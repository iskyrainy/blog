---
title: Rustクロスコンパイル
category: Tech
tag: [Rust, Linux]
date: 2026-08-21T00:52:19+08:00
---


## はじめに
月初めに忙しい合間を縫って、こっそりRustで24年の小さなモジュールを書き直した。詳細はそのモジュールを書き直したblogを参照してほしい。このblogはまだ書く時間がなくて、今月末までに時間を捻出して完成させたい。😮‍💨

> **人生天地の間、白駒の隙を過ぐるがごとし、忽ちにして已む。**

時間が経つのはあまりに速い。学生の頃は時間が足りないと感じることなどほとんどなかったが、働き始めてからはよく時間が足りないと嘆くようになった。1日24時間、睡眠に7時間、食事に2時間、そして1日で最も美しい10時間を通勤と仕事に費やす。こう計算すると、*もし*残業しなければ、1日に自由に使える時間はわずか4-5時間しかない。

## 万年CentOS
話を戻すと、モジュールを書き直した後、サーバーにデプロイして古いモジュールを置き換えようとした。デプロイ時に大問題が発覚した。サーバーのOSは依然としてCentOS 7で、glibcのバージョンを見て絶望した。
```bash
[root@a325dd24fdc9 ~]# ./app
./app: error while loading shared libraries: libssl.so.3: cannot open shared object file: No such file or directory

# compiling env
$ openssl version
OpenSSL 3.5.6 7 Apr 2026 (Library: OpenSSL 3.5.6 7 Apr 2026)
$ ldd --version
ldd (Debian GLIBC 2.41-12+deb13u3) 2.41
Copyright (C) 2024 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
Written by Roland McGrath and Ulrich Drepper.

# server env
[root@dc329ea8a02c ~]# openssl version
OpenSSL 1.0.2k-fips  26 Jan 2017
[root@dc329ea8a02c ~]# ldd --version
ldd (GNU libc) 2.17
Copyright (C) 2012 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
Written by Roland McGrath and Ulrich Drepper.

# バイナリファイルの依存関係を確認
$ ldd target/debug/app
        linux-vdso.so.1 (0x00007f3cfd0c5000)
        libssl.so.3 => /lib/x86_64-linux-gnu/libssl.so.3 (0x00007f3cfcf90000)
        libcrypto.so.3 => /lib/x86_64-linux-gnu/libcrypto.so.3 (0x00007f3cfa800000)
        libgcc_s.so.1 => /lib/x86_64-linux-gnu/libgcc_s.so.1 (0x00007f3cfcf63000)
        libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007f3cfaf10000)
        libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f3cfa60c000)
        /lib64/ld-linux-x86-64.so.2 (0x00007f3cfd0c7000)
        libz.so.1 => /lib/x86_64-linux-gnu/libz.so.1 (0x00007f3cfcf41000)
        libzstd.so.1 => /lib/x86_64-linux-gnu/libzstd.so.1 (0x00007f3cfae46000)
```

> ジョークを言おう。毎日セキュリティスキャンでパッチを当てて脆弱性を修正しているのに、CentOS 7なんだよ。😇

一般的に、ターゲットA上で実行したい場合、**3**つの方法がある：
- 実行環境を修正し、Aがコンパイル環境と同じ条件を持つようにする；
- 動的リンク。ただしAと同じ環境でコンパイルする必要がある；
- 静的リンク。コンパイル環境に制限はない；


## 実行環境を修正..する？
*実行環境を勝手に変更することは強く推奨しない。自分が何をしているか理解している場合を除いて。*

もちろん、実行環境にdockerやpodmanなどのコンテナ環境があれば、イメージをパッケージ化することで間接的に実行環境を*修正*することもできる。しかしglibcとopensslの変更は絶対に推奨しない。実行環境を変更できない以上、実行可能バイナリファイル側でなんとかするしかない。

## 動的リンク
コンパイルされたバイナリファイルが実行環境の動的依存ライブラリを正しくロードしてリンクできるようにするには、実行環境の依存ライブラリと一致する環境でコンパイルする必要がある。よくある方法は、実行環境と同じVM/コンテナを作成し、そのVM/コンテナ内でコンパイルすることだ。

`cargo-cross`は、クロスコンパイルをサポートするRustプロジェクトのビルド、テスト、チェックを行うためのツールである。`cross`は必要なクロスコンパイルツールチェーンを自動的にダウンロードして設定するため、複数のプラットフォームでさまざまなRustコマンドを簡単に実行できる。
```bash
# Install from crate
cargo install cargo-cross

# Install from GitHub
cargo install cargo-cross --git https://github.com/zijiren233/cargo-cross
```

そして`cross`を通じてコンパイルを実行できる。`cross`は指定されたコンパイル環境イメージを取得し、一時コンテナを作成してコンパイルを完了する。中国国内ではGitHubイメージの取得が遅い可能性があるため、`Cross.toml`で国内ミラーソースを指定することを推奨する。
```toml
[target.x86_64-unknown-linux-gnu]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-gnu:main-centos"

[target.x86_64-unknown-linux-musl]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-musl:main"
```

そして`cross build --target x86_64-unknown-linux-gnu --release`を実行してコンパイルを開始する。これで完了か？否。コードがコンテナ内に存在しない依存関係に依存している場合、コンパイルも失敗する。例えば、`cross`の`cross-rs/x86_64-unknown-linux-gnu:main-centos`イメージ内にはopenssl-develがないため、コードがネイティブopensslに依存しているとコンパイルが失敗する。

しかし幸いなことに、`cross`は`pre-build`を通じてコンパイルアクションの前にコマンドを事前実行できるので、これを利用して依存関係をインストールできる：
```toml
...
[target.x86_64-unknown-linux-gnu]
pre-build = ["yum install -y openssl-devel"]
...
```

これで終わりだと思ったか？nonono、これはCentOSだ、そんなに簡単ではない。CentOS 7のyum公式リポジトリはすでにアーカイブされているため、`pre-build`の依存関係インストールコマンドが実行に失敗し、コンパイルが失敗する可能性がある。そのため、`pre-build`時にミラーソースを変更して依存関係が正しくインストールされるようにする必要がある。

これはあまりにも馬鹿げているので、私はソースの変更を試みることすらしなかった。しかしソース変更を諦めたからといってopensslが使えないわけではない。Rustはコンパイル時にopensslを自前でビルドできる。以下のようにするだけでよい：
```toml
...
[features]
default = ["openssl/vendored"]

[dependencies]
openssl = { version = "0.10.81", features = ["vendored"] }
openssl-sys = { version = "0.9.117", features = ["vendored"] }
...
```

`vendored` featureを有効にすることでソースからopensslをコンパイルする。以下は公式ドキュメントの`vendored` featureの説明である。opensslのコンパイルには**perl(and perl-core)**が必要なことに注意。

> If the vendored Cargo feature is enabled, the openssl-src crate will be used to compile and statically link to a copy of OpenSSL. The build process requires a C compiler, perl (and perl-core), and make. The OpenSSL version will generally track the newest OpenSSL release, and changes to the version are not considered breaking changes.

そして`cross build --target x86_64-unknown-linux-gnu --release`を実行してコンパイルを開始する。しかし話はまだ終わらない😅。opensslのコンパイルにはperlとperl-coreも必要だが、コンテナにはopensslをコンパイルするための依存関係であるperl/perl-coreもない。ソースからopensslをコンパイルしたいなら、まずopensslをコンパイルする環境をインストールしなければならず、無限ループである。

yumソースを変更しなければ、動的リンクは基本的にここまでとなる。

> 動的リンクを行う方法はあと2つある。
> 1. crossとcrossイメージを使わず、自分でコンパイルコンテナを準備し、依存関係を事前にインストールしてからコンテナ内部でコンパイルする。(tips: CentOS 7ではyumでrustcとcargoをインストールできるが、version 2021以下しかサポートしていない。version 2024の場合は、コードをversion 2021に変更する必要がある。
> 2. 依存しているライブラリを置き換え可能な場合、置き換えてからcrossでクロスコンパイルする。例えば私のプロジェクトはopensslに依存しており、opensslに依存する依存ライブラリがすべてrustlsをサポートしているなら、すべてのopenssl依存をrustlsに置き換えてからcrossでクロスコンパイルできる。この道は検証済みで実行可能である。他の置き換え可能な依存関係も同様。

## 静的リンク
静的リンクの普及率は動的リンクには遠く及ばないが、現在のdevopsの発展の下では、自前でデプロイするサービスにとって、静的リンクはすでに生産で十分に便利に使える。納品が必要な製品にとっては、静的リンクはセキュリティ上の問題から動的リンクと比べて劣位にある。

このような💩のような環境へのデプロイには、静的リンクは比類のない優位性を持つ。静的リンクにはlibcが2種類ある：gnuとmusl。したがって2つの場合に分けて紹介する。

### musl
muslはC標準ライブラリをベースに構築された実装であり、POSIX 2008標準とC11標準に準拠し、広く使われているが非標準のLinux、BSD、glibc関数の多くも実装している。muslは軽量、高速、シンプル、自由で、静的リンクのために設計されているため、静的リンクの第一選択である。musl環境をインストールしてコンパイルを開始する:
```bash
# Debian
$ sudo apt install musl musl-tools musl-dev

# compile
$ cargo build --target x86_64-unknown-linux-musl --release --feature openssl/vendored
```

最終的に得られた実行可能バイナリを確認する:
```bash
$ ldd target/x86_64-unknown-linux-musl/release/app
        statically linked
```

見ての通り、最終的に生成されたバイナリは静的リンクであり、実行環境のライブラリに依存しない。

### gnu
> glibcは静的リンクのために特別に設計されたわけではないため、場合によってはglibcを静的リンクすると実行時エラーが発生する。

muslですでに簡単に静的リンクされたバイナリファイルを生成できるのに、なぜglibcで静的リンクするのか？もちろん、glibcが特定のシナリオでより良いパフォーマンスを持つからである🤠。

glibcで静的リンクするには、z(zlib)とzstd(Zstandard)という2つの圧縮ライブラリの静的バージョンをインストールする必要がある。
```bash
sudo apt install zlib1g-dev libzstd-dev
```

そしてコンパイル時に静的リンクファイルとしてコンパイルすることを指定する。
```bash
$ RUSTFLAGS="-C target-feature=+crt-static" cargo build --target x86_64-unknown-linux-gnu --release --feature openssl/vendored

$ ldd target/x86_64-unknown-linux-gnu/release/app 
        statically linked 
```

## Final
最終的に長い間試行錯誤した末、クロスコンパイルを通じてRustのクロスプラットフォーム特性を実践した。

ここまで書いた時点で、すでに夜12:44である。光陰は過ぎやすく、時間は慌ただしく、やりたいことは多すぎるができることは少ない。満杯のtodolistを前に、修正せざるを得ない。そして今年から気づいたのだが、やりたいことが多すぎて、やっていることを絶えず切り替えることで、今では明らかに集中力が以前より落ちている。そろそろ注意力を整え、集中力を養うべきだ。😵