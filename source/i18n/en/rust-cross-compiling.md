---
title: Rust Cross-Compilation
category: Tech
tag: [Rust, Linux]
date: 2026-08-21T00:52:19+08:00
---


## Preface
At the beginning of the month, I stole some time from my busy schedule and quietly rewrote a small module from 2024 in Rust. For details, see the blog about rewriting that module. I haven't had time to write that blog yet; I'll try to squeeze in time before the end of the month to finish it. 😮‍💨

> **Between heaven and earth, human life is like a white colt passing through a crack—gone in an instant.**

Time runs too fast. When I was in school, I rarely felt that time was insufficient, but after starting work, I often lament that there is too little time. There are 24 hours in a day: 7 hours go to sleep, 2 hours to eating, and the best 10 hours of each day are spent on commuting and work. Calculated this way, *if* I don't work overtime, there are only 4-5 hours a day that I can freely dispose of.

## The Eternal CentOS
Anyway, after rewriting the module, I planned to deploy it to the server to replace the old module. It was only during deployment that I discovered the big problem: the server OS was still CentOS 7, and when I looked at the glibc version, it felt like the sky was falling.
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

# Check binary file dependencies
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

> Let me tell a joke: patching vulnerabilities every day with security scans, but on CentOS 7. 😇

Generally speaking, to run on target A, there are **3** approaches:
- Fix the runtime environment so that A has the same conditions as the compilation environment;
- Dynamic linking, but it needs to be compiled in an environment identical to A;
- Static linking, with no restrictions on the compilation environment;


## Fix the Runtime Environment.. Right?
*It is strongly not recommended to casually change the runtime environment unless you know what you are doing.*

Of course, if the runtime environment has a container environment such as Docker or Podman, then the runtime environment can also be indirectly *fixed* by packaging an image. But changing glibc and OpenSSL is absolutely not recommended. Since the runtime environment cannot be changed, the only option is to work on the executable binary file.

## Dynamic Linking
If you want the compiled binary to correctly load the dynamic dependency libraries of the runtime environment, you need to compile in an environment consistent with that of the runtime environment's dependency libraries. A common approach is to create a VM/container identical to the runtime environment and compile inside the VM/container.

`cargo-cross` is used to build, test, and inspect Rust projects that support cross-compilation. `cross` automatically downloads and configures the necessary cross-compilation toolchains, making it easy to execute various Rust commands on multiple platforms.
```bash
# Install from crate
cargo install cargo-cross

# Install from GitHub
cargo install cargo-cross --git https://github.com/zijiren233/cargo-cross
```

Then you can complete the compilation through `cross`. `cross` will pull the specified compilation environment image and create a temporary container to complete the compilation. Pulling GitHub images domestically may be slow, so it is recommended to specify a domestic mirror source via `Cross.toml`.
```toml
[target.x86_64-unknown-linux-gnu]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-gnu:main-centos"

[target.x86_64-unknown-linux-musl]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-musl:main"
```

Then start compiling by running `cross build --target x86_64-unknown-linux-gnu --release`. Is that all? Not quite. If the code depends on dependencies that do not exist in the container, the compilation will also fail. For example, `cross`'s `cross-rs/x86_64-unknown-linux-gnu:main-centos` image does not have openssl-devel, so when the code depends on native openssl, compilation will fail.

Fortunately, `cross` allows commands to be pre-executed before the compilation step via `pre-build`, which we can use to install dependencies:
```toml
...
[target.x86_64-unknown-linux-gnu]
pre-build = ["yum install -y openssl-devel"]
...
```

Did you think that was the end? Nonono, this is CentOS; it's not that simple. Since the official yum source for CentOS 7 has been archived, the dependency installation command in `pre-build` may fail, which will cause compilation to fail. Therefore, we need to change the mirror source during `pre-build` to ensure dependencies can be installed correctly.

