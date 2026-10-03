---
title: Rust로 만든 작은 C 런타임
category: Tech
tag: [Linux, Rust]
date: 2026-07-20T23:12:40+08:00
---


## 동기
최근에 나는 프로그램이 어떻게 링크/로드되는지에 관심이 생겼다. 코드를 작성하는 사람이라면 누구나 프로그램이 OS에서 어떻게 실행되는지, 그리고 OS가 `main()` 주변에서 무엇을 해야 하는지에 깊은 흥미를 가지고 있을 것이라 믿는다.

그리고 나는 프로그램의 링크 과정을 소개하는 책<sup>[1]</sup>을 읽고 있는데, 이 책은 정말 매우 상세하다. 책의 끝에서 저자는 `glibc`를 대체할 수 있는 *Linux/Windows 32bits C 런타임*의 구현을 제시한다.

> 책에서 배운 것은 결국 피상적으로 느껴진다. 어떤 것을 진정으로 이해하려면 직접 경험해 보아야 한다.

그래서 나는 *x86_64/arm64 Linux C 런타임*의 Rust 버전을 구현하고 싶다.

## 워크플로우
C 런타임의 상세한 원리까지 깊이 들어가지는 않겠고, 여기서는 OS에서 `main()`까지 이어지는 C 런타임의 전체 동작 순서를 간략히 설명하겠다. 예시는 x86_64 Linux glibc를 기준으로 한다.
1. 로드: Linux 커널이 *execve*<sup>[2]</sup> 시스템 콜을 호출하여 대상 ELF<sup>[3]</sup> 파일을 로드하고, 커널은 ELF 헤더를 읽어 프로그램의 진입점을 찾는다(동적 링크의 경우 진입점은 Linux 동적 링커이다).
2. 링크: 동적 링크 프로그램의 경우, 커널은 동적 링커(`ld-linux-x86_64.so`)로 진입하여 링커가 관리를 맡도록 한다. 링커는 모든 공유 라이브러리를 메인 메모리에 로드하고 심볼을 실제 주소로 재배치한다. 마지막으로 링커는 libc의 진입점(`_start`)으로 제어권을 넘긴다.
3. 런타임 초기화: `_start`는 어셈블리로 작성된 함수로, `main`을 위해 `argc/argv/envp`를 준비한 다음 `__libc_start_main`을 호출한다. `__libc_start_main`은 TLS 설정, stdio 초기화, 사전 초기화 함수 호출, 그리고 `main` 호출을 담당한다.
4. 실행 및 종료: `main`이 호출되어 실행을 시작하고, `main`이 종료되거나 반환한 후 `__libc_start_main`은 `atexit`에 등록된 함수들을 호출하고, 마지막으로 `exit` 시스템 콜을 호출한다.

체인은 아래와 같다:
`Linux 커널 execve -> [ld-linux] -> libc _start -> libc __libc_start_main -> 런타임 초기화 -> main -> atexit/exit`

우리는 정적 링크된 C 프로그램을 실행할 것이므로, *2단계(링크)*는 신경 쓸 필요가 없다.

## 구현

### entry
`entry` 모듈은 우리 프로젝트의 핵심이다. 이 모듈이 담당하는 것은:
- `main`의 `argc/argv/envp` 읽기.
- 전체 런타임 초기화.
- `argc/argv/envp`와 함께 `main` 호출.
- 프로세스 종료.

`main`의 인자를 얻기 시작하기 전에, `main`에 대한 개념 하나를 짚고 넘어가자. `int main(int argc, char *argv[])`가 가장 익숙한 형태이지만, C 표준은 실제로 `main` 함수가 세 번째 매개변수를 가질 수 있도록 허용한다: `int main(int argc, char *argv[], char *envp[])`.

C에서 `main` 함수의 `envp` 매개변수는 환경 변수 문자열 배열에 대한 포인터이다. 이는 시스템의 환경 변수를 실행 중인 프로그램에 전달하는 데 사용된다.

