---
title: Rustで作る小さなCランタイム
category: Tech
tag: [Linux, Rust]
date: 2026-07-20T23:12:40+08:00
---


## 動機
最近、プログラムがどのようにリンク・ロードされるかに興味を持っている。コードを書く人なら誰でも、プログラムがOS上でどのように動作しているのか、そしてOSが`main()`の周りで何をする必要があるのかについて深い関心を持っているはずだ。

そして、プログラムのリンク過程を紹介する書籍<sup>[1]</sup>を読んでいるが、これは非常に詳細な一冊だ。本の最後で、著者は`glibc`を置き換えることができる*Linux/Windows 32ビットCランタイム*の実装を示している。

> 本から学んだことは結局のところ表面的に感じられる。ある事柄を真に理解するには、自ら体験しなければならない。

そこで、*x86_64/arm64 Linux Cランタイム*のRust版を実装したいと思う。

## ワークフロー
Cランタイムの詳細な原理には立ち入らず、ここではOSから`main()`に至るまでのCランタイムの全体的な動作順序を簡単に説明するのみとする。例はx86_64 Linux glibcを用いる。
1. ロード: Linuxカーネルがsyscallの*execve*<sup>[2]</sup>を呼び出して対象のELF<sup>[3]</sup>ファイルをロードし、その後カーネルがELFヘッダを読み取ってプログラムのエントリポイントを見つける(動的リンクの場合、エントリポイントはLinux動的リンカである)。
2. リンク: 動的リンクされたプログラムの場合、カーネルは動的リンカ(`ld-linux-x86_64.so`)に入り、リンカに管理を引き継がせる。リンカはすべての共有ライブラリをメインメモリにロードし、シンボルを実際のアドレスに再配置する。最後にリンカはlibc内のエントリポイント(`_start`)に制御を委ねる。
3. ランタイム初期化: `_start`はアセンブリで書かれた関数で、`main`のために`argc/argv/envp`を準備し、その後`__libc_start_main`を呼び出す。`__libc_start_main`はTLSの設定、stdioの初期化、事前初期化関数の呼び出し、そして`main`の呼び出しを担当する。
4. 実行と終了: `main`が呼び出されて実行を開始し、`main`の終了またはリターン後、`__libc_start_main`は`atexit`に登録された関数を呼び出し、最後にsyscall `exit`を呼び出す。

連鎖は以下のとおり:
`Linuxカーネル execve -> [ld-linux] -> libc _start -> libc __libc_start_main -> ランタイム初期化 -> main -> atexit/exit`

我々は静的リンクされたCプログラムを実行するので、*ステップ2(リンク)*を気にする必要はない。

## 実装

### entry
`entry`モジュールは本プロジェクトの中核である。これは以下を担当する:
- `main`の`argc/argv/envp`を読み取る。
- ランタイム全体を初期化する。
- `argc/argv/envp`を渡して`main`を呼び出す。
- プロセスを終了する。

`main`の引数を取得し始める前に、`main`についての概念がある。`int main(int argc, char *argv[])`が最も馴染み深い形式ではあるが、C標準は実際には`main`関数が第3のパラメータを持つことを許容している: `int main(int argc, char *argv[], char *envp[])`。

Cでは、`main`関数の`envp`パラメータは環境変数文字列の配列へのポインタであり、システムの環境変数を実行中のプログラムに渡すために使用される。

> `envp`はC標準(C89/C99/C11)には含まれず、POSIX標準に含まれる。`envp`を使っても最新の環境変数を読むことはできない。したがって、環境変数を変更した後は、`envp`ではなく`environ`を使うことを推奨する。

x86-64 psABI<sup>[4]</sup>の*3.2 Function Calling Sequence*から、プロセススタックのトップ(低アドレス)を常に指す`rsp`レジスタによって引数のアドレスを推測できる。`./my_prog arg1`を例にスタックフレームのレイアウトを図示する。
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

このスタックフレームの例は`argc/argv/envp`のレイアウトを簡単に示したにすぎない。LLVMはx86_64上の`_start`シンボルを認識し、独自のエントリコードを関数本体に挿入する。これでランタイムが`main`のためにパラメータを準備するのは容易である:
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

> `argc/argv/envp`を`rdi/rsi/rdx`に入れる理由も、ABI標準による: *クラスがINTEGERの場合、シーケンス%rdi、%rsi、%rdx、%rcx、%r8、%r9の次に利用可能なレジスタが使われる。*
> したがって、`_start_c`を呼び出すとき、パラメータは自動的に関数`_start_c`に渡され、`_start_c`がそれらを`main`に渡す。

`_start`セクションでは、2つのアセンブリ命令`mov`と`lea`を使う。`mov`はレジスタAからレジスタBに値をコピーし、`lea`(Load Effective Address)は`mov`と同様の機能を持つが、`[]`内でアドレスを直接計算できる。

ランタイム初期化の際、`main`のためにメモリヒープが割り当てられる。その後、引数を渡して`main`を呼び出し、最後にランタイムを終了する。
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

これが完全なランタイムのエントリポイントである。

### sys
`heap`と`exit`モジュールを実装する前に、まずLinuxの*syscall*を実装する。これらのsyscallは基本的に最も基礎的なOS操作を網羅している:
- `sys_write`
- `sys_read`
- `sys_open`
- `sys_close`
- `sys_exit`

