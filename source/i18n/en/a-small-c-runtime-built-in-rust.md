---
title: 用 Rust 构建的一个小型 C 运行时
category: Tech
tag: [Linux, Rust]
date: 2026-07-20T23:12:40+08:00
---


## 动机
最近我对程序的链接和加载方式产生了兴趣。我相信每个写代码的人都一定对程序如何在操作系统中运行、以及操作系统在 `main()` 周围需要做些什么有着浓厚的兴趣。

我还在读那本<sup>[1]</sup>介绍程序链接过程的书，它确实写得非常详尽。在书的结尾，作者给出了可以替代 `glibc` 的 *Linux/Windows 32 位 C 运行时* 的实现。

> 纸上得来终觉浅，绝知此事要躬行。

所以我想实现 *x86_64/arm64 Linux C 运行时* 的 Rust 版本。

## 工作流程
我不会深入讲解 C 运行时的详细原理，这里只会从操作系统到 `main()` 的角度简要说明 C 运行时的整体工作顺序。以 x86_64 Linux glibc 为例。
1. 加载：Linux 内核调用 *execve*<sup>[2]</sup> 系统调用加载目标 ELF<sup>[3]</sup> 文件，然后内核读取 ELF 头以找到程序的入口点（对于动态链接的程序，入口点是 Linux 动态链接器）。
2. 链接：对于动态链接的程序，内核进入动态链接器（`ld-linux-x86_64.so`）并让链接器接管管理。链接器将所有共享库加载到主内存，并将符号重定位到真实地址。最后链接器把控制权移交给 libc 中的入口点（`_start`）。
3. 运行时初始化：`_start` 是一个用汇编编写的函数，它为 `main` 准备 `argc/argv/envp`，然后调用 `__libc_start_main`。`__libc_start_main` 负责设置 TLS、初始化 stdio、调用预初始化函数，并调用 `main`。
4. 运行和退出：调用 `main` 并开始运行，`main` 退出或返回后，`__libc_start_main` 调用注册在 `atexit` 中的函数，最后调用系统调用 `exit`。

调用链如下：
`Linux 内核 execve -> [ld-linux] -> libc _start -> libc __libc_start_main -> 运行时初始化 -> main -> atexit/exit`

我们将运行静态链接的 C 程序，因此无需关心 *第 2 步（链接）*。

## 实现

### entry
`entry` 模块是我们项目的核心。它负责：
- 读取 `main` 的 `argc/argv/envp`。
- 初始化整个运行时。
- 用 `argc/argv/envp` 调用 `main`。
- 退出进程。

在我们开始获取 `main` 的参数之前，这里有一个关于 `main` 的概念。虽然 `int main(int argc, char *argv[])` 是最熟悉的形式，但 C 标准实际上允许 `main` 函数有第三个参数：`int main(int argc, char *argv[], char *envp[])`。

在 C 中，`main` 函数的 `envp` 参数是一个指向环境变量字符串数组的指针；它用于将系统的环境变量传递给运行中的程序。

> `envp` 并不包含在 C 标准（C89/C99/C11）中，而是在 POSIX 标准中。使用 `envp` 无法读取最新的环境变量。因此，在修改环境变量后，建议使用 `environ` 而不是 `envp`。

从 x86-64 psABI<sup>[4]</sup> 的 *3.2 函数调用序列* 中，我们可以通过 `rsp` 寄存器推断参数地址，它始终指向进程栈顶（低地址）。以 `./my_prog arg1` 为例说明栈帧布局。
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

这个栈帧示例只是简要展示了 `argc/argv/envp` 的布局。LLVM 在 x86_64 上识别 `_start` 符号并将其自身的入口代码插入到函数体中。现在运行时为 `main` 准备参数就变得容易了：
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

> 至于为什么把 `argc/argv/envp` 放入 `rdi/rsi/rdx`，同样是根据 ABI 标准：*如果类是 INTEGER，则使用序列 %rdi、%rsi、%rdx、%rcx、%r8 和 %r9 中的下一个可用寄存器。*
> 所以当调用 `_start_c` 时，参数会自动传递给函数 `_start_c`，然后 `_start_c` 再将它们传递给 `main`。

在 `_start` 部分，我们使用了两条汇编指令：`mov` 和 `lea`。`mov` 将值从寄存器 A 复制到寄存器 B，`lea`（加载有效地址）具有与 `mov` 相同的功能，但允许直接在 `[]` 中计算地址。