> `envp`는 C 표준(C89/C99/C11)에는 포함되지 않고 POSIX 표준에 포함된다. `envp`를 사용하면 가장 최신의 환경 변수를 읽을 수 없다. 따라서 환경 변수를 수정한 후에는 `envp` 대신 `environ`을 사용하는 것이 권장된다.

x86-64 psABI<sup>[4]</sup>의 *3.2 Function Calling Sequence*에서, 우리는 `rsp` 레지스터를 통해 인자 주소를 추론할 수 있는데, 이 레지스터는 항상 프로세스 스택의 최상단(낮은 주소)을 가리킨다. `./my_prog arg1`을 예로 들어 스택 프레임 레이아웃을 설명하겠다.
```bash
$ ./my_prog arg1

address     content                                 desc
0x...1000   +------------------------------------+
            |  "env_var2=value2\0"               |  env var
            +------------------------------------+
            |  "env_var1=value1\0"               |
            +------------------------------------+
            |  "PATH=/usr/bin:/bin\0"            |
            +------------------------------------+
            |  "arg1\0"                          |  argv[1]
            +------------------------------------+
            |  "./my_prog\0"                     |  argv[0]
            +------------------------------------+
            |  ...                               |
            +------------------------------------+
            |  ...                               |
            +------------------------------------+
            |  &env_string2                      |  envp[2] = NULL
            +------------------------------------+
            |  &env_string1                      |  envp[1]
            +------------------------------------+
            |  &env_string0                      |  envp[0]
            +------------------------------------+
            |  NULL (0)                          |  argv[argc]
            +------------------------------------+
            |  &arg_string1 ("arg1\0")           |  argv[1]
            +------------------------------------+
            |  &arg_string0 ("./my_prog")        |  argv[0]
            +------------------------------------+
0x...0000   |  argc = 2                          |  <- rsp
            +------------------------------------+
```

이 스택 프레임 예시는 `argc/argv/envp` 레이아웃을 간단히 보여줄 뿐이다. LLVM은 x86_64에서 `_start` 심볼을 인식하고 함수 본문에 자체 진입 코드를 삽입한다. 이제 런타임이 `main`을 위해 매개변수를 준비하는 것은 쉽다:
```rust
#[cfg(target_arch = "x86_64")]
core::arch::global_asm! {
    ".globl _start",
    "_start:",
    "mov  rdi, [rsp]",        // argc, actually is 4B, but align to 8B
    "lea  rsi, [rsp + 8]",    // argv
    "lea  rdx, [rsi + rdi*8 + 8]",  // envp
    "call _start_c",  // _start_c is the real entry point of runtime
}
```

> `argc/argv/envp`를 `rdi/rsi/rdx`에 넣는 이유도 ABI 표준에 따른다: *클래스가 INTEGER이면, %rdi, %rsi, %rdx, %rcx, %r8, %r9 순서에서 다음으로 사용 가능한 레지스터가 사용된다.*
> 따라서 `_start_c`를 호출할 때 매개변수는 자동으로 `_start_c` 함수에 전달되고, 그런 다음 `_start_c`가 이를 `main`에 전달한다.

`_start` 섹션에서는 두 개의 어셈블리 명령어, `mov`와 `lea`를 사용한다. `mov`는 레지스터 A의 값을 레지스터 B로 복사하고, `lea`(Load Effective Address)는 `mov`와 같은 기능을 하지만 `[]` 안에서 주소를 직접 계산할 수 있게 해준다.

런타임 초기화가 이루어지면, `main`을 위해 메모리 힙이 할당된다. 그런 다음 인자와 함께 `main`을 호출하고, 마지막으로 런타임을 종료한다.
```rust
extern "C" {
    fn main(argc: i32, argv: *mut *mut u8, envp: *mut *mut u8) -> i32;
}

#[cfg(target_arch = "x86_64")]
#[no_mangle]
unsafe extern "C" fn _start_c(argc: i32, argv: *mut *mut u8, envp: *mut *mut u8) -> ! {
    heap::init();  // todo
    let ret = main(argc, argv, envp);
    exit::exit(ret);  // todo
}
```

