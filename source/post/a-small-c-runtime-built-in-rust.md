---
title: A Small C Runtime Built In Rust
category: Tech
tag: [Linux, Rust]
date: 2026-07-20T23:12:40+08:00
---


## Motivation
Recently I am interesting about how to link/load programs. I believe everyone who writes code must has deep interests about how programs running in OS, and what is OS need to do around the `main()`.

And I reading the book<sup>[1]</sup> which introduces programs link process and it's really a highly detailed one. In the end of book, author gives the implement of *Linux/Windows 32bits C Runtime* which can replaces the `glibc`.

> What is learned from books ultimately feels superficial; to truly understand a matter, one must experience it firsthand.

So I want implement the Rust version of *x86_64/arm64 Linux C Runtime*.

## Workflow
I will not go into the detailed principles of C runtime and here will only briefly explain the overall working sequence of C runtime from OS to `main()`. Example in x86_64 Linux glibc.
1. Load: Linux kernel call the syscall *execve*<sup>[2]</sup> to load the target ELF<sup>[3]</sup> file, then kernel read ELF header to find program's entry point(for dynamic linked, entry point is the Linux dynamic linker).
2. Link: For dynamic linked programs, kernel go into the dynamic linker(`ld-linux-x86_64.so`) and let linker take over the management. Linker load all shared libs to main memory and relocate symbols to the real addresses. Finally linker relinquishes control to the entry point in libc(`_start`).
3. Runtime init: `_start` is a function written in assembly, it prepares `argc/argv/envp` for `main`, then call `__libc_start_main`. `__libc_start_main` is responsible for setting up TLS, initializing stdio, calling pre-initialization functions, and calling `main`.
4. Run and exit: `main` is called and start running, after `main` exit or return, `__libc_start_main` call functions was registed in `atexit`, finally call syscall `exit`.

Chain as below:
`Linux kernel execve -> [ld-linux] -> libc _start -> libc __libc_start_main -> runtime init -> main -> atexit/exit`

We will run the static linked c program, so there is no need care about *the step 2(Link)*.

## Implement

### entry
`entry` module is the core of our project. It takes responsible for:
- Read `argc/argv/envp` of `main`.
- Init the whole runtime.
- Call `main` with `argc/argv/envp`.
- Exit the process.

Before we start getting args of `main`, here is a conception about `main`. Although `int main(int argc, char *argv[])` is the most familiar form, the C standard actually allows the `main` function to have a third parameter: `int main(int argc, char *argv[], char *envp[])`.

In C, the `envp` parameter of the `main` function is a pointer to an array of environment variable strings; it is used to pass the system's environment variables to the running program.

> `envp` is not contained in the C standard (C89/C99/C11) but in the POSIX standard. Using `envp` does not allow you to read the most up-to-date environment variables. Therefore, after modifying environment variables, it is recommended to use `environ` instead of `envp`.

From x86-64 psABI<sup>[4]</sup> *3.2 Function Calling Sequence*, we can infer arguments addresses by `rsp` register, which always points the process stack's top (low address). Illustrate the stack frame layout using `./my_prog arg1` as an example.
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

This stack frame example just briefly show `argc/argv/envp` layout. LLVM recognises the `_start` symbol on x86_64 and inserts its own entry code into the function body. Now it's easily to runtime prepares parameters for `main`:
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

> As for the reason why put `argc/argv/envp` into `rdi/rsi/rdx`, also by the ABI standard: *If the class is INTEGER, the next available register of the sequence %rdi, %rsi, %rdx, %rcx, %r8 and %r9 is used.*
> So when call the `_start_c`, the parameters are auto passed to function `_start_c`, then `_start_c` will pass them to `main`.

In `_start` section, we use two assembly instructions: `mov` and `lea`. `mov` copy value from register A to register B, `lea`(Load Effective Address) has the same function with `mov`, but allow compute address in `[]` strightly.

Upon runtime initialization, a memory heap is allocated for `main`. Then call `main` with arguments, finally exit runtime.
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

This is the complete Runtime entry point.

### sys
Before we implement `heap` and `exit` modules, the first step is to implement the Linux *syscalls*. These syscalls basicly covers the most base OS operations:
- `sys_write`
- `sys_read`
- `sys_open`
- `sys_close`
- `sys_exit`

