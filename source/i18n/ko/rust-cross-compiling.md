---
title: Rust 크로스 컴파일
category: Tech
tag: [Rust, Linux]
date: 2026-08-21T00:52:19+08:00
---


## 머리말
월초에 바쁜 와중에 잠깐 짬을 내서 24년도의 작은 모듈 하나를 몰래 Rust로 다시 작성했다. 자세한 내용은 해당 모듈을 재작성한 blog를 참고하길 바란다. 이 blog는 아직 쓸 시간이 없었는데, 월말까지 시간을 쪼개서 마무리해보려 한다. 😮‍💨

> **인생이 천지 사이에 있음은 마치 흰 망아지가 틈을 지나감과 같아, 홀연히 그칠 뿐이다.**

시간은 너무 빨리 흐른다. 예전 학창 시절에는 시간이 부족하다고 거의 느끼지 못했지만, 일을 시작한 후에는 시간이 너무 적다고 자주 탄식하게 된다. 하루 24시간 중 잠에 7시간, 식사에 2시간을 쓰고, 하루 중 가장 아름다운 10시간은 통근과 업무에 쏟는다. 이렇게 계산하면 *만약* 야근을 하지 않는다면 하루에 겨우 4-5시간만 자유롭게 쓸 수 있는 셈이다.

## 만년 CentOS
다시 본론으로 돌아와서, 모듈 재작성을 마치고 서버에 올려 기존 모듈을 교체하려 했다. 배포할 때에야 큰 문제를 발견했는데, 서버 OS가 여전히 CentOS 7이었고 glibc 버전을 보는 순간 막막해졌다.
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

# 바이너리 파일 의존성 확인
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

> 농담 하나 하자면, 매일 보안 점검하고 패치하고 취약점을 업그레이드하는데, 그래도 CentOS 7이다. 😇

일반적으로, 목표 A에서 실행하고자 할 때 **3**가지 방법이 있다:
- 실행 환경을 수정하여 A가 컴파일 환경과 동일한 조건을 갖추도록 한다;
- 동적 링크를 사용하되, A와 동일한 환경에서 컴파일해야 한다;
- 정적 링크를 사용하면, 컴파일 환경에 제한이 없다;


## 실행 환경을 수정..할까?
*실행 환경을 함부로 변경하는 것은 강력히 권장하지 않는다. 자신이 무엇을 하는지 정확히 아는 경우가 아니라면.*

물론 실행 환경에 docker나 podman 같은 컨테이너 환경이 있다면, 이미지를 패키징하여 간접적으로 실행 환경을 *수정*할 수도 있다. 하지만 glibc와 openssl은 절대 변경을 권장하지 않는다. 실행 환경을 바꿀 수 없으니, 실행 가능한 바이너리 파일 쪽에서 해결책을 찾을 수밖에 없다.

## 동적 링크
컴파일된 바이너리가 실행 환경의 동적 의존 라이브러리를 올바르게 로드하고 링크하도록 하려면, 실행 환경의 의존 라이브러리와 일치하는 환경에서 컴파일해야 한다. 비교적 흔한 방법은 실행 환경과 동일한 VM/컨테이너를 만들어 그 VM/컨테이너 내부에서 컴파일하는 것이다.

`cargo-cross`는 크로스 컴파일을 지원하는 Rust 프로젝트를 빌드, 테스트, 검사하기 위한 도구이다. `cross`는 필요한 크로스 컴파일 툴체인을 자동으로 다운로드하고 구성하여, 여러 플랫폼에서 다양한 Rust 명령을 손쉽게 실행할 수 있게 해준다.
```bash
# Install from crate
cargo install cargo-cross

# Install from GitHub
cargo install cargo-cross --git https://github.com/zijiren233/cargo-cross
```