이것이 완전한 런타임 진입점이다.

### sys
`heap`과 `exit` 모듈을 구현하기 전에, 첫 번째 단계는 Linux *시스템 콜*을 구현하는 것이다. 이 시스템 콜들은 기본적으로 가장 기초적인 OS 연산을 커버한다:
- `sys_write`
- `sys_read`
- `sys_open`
- `sys_close`
- `sys_exit`

ABI에 따라 시스템 콜을 설계한다. 이 글에서는 Rust 어셈블리 세부 사항을 다루지 않으므로, Rust 어셈블리에 대한 더 많은 내용은 [core::arch](https://doc.rust-lang.org/stable/core/arch/index.html#macros)를 참고하길 바란다.
```rust
#[cfg(target_arch = "x86_64")]
#[inline(always)]
unsafe fn syscall1(n: usize, a1: usize) -> usize {
    let ret: usize;
    core::arch::asm!(
        "syscall",
        in("rax") n,
        in("rdi") a1,
        lateout("rax") ret,
        out("rcx") _,
        out("r11") _,
        options(nostack)
    );
    ret
}

#[cfg(target_arch = "x86_64")]
#[inline(always)]
unsafe fn syscall3(n: usize, a1: usize, a2: usize, a3: usize) -> usize {
    let ret: usize;
    core::arch::asm!(
        "syscall",
        in("rax") n,
        in("rdi") a1,
        in("rsi") a2,
        in("rdx") a3,
        lateout("rax") ret,
        out("rcx") _,
        out("r11") _,
        options(nostack)
    );
    ret
}

#[cfg(target_arch = "x86_64")]
#[inline(always)]
unsafe fn syscall6(n: usize, a1: usize, a2: usize, a3: usize, a4: usize, a5: isize, a6: usize) -> usize {
    let ret: usize;
    core::arch::asm!(
        "syscall",
        in("rax") n,
        in("rdi") a1,
        in("rsi") a2,
        in("rdx") a3,
        in("r10") a4,
        in("r8")  a5,
        in("r9")  a6,
        lateout("rax") ret,
        out("rcx") _,
        out("r11") _,
        options(nostack)
    );
    ret
}

pub unsafe fn sys_write(fd: i32, buf: *const u8, len: usize) -> isize {
    let ret = syscall3(1, fd as usize, buf as usize, len);
    if ret > 0x7fff_ffff_ffff_0000 { -(ret as isize & 0xfff) } else { ret as isize }
}

pub unsafe fn sys_read(fd: i32, buf: *mut u8, len: usize) -> isize {
    let ret = syscall3(0, fd as usize, buf as usize, len);
    if ret > 0x7fff_ffff_ffff_0000 { -(ret as isize & 0xfff) } else { ret as isize }
}

pub unsafe fn sys_open(path: *const u8, flags: i32, mode: i32) -> i32 {
    let ret = syscall3(2, path as usize, flags as usize, mode as usize);
    if ret > 0x7fff_ffff_ffff_0000 { -1 } else { ret as i32 }
}

pub unsafe fn sys_close(fd: i32) -> i32 {
    let ret = syscall1(3, fd as usize);
    if ret > 0x7fff_ffff_ffff_0000 { -1 } else { 0 }
}

pub unsafe fn sys_exit(code: i32) -> ! {
    syscall1(60, code as usize);
    unreachable!()
}
```


### heap
힙은 프로그램이 운영체제로부터 요청하는 메모리 공간이다. 힙은 부족한 스택 프레임을 보충하기 위해 존재한다.

런타임 핵심 기능 중 하나는 초기 힙 메모리를 준비하는 것이다. Linux x86_64는 두 가지 시스템 콜을 제공한다: `brk()`와 `mmap()`<sup>[5]</sup>.
- `brk()`: 높은 성능으로 연속적인 힙 메모리를 할당하지만, 메모리는 brk 포인터 순서대로만 해제할 수 있다. 작은 공간 요청에 사용된다.
- `mmap()`: 비연속적인 메모리를 할당하며 `brk`보다 성능이 낮지만, 메모리를 자유롭게 해제할 수 있어 큰 메모리 요청에 적합하다.

우리 구현에서는 크기를 구분하지 않으므로 `mmap`을 선택한다. `mmap` 시스템 콜은 OS가 할당한 주소 포인터를 반환한다.
```rust
#[cfg(target_pointer_width = "64")]
const ALIGN: usize = 16;
#[cfg(target_pointer_width = "32")]
const ALIGN: usize = 8;

/// Align `n` up to the next multiple of `ALIGN`.
fn align_up(n: usize) -> usize {
    (n + ALIGN - 1) & !(ALIGN - 1)
}

unsafe fn request_memory(size: usize) -> *mut u8 {
    let total = align_up(size);
    sys::sys_mmap(total)
}

pub unsafe fn sys_mmap(size: usize) -> *mut u8 {
    #[cfg(target_arch = "x86_64")]
    {
        let ret = syscall6(
            9,
            0,                                                                          // addr = NULL
            size,                                                                       // length
            (super::constants::PROT_READ | super::constants::PROT_WRITE) as usize,      // prot
            (super::constants::MAP_PRIVATE | super::constants::MAP_ANONYMOUS) as usize, // flags
            -1isize,                                                                    // fd = -1
            0,                                                                          // offset
        );
        if ret == super::constants::MAP_FAILED as usize {
            core::ptr::null_mut()
        } else {
            ret as *mut u8
        }
    }
}
```

이제 우리는 `main`이 메모리를 요청할 수 있도록 메모리 블록 한 개를 요청했다. 하지만 `main`으로부터의 메모리 할당/해제 요청을 처리하려면, 힙을 관리하는 완전한 해결책도 필요하다. OS 메모리를 기반으로 하는 간단한 **first-fit**<sup>[6]</sup> 자유 리스트 할당자를 구현한다.

각 할당에는 사용자 데이터 앞에 `BlockHeader`가 있다. 모든 블록은 주소 순으로 정렬된 단일 연결 리스트를 이룬다.
```rust
/// Size of the block header (must be 8-byte aligned).
const HEADER_SIZE: usize = core::mem::size_of::<BlockHeader>();

static mut BLOCK_LIST: *mut BlockHeader = ptr::null_mut();

#[repr(C)]
struct BlockHeader {
    /// Size of the *data* area (excluding this header).
    size: usize,
    /// Whether this block is currently free.
    is_free: bool,
    /// Next block in the list (sorted by address).
    next: *mut BlockHeader,
}
```

지금까지 완전한 `heap::init()`을 얻었다:
```rust
/// 4KB page
const PAGE_SIZE: usize = 4096;

pub unsafe fn init() {
    let initial_size = PAGE_SIZE * 64; // 256 KB initial heap
    let raw = request_memory(initial_size);
    if raw.is_null() {
        sys::sys_exit(99);
    }
    let block = raw as *mut BlockHeader;
    (*block).size = initial_size - HEADER_SIZE;
    (*block).is_free = true;
    (*block).next = ptr::null_mut();
    BLOCK_LIST = block;
}
```

그런 다음 `main`으로부터의 호출을 처리하기 위해 `malloc`/`free`를 구현한다.
- `malloc`: 맞는(크기에 부합하는) 빈 블록을 리스트에서 찾는다(first-fit). 찾지 못하면 OS로부터 더 많은 메모리를 요청한다.
- `free`: 블록을 빈 상태로 표시하고, 조각화를 줄이기 위해 인접한 빈 블록들과 병합한다.
```rust
/// Minimum useful block data size.
const MIN_BLOCK_SIZE: usize = 16;

unsafe fn split_block(block: *mut BlockHeader, size: usize) {
    let remaining = (*block).size - size;
    // Only split if the remainder is large enough for header + MIN_BLOCK_SIZE
    if remaining >= HEADER_SIZE + MIN_BLOCK_SIZE {
        let new_block = (block as *mut u8).add(HEADER_SIZE + size) as *mut BlockHeader;
        (*new_block).size = remaining - HEADER_SIZE;
        (*new_block).is_free = true;
        (*new_block).next = (*block).next;
        (*block).size = size;
        (*block).next = new_block;
    }
}

#[no_mangle]
pub unsafe extern "C" fn malloc(size: usize) -> *mut u8 {
    if size == 0 {
        return ptr::null_mut();
    }
    let size = align_up(size);

    // First-fit search
    let mut current = BLOCK_LIST;
    while !current.is_null() {
        if (*current).is_free && (*current).size >= size {
            split_block(current, size);
            (*current).is_free = false;
            return (current as *mut u8).add(HEADER_SIZE);
        }
        current = (*current).next;
    }

    // No suitable block — request more memory
    let alloc_size = HEADER_SIZE + size;
    let raw = request_memory(alloc_size);
    if raw.is_null() {
        return ptr::null_mut();
    }

    let new_block = raw as *mut BlockHeader;
    (*new_block).size = size;
    (*new_block).is_free = false;
    (*new_block).next = ptr::null_mut();

    // Insert into the sorted list
    if BLOCK_LIST.is_null() {
        BLOCK_LIST = new_block;
    } else {
        let mut tail = BLOCK_LIST;
        while !(*tail).next.is_null() {
            tail = (*tail).next;
        }
        // Check if we can merge with the tail
        let tail_end = (tail as *mut u8).add(HEADER_SIZE + (*tail).size);
        if tail_end == raw && (*tail).is_free {
            (*tail).size += HEADER_SIZE + size;
            (*tail).is_free = false;
            return (tail as *mut u8).add(HEADER_SIZE);
        } else {
            (*tail).next = new_block;
        }
    }

    (new_block as *mut u8).add(HEADER_SIZE)
}

unsafe fn coalesce(block: *mut BlockHeader) {
    let mut current = block;
    while !current.is_null() {
        if !(*current).is_free {
            current = (*current).next;
            continue;
        }
        // Try to merge with the next block if it is also free and adjacent
        let next = (*current).next;
        if !next.is_null()
            && (*next).is_free
            && (current as *mut u8).add(HEADER_SIZE + (*current).size) == next as *mut u8
        {
            // Merge
            (*current).size += HEADER_SIZE + (*next).size;
            (*current).next = (*next).next;
        } else {
            current = (*current).next;
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn free(ptr: *mut u8) {
    if ptr.is_null() {
        return;
    }
    let header = ptr.sub(HEADER_SIZE) as *mut BlockHeader;
    (*header).is_free = true;
    coalesce(header);
}
```

`heap`을 통해 우리는 `main`에 메모리 할당/해제 인터페이스를 제공할 수 있다.

### exit
`main`이 끝난 후, 런타임은 등록된 *atexit* 함수들을 실행하고, 리소스를 정리하고, 마지막으로 프로세스를 종료하는 것을 담당한다.

`exit::exit()`가 하는 일은 매우 간단하다. 먼저 등록된 모든 atexit 함수를 실행하고, 그런 다음 `stdout/stderr`를 플러시하여 모든 버퍼를 비우고, 마지막으로 `sys::sys_exit()`를 호출하여 프로세스를 종료한다.
```rust
#[no_mangle]
pub unsafe extern "C" fn exit(code: i32) -> ! {
    run_atexit_handlers();
    unsafe {
        crate::fs::fflush(crate::fs::crt_stdout());  // todo
        crate::fs::fflush(crate::fs::crt_stderr());  // todo
    }
    sys::sys_exit(code)
}
```

atexit 함수들은 예전 방식대로 리스트에 저장한다. `exit`이 호출되면 런타임은 atexit 함수들을 하나씩 실행한다.
```rust

const ATEXIT_MAX: usize = 64;

static mut ATEXIT_FUNCS: [Option<unsafe extern "C" fn()>; ATEXIT_MAX] = [None; ATEXIT_MAX];
static mut ATEXIT_COUNT: usize = 0;

#[no_mangle]
pub unsafe extern "C" fn atexit(func: unsafe extern "C" fn()) -> i32 {
    if ATEXIT_COUNT >= ATEXIT_MAX {
        return -1;
    }
    ATEXIT_FUNCS[ATEXIT_COUNT] = Some(func);
    ATEXIT_COUNT += 1;
    0
}

unsafe fn run_atexit_handlers() {
    let mut i = ATEXIT_COUNT;
    while i > 0 {
        i -= 1;
        if let Some(func) = ATEXIT_FUNCS[i] {
            func();
        }
    }
}
```

또한 즉시 종료하기 위한 간단한 abort 함수를 구현할 수 있다.
```rust
#[no_mangle]
pub unsafe extern "C" fn abort() -> ! {
    sys::sys_exit(134)
}
```


### string
우리의 `main` 함수가 비교적 단순하면 문자열 연산이 꼭 필요한 런타임 구현처럼 보이지 않을 수도 있다. 그러나 문자열 연산이 구현되지 않으면 링크 시 오류가 발생한다. 이는 `strcpy` 같은 함수들을 명시적으로 호출하지 않더라도 LLVM이 컴파일 중에 이러한 문자열 함수들을 암묵적으로 호출하기 때문이다. 아래 코드처럼 LLVM은 `strcpy`를 호출하게 된다:
```rust
#[no_mangle]
pub unsafe extern "C" fn test() {
    let mut a = [0u8; 1024];
    let b = [1u8; 1024];
    a = b; // memcpy is called here
}
```

따라서 문자열 연산을 구현하는 것은 필수적이다. 흥미로운 점 한 가지는 모든 문자열 연산이 사용자 공간에서 동작하며 커널과 상호작용하지 않는다는 것이다.
```rust
#[no_mangle]
pub unsafe extern "C" fn strlen(s: *const u8) -> usize {
    if s.is_null() { return 0; }
    let mut len = 0usize;
    while *s.add(len) != 0 {
        len += 1;
    }
    len
}

#[no_mangle]
pub unsafe extern "C" fn strcpy(dest: *mut u8, src: *const u8) -> *mut u8 {
    let mut i = 0usize;
    while *src.add(i) != 0 {
        *dest.add(i) = *src.add(i);
        i += 1;
    }
    *dest.add(i) = 0;
    dest
}

#[no_mangle]
pub unsafe extern "C" fn strcat(dest: *mut u8, src: *const u8) -> *mut u8 {
    let dlen = strlen(dest);
    let mut i = 0usize;
    while *src.add(i) != 0 {
        *dest.add(dlen + i) = *src.add(i);
        i += 1;
    }
    *dest.add(dlen + i) = 0;
    dest
}

#[no_mangle]
pub unsafe extern "C" fn memcpy(dest: *mut u8, src: *const u8, n: usize) -> *mut u8 {
    let mut i = 0usize;
    while i < n {
        *dest.add(i) = *src.add(i);
        i += 1;
    }
    dest
}

#[no_mangle]
pub unsafe extern "C" fn memcmp(s1: *const u8, s2: *const u8, n: usize) -> i32 {
    let mut i = 0usize;
    while i < n {
        let a = *s1.add(i);
        let b = *s2.add(i);
        if a != b {
            return a as i32 - b as i32;
        }
        i += 1;
    }
    0
}

pub fn int_to_str(buf: &mut [u8], mut val: u64, base: u8, uppercase: bool) -> usize {
    const DIGITS_LOWER: &[u8; 16] = b"0123456789abcdef";
    const DIGITS_UPPER: &[u8; 16] = b"0123456789ABCDEF";

    let digits = if uppercase { DIGITS_UPPER } else { DIGITS_LOWER };

    if val == 0 {
        buf[0] = b'0';
        return 1;
    }

    let mut pos = 0usize;
    let mut tmp = [0u8; 64];

    while val > 0 {
        tmp[pos] = digits[(val % base as u64) as usize];
        val /= base as u64;
        pos += 1;
    }

    // Reverse into output buffer
    for i in 0..pos {
        buf[i] = tmp[pos - 1 - i];
    }
    pos
}

#[no_mangle]
pub unsafe extern "C" fn bcmp(s1: *const u8, s2: *const u8, n: usize) -> i32 {
    memcmp(s1, s2, n)
}
```

> 우리는 대부분의 문자열 연산을 구현했지만, 마지막에 `bcmp`가 나온다. `bcmp`란 무엇인가? `bcmp`가 없으면 링크가 실패할 수도 있다.
> `bcmp`: 바이트 문자열 비교(레거시 BSD, 동등성 검사에 있어 memcmp와 의미가 동일). LLVM은 memcmp 호출을 bcmp로 최적화할 수 있다.


### io/fs
짠! 마침내 마지막 부분에 도달했고, 가장 유명한 함수 `printf`를 구현하려 한다. [sys](#sys)에서 우리는 `sys_write`를 구현했고, 이제 한 단계 더 나아가 바깥 계층을 구현해야 한다.

우리는 출력 `fd`에 내용을 계속 복사하고, 매 1024B마다 버퍼를 플러시하며 `sys::sys_write`로 버퍼 내용을 기록한다.

```rust
const BUFSIZ: usize = 1024;

/// Flags bitmask
const FLAG_ERROR: u32 = 0x08;
const FLAG_BUF_DIRTY: u32 = 0x10; // buffer has unflushed writes

#[repr(C)]
#[derive(Clone, Copy)]
pub struct FILE {
    fd: i32,
    flags: u32,
    buf: [u8; BUFSIZ],
    buf_pos: usize,
    buf_len: usize, // valid bytes in buffer
}

impl FILE {
    const fn new(fd: i32, flags: u32) -> Self {
        FILE {
            fd,
            flags,
            buf: [0u8; BUFSIZ],
            buf_pos: 0,
            buf_len: 0,
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn fwrite(
    buf: *const u8,
    size: usize,
    nmemb: usize,
    stream: *mut FILE,
) -> usize {
    if buf.is_null() || stream.is_null() || size == 0 || nmemb == 0 {
        return 0;
    }
    let f = &mut *stream;
    let total = size * nmemb;
    let mut written = 0usize;
    let mut ptr = buf;

    while written < total {
        let avail = BUFSIZ - f.buf_len;
        let want = total - written;
        let chunk = avail.min(want);

        crate::string::memcpy(f.buf.as_mut_ptr().add(f.buf_len), ptr, chunk);
        f.buf_len += chunk;
        f.buf_pos = f.buf_len;
        f.flags |= FLAG_BUF_DIRTY;

        // Flush when buffer is full
        if f.buf_len >= BUFSIZ && fflush(stream) != 0 {
            f.flags |= FLAG_ERROR;
            break;
        }

        ptr = ptr.add(chunk);
        written += chunk;
    }

    written / size
}

#[no_mangle]
pub unsafe extern "C" fn fflush(stream: *mut FILE) -> i32 {
    if stream.is_null() {
        // Flush all open streams
        return 0;
    }
    let f = &mut *stream;
    if f.flags & FLAG_BUF_DIRTY != 0 && f.buf_len > 0 {
        let mut written = 0usize;
        while written < f.buf_len {
            let n = sys::sys_write(f.fd, f.buf.as_ptr().add(written), f.buf_len - written);
            if n < 0 {
                f.flags |= FLAG_ERROR;
                return -1;
            }
            written += n as usize;
        }
        f.buf_len = 0;
        f.buf_pos = 0;
        f.flags &= !FLAG_BUF_DIRTY;
    }
    0
}
```

`fs::fwrite`를 통해 `char` 배열을 지정된 `fd`로 출력하는 것은 쉽다. 하지만 `printf`는 이것보다 더 많은 것을 포함하며, 형식 문자열을 담당한다. 우리는 복잡한 출력 형식 지정자를 구현할 의도는 없다.

우리의 함수들은 다음과 같다:
- `%d`/`%s` 출력 형식 지정자만 지원하고, `%08d` 같은 위치 지정자는 포함하지 않는다.
- `vfprintf`와 `printf`. 실제로 `printf`는 대상 출력 `fd`가 표준 출력인 `vfprintf`의 특정한 한 가지 경우이다.
- 가변 길이 매개변수를 지원한다.

최종적인 `printf`는 다음과 같이 동작한다:
```c
int main() {
  int a = 7;
  printf("Hello %d", a);
  return 0;
}

// Hello 7
```

첫 번째 문제는 Rust에서 가변 길이 매개변수를 가진 함수를 어떻게 제공할 것인가이다. `va_list`는 C/C++에서 가변 개수의 인자를 가지는 함수(예: `printf`)를 처리하는 데 사용되는 포인터 타입이다. `<stdarg.h>` 헤더 파일에 정의되며, `va_start`(초기화), `va_arg`(인자 가져오기), `va_end`(정리)와 같은 매크로와 함께 자주 사용된다. 따라서 우리가 Rust에서 `va_list`를 구현하면, C에서 `stdarg.h`<sup>[7]</sup>를 통해 분석할 수 있다.
```rust
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
mod va {
    /// x86_64 Linux va_list is actually:
    ///   struct { unsigned int gp_offset; unsigned int fp_offset;
    ///            void *overflow_arg_area; void *reg_save_area; }
    #[repr(C)]
    pub struct VaList {
        pub gp_offset: u32,
        pub fp_offset: u32,
        pub overflow_arg_area: *mut u8,
        pub reg_save_area: *mut u8,
    }

    const GP_REGS: usize = 6; // rdi, rsi, rdx, rcx, r8, r9

    pub unsafe fn read_int(ap: &mut *mut u8, wide: bool) -> u64 {
        // ap points to a local *mut u8 that stores the va_list pointer.
        // Dereference to get the actual VaList address.
        let va = *ap as *mut VaList;
        if (*va).gp_offset < GP_REGS as u32 * 8 {
            let reg = (*va).reg_save_area.add((*va).gp_offset as usize);
            (*va).gp_offset += 8;
            if wide {
                // %s — full 64-bit pointer
                *(reg as *const u64)
            } else {
                // %d — variadic int is 32-bit on x86_64;
                // the upper 32 bits of the register are unspecified.
                *(reg as *const u32) as u64
            }
        } else {
            let overflow = (*va).overflow_arg_area;
            (*va).overflow_arg_area = overflow.add(8);
            if wide {
                *(overflow as *const u64)
            } else {
                *(overflow as *const u32) as u64
            }
        }
    }
}
```

그리고 `format_core`로 형식이 없는 문자열을 분석한다:
```rust
unsafe fn format_core<F: FnMut(&[u8])>(
    fmt: *const u8,
    ap: &mut *mut u8,
    mut write_fn: F,
) -> i32 {
    let mut count = 0i32;
    let len = string::strlen(fmt);
    let mut i = 0usize;

    while i < len {
        if *fmt.add(i) != b'%' {
            // Regular character
            write_fn(&[*fmt.add(i)]);
            count += 1;
            i += 1;
            continue;
        }

        i += 1; // skip '%'

        // Specifier
        let mut num_buf = [0u8; 65]; // enough for 64-bit binary + sign
        match *fmt.add(i