Design the syscall according to the ABI. This article will not cover Rust assembly details, please see more Rust assembly in [core::arch](https://doc.rust-lang.org/stable/core/arch/index.html#macros).
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
The heap is the memory space that a program requests from the operating system. The heap exists to supplement the insufficient stack frames.

One of the runtime core functions is prepare an initial heap memory. Linux x86_64 offers two syscalls: `brk()` and `mmap()`<sup>[5]</sup>.
- `brk()`: Allocate contiguous heap memory with a high performance, but memory can only be freed in the order of the brk pointers. Used in small space requests.
- `mmap()`: Allocate non-contiguous memory and has a lower performance than `brk`, memory can be freed casually，suitable for large memory requests.

In our implement, we dont distinguish between size so `mmap` is our choice. `mmap` syscall return the address pointer which is allocated by OS.
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

Now we has request a block memory for `main` requests memory. But to handle memory allocate/free requests from `main`, we also need a whole solution to manage heap: implements a simple **first-fit**<sup>[6]</sup> free-list allocator backed by OS memory.

Each allocation has a `BlockHeader` preceding the user data. All blocks form a singly-linked list sorted by address.
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

For now, we get the complete `heap::init()`:
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

Then we implement `malloc`/`free` to handle callings from `main`.
- `malloc`: Walk the list for a free block that fits (first-fit). If none found, request more memory from the OS.
- `free`: Mark the block as free and coalesce with adjacent free blocks to reduce fragmentation.
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

With `heap` we can offer memory allocate/free interfaces to `main`.

### exit
After `main` finished, the runtime is responsible for executing the registered *atexit* functions, cleaning up resources, and finally exiting the process.

What `exit::exit()` do is very simple. First run all registered atexit functions, then flush `stdout/stderr` to make all buffer clean, last call `sys::sys_exit()` exit process.
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

For those atexit functions, as the old way, we use a list to store them. When `exit` is called, runtime executes atexit functions one by one.
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

Also, we can implement a quick abort function to exit immediately.
```rust
#[no_mangle]
pub unsafe extern "C" fn abort() -> ! {
    sys::sys_exit(134)
}
```


### string
If our `main` function is relatively simple, string operations may not seem to be a necessary runtime implementation. However, if the string operations is not implemented, an error will occur when linking. This is because even if functions like `strcpy` are not explicitly called, LLVM will implicitly call these string functions during compilation. As the code below, LLVM will call `strcpy`:
```rust
#[no_mangle]
pub unsafe extern "C" fn test() {
    let mut a = [0u8; 1024];
    let b = [1u8; 1024];
    a = b; // memcpy is called here
}
```

So implement our string operations is necessary. One interesting thing is all string operations is work in user space and do not interact with kernel.
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

> We have implemented most of string operations, but in the last we get a `bcmp`. What is `bcmp`? Without `bcmp`, the linking maybe failed also.
> `bcmp`: byte string comparison (legacy BSD, identical semantics to memcmp for equality checks). LLVM may optimize memcmp calls into bcmp.


### io/fs
Boom! Finally we come here last part and going to implement the most famous function `printf`. In [sys](#sys) we have implemented `sys_write`, now we need advance one more step to implement the out layer.

We keeping copy contents to output `fd`, each 1024B we flush the buffer and write buffer contents by `sys::sys_write`.

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

By `fs::fwrite` it is easily to output an array of `char` into the specified `fd`. But `printf` includes more than these, it is responsible for format strings. We not intent to implement complex output format specifiers.

There is our functions:
- only support `%d`/`%s` output format specifiers, not includes position specifiers like `%08d`.
- `vfprintf` and `prinft`, actually `printf` is the one specified case of `vfprintf` which the target output `fd` is standard output.
- support indefinite length parameter.

The finally `printf` looks like:
```c
int main() {
  int a = 7;
  printf("Hello %d", a);
  return 0;
}

// Hello 7
```

The first problem is how we offer a function with indefinite length parameter in Rust? `va_list` is a pointer type in C/C++ used to handle functions with a variable number of arguments (such as `printf`). It is defined in the `<stdarg.h>` header file and is often used in conjunction with macros such as `va_start` (initialization), `va_arg` (get arguments), and `va_end` (cleanup). So if we implement `va_list` in Rust, so it can be analyzed in c by `stdarg.h`<sup>[7]</sup>.
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

And we analyze un-formated strings with `format_core`:
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

Finally we can get the `vfprintf`:
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

There is also need a shim to adapter `va_list` from Rust.
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

## Compile And Link
Now we have built a tiny core Rust runtime, which handles collecting parameters, the heap init, running main function and process exit, for c `main`.

It can be use like:
```c
#include<shims.h>

int main() {
  int a = 7;
  printf("Hello %d", a);
  return 0;
}
```

Let's compile source code and link the .o file with runtime lib.
```bash
# build runtime lib
cargo build --release

# compile c shim
cc -c csrc/shims.c -o target/shims.o

# compile c source code
cc -c csrc/test.c -I csrc -o target/test.o

# link
cc -nostartfiles -nodefaultlibs \
		target/test.o target/shims.o \
		target/release/libcrt_rs.a \
		-o target/test_prog

# run
./target/test_prog
```

## End
In this blog we provides a complete implementation of a Rust-based x86_64 Linux C runtime library, designed to replace glibc's startup and runtime functions. The entire implementation covers the complete process from kernel loading of the user program to program exit. The compiled static library libcrt_rs.a, along with a small amount of C shim code, can be linked to the user's C program using the -nostartfiles -nodefaultlibs options, allowing it to run normally without glibc.

>To understand not only what happens, but also why it happens. 

Understanding how a program works: high-level language code -> compiling binary -> linking -> running -> exiting, is a very interesting process. The complete code can be found on [rcrt](https://github.com/iskyrainy/rcrt). Thanks to *claudecode/deepseek* for their help during the writing process.

Links:
[1]: *The Self-Cultivation of a Programmer - Linking, Loading, and Libraries*.
[2]: [`execve()`](https://man7.org/linux/man-pages/man2/execve.2.html) executes the program referred to by path. All syscalls please read the details in [syscall(2)](https://man7.org/linux/man-pages/man2/syscalls.2.html).
[3]: Executable and Linking Format (ELF) files. See more in [elf(5)](https://man7.org/linux/man-pages/man5/elf.5.html).
[4]: System V ABI is an interface exposed by software that is defined for in-process machine code access, including calling conventions, type representations, and name mangling etc. See more in [x86-64 psABI](https://gitlab.com/x86-psABIs/x86-64-ABI).
[5]: A good blog about `mmap`: [mmap, munmap, mremap, msync, remap_file_pages系统调用](https://evian-zhang.github.io/introduction-to-linux-x86_64-syscall/src/memory_management/mmap-munmap-mremap-msync-remap_file_pages.html).
[6]: First-fit is easy but has a not bad performance. Better memory allocation algorithm see [Physical Page Allocation](https://www.kernel.org/doc/gorman/html/understand/understand009.html) and [glibc malloc](https://zhuanlan.zhihu.com/p/679188185).
[7]: See more in [va_list](https://en.cppreference.com/c/variadic/va_list).