在运行时初始化时，为 `main` 分配一个内存堆。然后用参数调用 `main`，最后退出运行时。
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

这就是完整的运行时入口点。

### sys
在我们实现 `heap` 和 `exit` 模块之前，第一步是实现 Linux *系统调用*。这些系统调用基本上涵盖了最基础的操作系统操作：
- `sys_write`
- `sys_read`
- `sys_open`
- `sys_close`
- `sys_exit`

根据 ABI 设计系统调用。本文不会涉及 Rust 汇编的细节，更多 Rust 汇编请参见 [core::arch](https://doc.rust-lang.org/stable/core/arch/index.html#macros)。
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
堆是程序向操作系统请求的内存空间。堆的存在是为了补充不足的栈帧。

运行时的核心功能之一就是准备一块初始堆内存。Linux x86_64 提供了两个系统调用：`brk()` 和 `mmap()`<sup>[5]</sup>。
- `brk()`：以高性能分配连续的堆内存，但内存只能按 brk 指针的顺序释放。用于小空间请求。
- `mmap()`：分配非连续内存，性能低于 `brk`，内存可以随意释放，适用于大内存请求。

在我们的实现中，我们不区分大小，所以选择 `mmap`。`mmap` 系统调用返回操作系统分配的地址指针。
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

现在我们已经为 `main` 请求内存请求了一块内存。但为了处理来自 `main` 的内存分配/释放请求，我们还需要一个完整的堆管理方案：实现一个简单的 **首次适应**<sup>[6]</sup> 空闲链表分配器，由操作系统内存支持。

每次分配都有一个位于用户数据之前的 `BlockHeader`。所有块形成一个按地址排序的单向链表。
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

现在我们得到了完整的 `heap::init()`：
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

然后我们实现 `malloc`/`free` 来处理来自 `main` 的调用。
- `malloc`：遍历链表寻找合适的空闲块（首次适应）。如果没有找到，就向操作系统请求更多内存。
- `free`：将块标记为空闲，并与相邻的空闲块合并以减少碎片。
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

有了 `heap`，我们就可以为 `main` 提供内存分配/释放接口。

### exit
`main` 结束后，运行时负责执行注册的 *atexit* 函数、清理资源，最后退出进程。

`exit::exit()` 所做的工作非常简单。首先运行所有注册的 atexit 函数，然后刷新 `stdout/stderr` 以清空所有缓冲区，最后调用 `sys::sys_exit()` 退出进程。
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

对于那些 atexit 函数，按照老办法，我们使用一个列表来存储它们。当调用 `exit` 时，运行时逐个执行 atexit 函数。
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

此外，我们还可以实现一个快速终止函数来立即退出。
```rust
#[no_mangle]
pub unsafe extern "C" fn abort() -> ! {
    sys::sys_exit(134)
}
```


### string
如果我们的 `main` 函数相对简单，字符串操作似乎并不是运行时必须实现的部分。但是，如果不实现字符串操作，链接时就会出错。这是因为即使没有显式调用 `strcpy` 之类的函数，LLVM 也会在编译期间隐式调用这些字符串函数。如下面的代码所示，LLVM 会调用 `strcpy`：
```rust
#[no_mangle]
pub unsafe extern "C" fn test() {
    let mut a = [0u8; 1024];
    let b = [1u8; 1024];
    a = b; // memcpy is called here
}
```

所以实现我们的字符串操作是必要的。有趣的是，所有字符串操作都在用户空间工作，不与内核交互。
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

> 我们已经实现了大部分字符串操作，但最后还有一个 `bcmp`。什么是 `bcmp`？没有 `bcmp`，链接也可能会失败。
> `bcmp`：字节字符串比较（遗留 BSD，对于相等性检查与 memcmp 语义相同）。LLVM 可能会将 memcmp 调用优化为 bcmp。


### io/fs
砰！我们终于来到最后一部分，将要实现最著名的函数 `printf`。在 [sys](#sys) 中我们已经实现了 `sys_write`，现在我们需要再进一步实现外层。

我们持续将内容复制到输出 `fd`，每 1024B 就刷新缓冲区，并通过 `sys::sys_write` 写出缓冲区内容。

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

通过 `fs::fwrite`，可以轻松地将一个 `char` 数组输出到指定的 `fd`。但 `printf` 包含的远不止这些，它还负责格式化字符串。我们不打算实现复杂的输出格式说明符。

以下是我们的函数：
- 只支持 `%d`/`%s` 输出格式说明符，不包括像 `%08d` 这样的位置说明符。
- `vfprintf` 和 `printf`，实际上 `printf` 是 `vfprintf` 的一种特定情况，其目标输出 `fd` 是标准输出。
- 支持不定长参数。

最终的 `printf` 看起来像：
```c
int main() {
  int a = 7;
  printf("Hello %d", a);
  return 0;
}

// Hello 7
```

第一个问题是我们如何在 Rust 中提供具有不定长参数的函数？`va_list` 是 C/C++ 中用于处理可变数量参数函数（如 `printf`）的指针类型。它定义在 `<stdarg.h>` 头文件中，通常与诸如 `va_start`（初始化）、`va_arg`（获取参数）和 `va_end`（清理）等宏一起使用。因此，如果我们在 Rust 中实现 `va_list`，它就可以在 C 中通过 `stdarg.h`<sup>[7]</sup> 进行解析。
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

我们使用 `format_core` 解析未格式化的字符串：
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
        match *fmt.add(i) {
            b'd' => {
                // read as 32-bit then sign-extend (variadic int is 32-bit)
                let val = read_int(ap, false) as i32 as i64;
                if val < 0 {
                    let n = string::int_to_str(&mut num_buf, (-val) as u64, 10, false);
                    write_fn(&num_buf[..n]);
                    count += n;
                } else {
                    let n = string::int_to_str(&mut num_buf, val as u64, 10, false);
                    write_fn(&num_buf[..n]);
                    count += n;
                }
                i += 1;
            }
            b's' => {
                let s = read_int(ap, true) as *const u8;
                if s.is_null() {
                    write_fn(b"(null)".as_ref());
                    count += 6;
                } else {
                    let slen = string::strlen(s);
                    let mut buf = [0u8; 1024];
                    let copy_len = slen.min(buf.len());
                    ptr::copy_nonoverlapping(s, buf.as_mut_ptr(), copy_len);
                    write_fn(&buf[..copy_len]);
                    count += copy_len as i32;
                }
                i += 1;
            }
            _ => {
                // Unknown — output as-is
                write_fn(&[b'%', *fmt.add(i)]);
                count += 2;
                i += 1;
            }
        }
    }

    count
}
```

最后我们可以得到 `vfprintf`：
```rust
static mut STDIN: FILE = FILE::new(0, FLAG_READ);
static mut STDOUT: FILE = FILE::new(1, FLAG_WRITE);
static mut STDERR: FILE = FILE::new(2, FLAG_WRITE);