This is too stupid. I didn't even try changing the source. But giving up on changing the source does not mean openssl can no longer be used. Rust can compile openssl itself at compile time, simply by:
```toml
...
[features]
default = ["openssl/vendored"]

[dependencies]
openssl = { version = "0.10.81", features = ["vendored"] }
openssl-sys = { version = "0.9.117", features = ["vendored"] }
...
```

By enabling the `vendored` feature to compile openssl from source. Below is the official documentation's description of the `vendored` feature. Note that compiling openssl requires **perl (and perl-core)**.

> If the vendored Cargo feature is enabled, the openssl-src crate will be used to compile and statically link to a copy of OpenSSL. The build process requires a C compiler, perl (and perl-core), and make. The OpenSSL version will generally track the newest OpenSSL release, and changes to the version are not considered breaking changes.

Then execute `cross build --target x86_64-unknown-linux-gnu --release` to start compiling. However, it's not over yet 😅. Notice that compiling openssl also requires perl and perl-core, but the container does not have the dependencies for compiling openssl either: perl/perl-core. If you want to compile openssl from source, you must first install the environment for compiling openssl. It's an infinite nesting doll.

If you do not change the yum source, dynamic linking basically ends here.

> There are two more ways to do dynamic linking.
> 1. Do not use cross or cross images; prepare your own compilation container, install dependencies in advance, and then compile inside the container. (tips: CentOS 7 can install rustc and cargo through yum, but it only supports version 2021 and below. If the version is 2024, you need to modify the code to version 2021.)
> 2. If the dependent libraries can be replaced, then use cross for cross-compilation after replacement. For example, my project depends on openssl, and all dependencies that depend on openssl support rustls. Then I can replace all openssl dependencies with rustls and use cross for cross-compilation. I have verified this path is feasible. The same applies to other replaceable dependencies.

## Static Linking
Although static linking is far less widespread than dynamic linking, with the current development of DevOps, for self-hosted services, static linking can already be conveniently used in production. For products that need to be delivered, static linking still has disadvantages compared with dynamic linking due to security issues.

For this 💩-like environment deployment, static linking has unparalleled advantages. Because there are two kinds of libc for static linking, gnu and musl, I will introduce it according to these two cases.

### musl
musl is an implementation built on the C standard library. It is compatible with the POSIX 2008 standard and the C11 standard, and also implements many widely used but non-standard Linux, BSD, and glibc functions. musl is lightweight, fast, simple, free, and designed specifically for static linking. It is absolutely the first choice for static linking. Install the musl environment and start compiling:
```bash
# Debian
$ sudo apt install musl musl-tools musl-dev

# compile
$ cargo build --target x86_64-unknown-linux-musl --release --feature openssl/vendored
```

Check the final executable binary:
```bash
$ ldd target/x86_64-unknown-linux-musl/release/app
        statically linked
```

As you can see, the final generated binary is statically linked and does not depend on the runtime environment's libraries.

### gnu
> glibc was not specifically designed for static linking, so in some cases statically linking glibc will cause runtime errors.

Since musl can already generate statically linked binaries conveniently and simply, why still use glibc for static linking? Of course, because glibc has better performance in certain scenarios 🤠.

To use glibc for static linking, you need to install the static versions of the two compression libraries z (zlib) and zstd (Zstandard).
```bash
sudo apt install zlib1g-dev libzstd-dev
```

Then specify static linking when compiling.
```bash
$ RUSTFLAGS="-C target-feature=+crt-static" cargo build --target x86_64-unknown-linux-gnu --release --feature openssl/vendored

$ ldd target/x86_64-unknown-linux-gnu/release/app 
        statically linked 
```

## Final
In the end, after much tinkering, we still practiced Rust's cross-platform capabilities through cross-compilation.

By the time I wrote this, it was already 12:44 at night. Time passes easily and is always in a hurry. There are too many things I want to do but very few I can do. Facing a full todolist, I have to make changes. Moreover, starting this year I have noticed that when there are too many things I want to do, constantly switching between tasks has caused my attention to be noticeably worse than before. It is time to adjust my attention and cultivate focus. 😵