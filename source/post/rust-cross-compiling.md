---
title: Rust交叉编译
category: Tech
tag: [Rust, Linux]
date: 2026-08-21T00:52:19+08:00
---


## 前言
月初忙里偷闲，悄悄用Rust重写了一个24年的小模块，具体详情参见重写该模块的blog。这篇blog还没来得及写，争取月底挤时间完成吧。😮‍💨

> **人生天地之间，若白驹过隙，忽然而已。**

时间跑得太快，从前上学时我很少发觉时间不够用，而工作后常常感慨时间太少。一天24小时，睡觉用去7小时，吃饭用去2小时，每天中最美好的10个小时花在通勤和工作。这样算来*如果*不加班，一天仅仅有4-5小时的时间可以自由支配。

## 万年CentOS
话说回来，重写完模块我准备发到服务器替换掉老模块。部署的时候才发现大问题，服务器OS依旧是CentOS 7，一看glibc版本天塌了。
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

# 检查二进制文件依赖
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

> 讲个笑话，天天安扫打补丁升级漏洞，但是CentOS 7。😇

通常来说，对于想在目标A上运行，有**3**种办法：
- 修复运行环境，使A具有和编译环境相同的条件；
- 动态链接，但需要在与A相同的环境下编译；
- 静态链接，编译环境没有限制；


## 修复运行环境..吗？
*强烈不建议随便变更运行环境，除非你清楚自己在做什么。*

当然如果运行环境有docker或podman之类的容器环境，那也可以通过打包镜像来间接的*修复*运行环境。但glibc和openssl是绝对不建议变动的，既然运行环境不能改了，那就只能从可执行二进制文件上下功夫。

## 动态链接
如果想编译出的二进制文件可以正确的加载链接运行环境的动态依赖库，需要在和具有和运行环境依赖库一致的环境下进行编译。比较常见的方式创建一个和运行环境一样的VM/容器，在VM/容器内编译。

`cargo-cross`是一个用于构建、测试和检查支持交叉编译的Rust项目。`cross`会自动下载并配置必要的交叉编译工具链，从而轻松地在多个平台上执行各种Rust命令。
```bash
# Install from crate
cargo install cargo-cross

# Install from GitHub
cargo install cargo-cross --git https://github.com/zijiren233/cargo-cross
```

然后可以通过`cross`来完成编译动作，`cross`会拉取指定的编译环境镜像，并创建临时容器完成编译。国内拉取github镜像可能比较慢，建议通过`Cross.toml`指定国内镜像源。
```toml
[target.x86_64-unknown-linux-gnu]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-gnu:main-centos"

[target.x86_64-unknown-linux-musl]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-musl:main"
```

然后通过运行`cross build --target x86_64-unknown-linux-gnu --release`开始编译。这样就好了吗？非也。如果代码依赖于容器内不存在的依赖，那么编译也会失败。比如`cross`的`cross-rs/x86_64-unknown-linux-gnu:main-centos`镜像内是没有openssl-devel的，所以当代码依赖于native openssl时编译就会失败。

不过还好`cross`允许通过`pre-build`来在编译动作之前预执行命令，我们可以借此安装依赖：
```toml
...
[target.x86_64-unknown-linux-gnu]
pre-build = ["yum install -y openssl-devel"]
...
```

以为这样就完了吗？nonono，这可是CentOS，哪有这么简单。由于CentOS 7的yum官方源已经存档，所以`pre-build`的安装依赖命令可能会执行失败，进而导致编译失败。所以需要在`pre-build`时更换镜像源来保证依赖可以正确安装。

这太蠢了，我根本没有去尝试换源。但放弃换源并不代表不能使用openssl了，Rust可以通过在编译时自编译openssl，只需要通过：
```toml
...
[features]
default = ["openssl/vendored"]

[dependencies]
openssl = { version = "0.10.81", features = ["vendored"] }
openssl-sys = { version = "0.9.117", features = ["vendored"] }
...
```

通过开启`vendored` feature来从源码编译openssl。下面是官方文档对`vendored` feature的描述，注意编译openssl需要**perl(and perl-core)**。

> If the vendored Cargo feature is enabled, the openssl-src crate will be used to compile and statically link to a copy of OpenSSL. The build process requires a C compiler, perl (and perl-core), and make. The OpenSSL version will generally track the newest OpenSSL release, and changes to the version are not considered breaking changes.

然后再执行`cross build --target x86_64-unknown-linux-gnu --release`开始编译。然而事情还没完😅，注意到编译openssl还需要perl和perl-core，但是容器也没有编译openssl的依赖：perl/perl-core。如果想要从源码编译openssl，必须得先安装编译openssl的环境，无限套娃了属于是。

如果不更改yum源，动态链接基本就可以到此为止了。

> 还有两个方式可以进行动态链接。
> 1. 不使用cross和cross镜像，自行准备编译容器，预先装好依赖，再在容器内部进行编译。(tips: CentOS 7可以通过yum安装rustc和cargo，但只能支持version 2021及以下，如果是version 2024，则需要修改代码为version 2021。
> 2. 如果依赖的库可以被替代，替代后再通过cross交叉编译。例如我的项目依赖openssl，且依赖openssl的依赖库都支持rustls，那我就可以更换所有openssl依赖为rustls，再通过cross交叉编译，这条路我已验证是可行的。其他可替代依赖同理。

## 静态链接
虽然静态链接普及率远不及动态链接，但在现在devops的发展下，对于自部署服务，静态链接已经可以很方便的用于生产。对于需要交付的产品，静态链接还是因为安全问题对比动态链接存在劣势。

对于这种💩一样的环境部署，静态链接具有无与伦比的优势。静态链接因为存在两种libc：gnu和musl，因此也分两种情况进行介绍。

### musl
musl是基于C标准库构建的一个实现，与POSIX 2008标准和C11标准兼容，还实现了多数广泛使用但非标准的Linux、BSD和glibc函数。musl轻巧、快速、简单、自由，且专为静态链接而设计，绝对是静态链接的首要选择。安装musl环境并开始编译:
```bash
# Debian
$ sudo apt install musl musl-tools musl-dev

# compile
$ cargo build --target x86_64-unknown-linux-musl --release --feature openssl/vendored
```

检查最终得到的可执行二进制:
```bash
$ ldd target/x86_64-unknown-linux-musl/release/app
        statically linked
```

可以看到，最终生成的二进制是静态链接，不依赖运行环境的库。

### gnu
> glibc并非是特意为静态链接设计，因此在部分情况下对glibc进行静态链接会存在运行时错误。

musl既然已经可以很方便简单地生成静态链接的二进制文件，为什么还要通过glibc进行静态链接？当然是因为glibc在某些场景下拥有更好的性能🤠。

使用glibc进行静态链接，需要安装z(zlib)和zstd(Zstandard)这两个压缩库的静态版本。
```bash
sudo apt install zlib1g-dev libzstd-dev
```

然后在编译时指明编译为静态链接文件。
```bash
$ RUSTFLAGS="-C target-feature=+crt-static" cargo build --target x86_64-unknown-linux-gnu --release --feature openssl/vendored

$ ldd target/x86_64-unknown-linux-gnu/release/app 
        statically linked 
```

## Final
最终折腾许久我们还是通过交叉编译实践了Rust的跨平台特性。

写到此时，已经夜至12:44。光阴易逝，时间匆忙，想要做的事太多但能做的很少，面对满满的todolist，不得不修改。而且今年开始我注意到，想要做的事情太多，不停地切换在做的事导致现在注意力已明显不如从前。该好好调整注意力，培养专注力了。😵