#[no_mangle]
pub extern "C" fn crt_stdin() -> *mut FILE {
    &raw mut STDIN
}
#[no_mangle]
pub extern "C" fn crt_stdout() -> *mut FILE {
    &raw mut STDOUT
}
#[no_mangle]
pub extern "C" fn crt_stderr() -> *mut FILE {
    &raw mut STDERR
}

#[no_mangle]
pub unsafe extern "C" fn vprintf(fmt: *const u8, ap: *mut u8) -> i32 {
    vfprintf(fs::crt_stdout(), fmt, ap)
}

#[no_mangle]
pub unsafe extern "C" fn vfprintf(stream: *mut FILE, fmt: *const u8, ap: *mut u8) -> i32 {
    let mut ap_ptr = ap;
    format_core(fmt, &mut ap_ptr, |bytes| {
        if !stream.is_null() {
            fs::fwrite(bytes.as_ptr(), 1, bytes.len(), stream);
        }
    })
}
```

还需要一个 shim 来适配 Rust 中的 `va_list`。
```c
#include <stdarg.h>

extern int vprintf(const char *fmt, va_list ap);
extern int vfprintf(void *stream, const char *fmt, va_list ap);

int printf(const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int ret = vprintf(fmt, ap);
    va_end(ap);
    return ret;
}

int fprintf(void *stream, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int ret = vfprintf(stream, fmt, ap);
    va_end(ap);
    return ret;
}
```

## 编译和链接
现在我们构建了一个小型核心 Rust 运行时，它为 C 的 `main` 处理参数收集、堆初始化、运行 main 函数以及进程退出。

它可以这样使用：
```c
#include<shims.h>

int main() {
  int a = 7;
  printf("Hello %d", a);
  return 0;
}
```

让我们编译源代码，并将 .o 文件与运行时库链接。
```bash
# build runtime lib
cargo build --release

# compile c shim
cc -c csrc/shims.c -o target/shims.o

# compile c source code
cc -c csrc/test.c -I csrc -o target/test.o

# link
cc -nostartfiles -nodefaultlibs \
		target/test.o target