그런 다음 `cross`를 통해 컴파일을 완료할 수 있다. `cross`는 지정된 컴파일 환경 이미지를 가져와 임시 컨테이너를 생성하여 컴파일을 완료한다. 국내에서 github 이미지를 가져오는 것은 다소 느릴 수 있으므로, `Cross.toml`을 통해 국내 미러 소스를 지정하는 것을 권장한다.
```toml
[target.x86_64-unknown-linux-gnu]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-gnu:main-centos"

[target.x86_64-unknown-linux-musl]
image = "ghcr.nju.edu.cn/cross-rs/x86_64-unknown-linux-musl:main"
```

그런 다음 `cross build --target x86_64-unknown-linux-gnu --release`를 실행하여 컴파일을 시작한다. 이렇게 하면 다 된 걸까? 아니다. 코드가 컨테이너 내에 존재하지 않는 의존성에 의존한다면, 컴파일도 실패한다. 예를 들어 `cross`의 `cross-rs/x86_64-unknown-linux-gnu:main-centos` 이미지에는 openssl-devel이 없으므로, 코드가 native openssl에 의존할 때 컴파일이 실패한다.

다행히도 `cross`는 `pre-build`를 통해 컴파일 동작 이전에 명령을 미리 실행할 수 있도록 허용하므로, 이를 이용해 의존성을 설치할 수 있다:
```toml
...
[target.x86_64-unknown-linux-gnu]
pre-build = ["yum install -y openssl-devel"]
...
```

이렇게 하면 끝이라고 생각했는가? nonono, 이건 CentOS인데 그렇게 간단할 리가 없다. CentOS 7의 yum 공식 소스는 이미 아카이브되었기 때문에, `pre-build`의 의존성 설치 명령이 실행에 실패하여 컴파일이 실패할 수 있다. 따라서 `pre-build` 시 미러 소스를 교체하여 의존성이 올바르게 설치되도록 해야 한다.

이건 너무 멍청하다. 나는 소스 교체를 시도조차 하지 않았다. 하지만 소스 교체를 포기한다고 해서 openssl을 사용할 수 없는 것은 아니다. Rust는 컴파일 시 openssl을 자체 컴파일할 수 있는데, 다음과 같이 하면 된다:
```toml
...
[features]
default = ["openssl/vendored"]

[dependencies]
openssl = { version = "0.10.81", features = ["vendored"] }
openssl-sys = { version = "0.9.117", features = ["vendored"] }
...
```

`vendored` feature를 활성화하여 소스에서 openssl을 컴파일한다. 아래는 공식 문서의 `vendored` feature에 대한 설명이다. openssl 컴파일에는 **perl(and perl-core)**이 필요하다는 점에 주의하자.

> If the vendored Cargo feature is enabled, the openssl-src crate will be used to compile and statically link to a copy of OpenSSL. The build process requires a C compiler, perl (and perl-core), and make. The OpenSSL version will generally track the newest OpenSSL release, and changes to the version are not considered breaking changes.

그런 다음 `cross build --target x86_64-unknown-linux-gnu --release`를 실행하여 컴파일을 시작한다. 그러나 아직 끝이 아니다😅. openssl을 컴파일하려면 perl과 perl-core가 필요한데, 컨테이너에는 openssl을 컴파일하기 위한 의존성인 perl/perl-core도 없다는 점에 주목하자. 소스에서 openssl을 컴파일하려면 먼저 openssl을 컴파일할 환경을 설치해야 하니, 끝없는 러시아 인형마트료시카가 따로 없다.

yum 소스를 변경하지 않는다면, 동적 링크는 여기서 거의 끝이라고 봐도 된다.