ABIに従ってsyscallを設計する。本記事ではRustのアセンブリの詳細には触れない。Rustのアセンブリについてさらに知りたい場合は[core::arch](https://doc.rust-lang.org/stable/core/arch/index.html#macros)を参照されたい。
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
ヒープは、プログラムがオペレーティングシステムに要求するメモリ空間である。ヒープは、スタックフレームの不足を補うために存在する。

ランタイムの中核機能の1つは、初期ヒープメモリを準備することである。Linux x86_64は2つのsyscallを提供する: `brk()`と`mmap()`<sup>[5]</sup>。
- `brk()`: 高性能で連続したヒープメモリを割り当てるが、メモリはbrkポインタの順序でのみ解放できる。小さな空間の要求に使用される。
- `mmap()`: 非連続なメモリを割り当て、`brk`よりも性能は低いが、メモリを自由に解放でき、大きなメモリの要求に適している。

我々の実装ではサイズを区別しないので、`mmap`を選ぶ。`mmap` syscallはOSによって割り当てられたアドレスポインタを返す。
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

これで`main`がメモリを要求するためのメモリブロックを要求できた。しかし、`main`からのメモリの割り当て/解放の要求を処理するには、ヒープを管理する完全なソリューションも必要である: OSメモリに支えられた単純な**first-fit**<sup>[6]</sup>フリーリストアロケータを実装する。

各割り当てには、ユーザーデータの前に`BlockHeader`が存在する。すべてのブロックはアドレスでソートされた単方向連結リストを形成する。
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

これで完全な`heap::init()`が得られる:
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

次に、`main`からの呼び出しを処理するために`malloc`/`free`を実装する。
- `malloc`: 適合する空きブロック(first-fit)をリストから探す。見つからない場合は、OSに追加のメモリを要求する。
- `free`: ブロックを空きとしてマークし、隣接する空きブロックと合体させて断片化を減らす。
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

`heap`によって、`main`にメモリの割り当て/解放インターフェースを提供できる。

### exit
`main`が終了した後、ランタイムは登録された*atexit*関数を実行し、リソースをクリーンアップし、最後にプロセスを終了する責任がある。

`exit::exit()`が行うことは非常に単純である。まず登録されたすべてのatexit関数を実行し、次に`stdout/stderr`をフラッシュしてすべてのバッファをクリアし、最後に`sys::sys_exit()`を呼び出してプロセスを終了する。
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

atexit関数については、従来どおりリストを使って保存する。`exit`が呼び出されると、ランタイムはatexit関数を1つずつ実行する。
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

また、即座に終了するための簡単なabort関数を実装できる。
```rust
#[no_mangle]
pub unsafe extern "C" fn abort() -> ! {
    sys::sys_exit(134)
}
```


### string
我々の`main`関数が比較的単純であれば、文字列操作は必須のランタイム実装には思えないかもしれない。しかし、文字列操作を実装しないと、リンク時にエラーが発生する。これは、`strcpy`のような関数を明示的に呼び出さなくても、LLVMがコンパイル中にこれらの文字列関数を暗黙的に呼び出すためである。以下のコードのように、LLVMは`strcpy`を呼び出す:
```rust
#[no_mangle]
pub unsafe extern "C" fn test() {
    let mut a = [0u8; 1024];
    let b = [1u8; 1024];
    a = b; // memcpy is called here
}
```

したがって、文字列操作の実装は必要である。興味深いことに、すべての文字列操作はユーザー空間で動作し、カーネルとはやり取りしない。
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

> 我々は文字列操作のほとんどを実装したが、最後に`bcmp`が出てくる。`bcmp`とは何か? `bcmp`がなければ、リンクが失敗する可能性もある。
> `bcmp`: バイト文字列比較(レガシーBSD、等価性チェックに関してmemcmpと同一のセマンティクス)。LLVMはmemcmp呼び出しをbcmpに最適化することがある。


### io/fs
ついに最後の部分に到達し、最も有名な関数`printf`を実装する。[sys](#sys)で`sys_write`を実装したので、ここではさらに一歩進んで外側の層を実装する必要がある。

我々は出力`fd`に内容をコピーし続け、1024Bごとにバッファをフラッシュし、`sys::sys_write`によってバッファの内容を書き込む。

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

`fs::fwrite`によって、`char`の配列を指定された`fd`に簡単に出力できる。しかし`printf`はこれ以上のものを含み、フォーマット文字列を担当する。我々は複雑な出力フォーマット指定子を実装するつもりはない。

我々の関数は以下のとおり:
- `%d`/`%s`の出力フォーマット指定子のみをサポートし、`%08d`のような位置指定子は含まない。
- `vfprintf`と`printf`、実際には`printf`は`vfprintf`の特定のケースであり、対象の出力`fd`が標準出力である。
- 不定長のパラメータをサポートする。

最終的な`printf`は次のようになる:
```c
int main() {
  int a = 7;
  printf("Hello %d", a);
  return 0;
}

// Hello 7
```

最初の問題は、Rustで不定長のパラメータを持つ関数をどう提供するかである。`va_list`はC/C++における可変個数の引数を持つ関数(`printf`など)を扱うために使われるポインタ型である。これは`<stdarg.h>`ヘッダファイルで定義され、`va_start`(初期化)、`va_arg`(引数の取得)、`va_end`(クリーンアップ)といったマクロと組み合わせて使われることが多い。したがって、Rustで`va_list`を実装すれば、`stdarg.h`<sup>[7]</sup>によってCで解析できる。
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

そして`format_core`でフォーマットされていない文字列を解析する:
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
                    let n = string::int_to_str(&mut num_buf, val as u64, 10,