> 동적 링크를 할 수 있는 두 가지 방법이 더 있다.
> 1. cross와 cross 이미지를 사용하지 않고, 직접 컴파일 컨테이너를 준비하여 의존성을 미리 설치한 뒤 컨테이너 내부에서 컴파일한다. (tips: CentOS 7은 yum으로 rustc와 cargo를 설치할 수 있지만 version 2021 이하만 지원하므로, version 2024라면 코드를 version 2021로 수정해야 한다.
> 2. 의존하는 라이브러리를 대체할 수 있다면, 대체한 후 cross로 크로스 컴파일한다. 예를 들어 내 프로젝트가 openssl에 의존하고, openssl에 의존하는 의존 라이브러리들이 모두 rustls를 지원한다면, 모든 openssl 의존성을 rustls로 교체한 후 cross로 크로스 컴파일할 수 있다. 이 경로는 이미 실행 가능함을 검증했다. 다른 대체 가능한 의존성도 마찬가지이다.

## 정적 링크
정적 링크의 보급률은 동적 링크에 훨씬 못 미치지만, 현재 devops의 발전 속에서 자체 배포 서비스의 경우 정적 링크는 이미 생산 환경에서 편리하게 사용할 수 있다. 납품해야 하는 제품의 경우, 정적 링크는 보안 문제로 인해 동적 링크 대비 여전히 열위에 있다.

이런 💩 같은 환경 배포에서는 정적 링크가 비할 데 없는 장점을 가진다. 정적 링크는 두 가지 libc(gnu와 musl)가 존재하므로, 두 가지 경우로 나누어 소개한다.

### musl
musl은 C 표준 라이브러리를 기반으로 구축된 구현으로, POSIX 2008 표준 및 C11 표준과 호환되며, 널리 사용되지만 비표준인 Linux, BSD 및 glibc 함수 대부분도 구현한다. musl은 가볍고, 빠르고, 단순하고, 자유로우며, 정적 링크를 위해 설계되었기에 절대적으로 정적 링크의 최우선 선택이다. musl 환경을 설치하고 컴파일을 시작한다:
```bash
# Debian
$ sudo apt install musl musl-tools musl-dev

# compile
$ cargo build --target x86_64-unknown-linux-musl --release --feature openssl/vendored
```

최종적으로 얻은 실행 가능한 바이너리를 확인한다:
```bash
$ ldd target/x86_64-unknown-linux-musl/release/app
        statically linked
```

보이는 것처럼, 최종 생성된 바이너리는 정적 링크이며 실행 환경의 라이브러리에 의존하지 않는다.

### gnu
> glibc는 애초에 정적 링크를 위해 설계된 것이 아니므로, 일부 상황에서 glibc를 정적 링크하면 런타임 오류가 발생할 수 있다.

musl로 이미 편리하고 간단하게 정적 링크된 바이너리 파일을 생성할 수 있는데, 왜 굳이 glibc로 정적 링크를 하는가? 물론 glibc가 특정 시나리오에서 더 나은 성능을 가지기 때문이다🤠.

glibc로 정적 링크를 하려면, z(zlib)와 zstd(Zstandard) 두 압축 라이브러리의 정적 버전을 설치해야 한다.
```bash
sudo apt install zlib1g-dev libzstd-dev
```

그런 다음 컴파일 시 정적 링크 파일로 컴파일하도록 지정한다.
```bash
$ RUSTFLAGS="-C target-feature=+crt-static" cargo build --target x86_64-unknown-linux-gnu --release --feature openssl/vendored

$ ldd target/x86_64-unknown-linux-gnu/release/app 
        statically linked 
```

## Final
결국 한참을 씨름한 끝에 크로스 컴파일을 통해 Rust의 크로스 플랫폼 특성을 실천해냈다.

이 글을 쓰다 보니 어느새 밤 12:44가 되었다. 광음은 쉽게 흐르고 시간은 분주하다. 하고 싶은 일은 너무 많은데 할 수 있는 일은 적고, 가득한 todolist를 마주하며 어쩔 수 없이 수정해야만 했다. 게다가 올해 들어 느낀 것인데, 하고 싶은 일이 너무 많아 계속 이것저것 전환하다 보니 지금은 집중력이 예전 같지 않다는 게 확연히 느껴진다. 이제 집중력을 잘 조정하고, 집중하는 힘을 길러야겠다. 😵