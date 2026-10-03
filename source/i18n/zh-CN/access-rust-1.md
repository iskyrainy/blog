---
title: Access Rust 1
category: Tech
tag: Rust
date: 2025-05-19T00:37:17+08:00
---


> 除了刚接触编程时在学校里学习并使用非 GC 语言（C/C++）之外，我接触的大多是不需要手动管理内存的语言（Java/Go/Kotlin 等）。因此，我一直想尝试一门新的非 GC 语言：Rust。*AccessRust* 博客系列记录了我学习 Rust 时需要留意的要点（主要是阅读 [The Rust Programming Language](https://doc.rust-lang.org/book/title-page.html) 时的笔记）。🦀

# AccessRust-1

## 第一部分 安装 Rust

这里展示如何在 WSL（Ubuntu）中在线安装 Rust：

1. 更新 apt
   ```bash
    sudo apt upgrade
    sudo apt update
   ```

2. 安装 rust
   ```bash
    sudo apt install gcc
    gcc -v
    # 或者安装你想要的版本，比如 rust-1.80-all 等
    sudo apt install rust-all
   ```

3. 安装工具
   ```bash
    # 可能需要一些时间
    rustup default stable
   ```

4. 验证
   ```bash
    rustc -V
    cargo --version
    # 试用 cargo
    cargo new hello_world
    cd hello_world
    cargo run
   ```

## 第二部分 基础概念
`let`：定义一个不可变变量。例如 `let x = 0;`
`mut`：定义一个可变变量。例如 `let mut y = 1;`
`const`：声明一个常量，不能与 `mut` 一起使用。例如 `const THREE_HOURS_IN_SECONDS: u32 = 60 * 60 * 3;`
Rust 允许用相同的名字重新定义变量。
```rust
fn main() {
    let x = 5;
    let x = x + 1;
    {
        let x = x * 2;
        println!("The value of x in the inner scope is: {x}");
    }
    println!("The value of x is: {x}");
}

// The value of x in the inner scope is: 12
// The value of x is: 6
```

数据类型：
- 标量类型：整数、浮点数、布尔值和字符
- 复合类型：元组、数组
  

整数：
| 长度 | 有符号 | 无符号 |
| :-: | :-: | :-: |
| 8 位   | `i8`     | `u8`       |
| 16 位  | `i16`    | `u16`      |
| 32 位  | `i32`    | `u32`      |
| 64 位  | `i64`    | `u64`      |
| 128 位 | `i128`   | `u128`     |
| arch   | `isize`  | `usize`    |

十六进制：`0xff`，八进制：`0o77`，二进制：`0b1111_0000`，字节（仅 `u8`）：`b'A'`
溢出在 `debug` 模式下会引发 panic 错误，但在 `release` 模式下会“环绕”（比如 `u8` 变量从 257 变为 1）。
浮点数：`f32`/`f64`
布尔值：`bool`（`true`/`false`）
字符：`char`
元组：例如 `let tup: (i32, f64, u8) = (500, 6.4, 1);`
数组：例如 `let a: [i32; 5] = [1, 2, 3, 4, 5];`

## 第三部分 所有权

  所有存储在栈上的数据都必须有已知且固定的大小。编译时大小未知或大小可能变化的数据必须存储在堆上<sup>[1]</sup>。
所有权规则：
- Rust 中的每个值都有一个*所有者*。
- 同一时间只能有一个所有者。
- 当所有者*离开*作用域时，该值将被丢弃。

```rust
    {
        let s = String::from("hello"); // 从此刻起 s 是有效的

        // 使用 s 做一些事情

    }                                  // 这个作用域现在结束了，s 不再有效
                                       // 当离开作用域时，Rust 自动调用 `drop` 函数释放 s 的内存
```

没有浅拷贝，而是**移动（move）**。
对于存储在堆上的数据，考虑到离开*作用域*后两次调用 `drop` 会导致内存损坏，Rust 用 move 替代了浅拷贝。而且 **move** 是一个非常轻量的操作。

```bash
$ cargo run
   Compiling ownership v0.1.0 (file:///projects/ownership)
error[E0382]: borrow of moved value: `s1`
 --> src/main.rs:5:15
  |
2 |     let s1 = String::from("hello");
  |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s1;
  |              -- value moved here, s1 invaild
4 |
5 |     println!("{s1}, world!");
  |               ^^^^ value borrowed here after move
  |
  = note: this error originates in the macro `$crate::format_args_nl` which comes from the expansion of the macro `println` (in Nightly builds, run with -Z macro-backtrace for more info)
help: consider cloning the value if the performance cost is acceptable
  |
3 |     let s2 = s1.clone();
  |                ++++++++

For more information about this error, try `rustc --explain E0382`.
error: could not compile `ownership` (bin "ownership") due to 1 previous error
```

Rust 有 `Copy` trait 和 `Drop` trait。如果一个类型实现了 `Copy` trait，那么存储在栈上的变量就不会**移动**。如果该类型或其任何部分实现了 `Drop` trait，Rust 就不允许该类型实现 `Copy` trait。

关于函数的所有权：
```rust
fn main() {
    let s = String::from("Hello, world!");
    take_ownership(s);

    println!("{}", s); // 这一行会导致编译时错误

    let x = 5;
    make_copy(x);
    println!("{}", x); // 这一行可以正常工作，因为 i32 是 Copy 类型
}

fn take_ownership(s: String) {
    println!("{}", s);
}

fn make_copy(x: i32) {
    println!("{}", x);
}
```

> 为了避免繁琐的所有权管理，Rust 提供了一种在不转移所有权的情况下使用值的特性，称为*引用*。

Rust 使用 `&` 创建一个指向变量的引用。`&` 引用默认不可变，不传递和返回所有权。用 `mut` 创建可变引用，但这里同一时间每个变量只允许有一个可变引用，以避免*数据竞争*。

当我们已经有一个指向某个值的不可变引用时，就不能再有可变引用。

```bash
$ cargo run
   Compiling ownership v0.1.0 (file:///projects/ownership)
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
 --> src/main.rs:6:14
  |
4 |     let r1 = &s; // no problem
  |              -- immutable borrow occurs here
5 |     let r2 = &s; // no problem
6 |     let r3 = &mut s; // BIG PROBLEM
  |              ^^^^^^ mutable borrow occurs here
7 |
8 |     println!("{}, {}, and {}", r1, r2, r3);
  |                                -- immutable borrow later used here

For more information about this error, try `rustc --explain E0502`.
error: could not compile `ownership` (bin "ownership") due to 1 previous error
```

引用规则：
- 在任何给定时刻，你只能有一个可变引用或任意数量的不可变引用。
- 引用必须始终有效。
  

## 第四部分 结构体

请注意，整个实例必须是可变的；Rust 不允许我们只将某些字段标记为可变。
如果从已有的结构体对象构建一个新的结构体对象，并将旧对象的一些具有 `Drop` trait 的字段移动到新对象，那么旧对象将失效。

```rust
fn main() {
    let user1 = User {
        active: true,
        username: String::from("example_user"),
        email: String::from("aa"),
        sign_in_count: 1,
    };

    let user2 = User {
        active: false,
        ..user1 // user1 失效
    };

    let user3 = User {
        username: String::from("example_user"),
        email: String::from("aa"),
        ..user2 // user2 有效
    }
}

struct User{
    active: bool,
    username: String,
    email: String,
    sign_in_count: u64,
}
```

Rust 支持*元组结构体*和*类单元结构体*。
```rust
struct Color(i32, i32, i32);
struct Point(i32, i32, i32);
struct AlwaysEqual; // 类单元结构体

fn main() {
    let black = Color(0, 0, 0);
    let origin = Point(0, 0, 0);
    let subject = AlwaysEqual;
}
```

结构体字段是生命周期字段，不能写成 `username: &str`。

在 `impl` 块内定义的所有函数都称为关联函数。

## 第五部分 枚举与模式匹配

只有当我们有 `Option<T>` 时，才需要担心可能没有值，编译器会确保我们在使用该值之前处理这种情况。

```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}

impl Message {
    fn call(&self) {
        match self {
            Message::Quit => {
                println!("The Quit variant has no data to process.");
            }
            Message::Move { x, y } => { // &i32, &i32
                println!("Move to x: {}, y: {}", x, y);
            }
            Message::Write(text) => { // &String
                println!("Text: {}", text);
            }
            Message::ChangeColor(r, g, b) => { // &i32, &i32, &i32
                println!("Change color to red: {}, green: {}, blue: {}", r, g, b);
            }
        }
    }
}
```

**`match` 分支的模式必须覆盖所有可能性。**

`other` 列出所有未特别列出的值。
`_` 匹配任何值且不绑定到该值。
`if let` 作为 `match` 的语法糖：

```rust
let mut count = 0;
if let Some(i) = index {
    println!("{}", i);
} else {
    count += 1;
}

// 等同于
let mut count = 0;
match index {
    Some(i) => println!("{}", i),
    _ => count += 1,
}
```

`let else` 在主函数体作用域中创建变量：

```rust
fn add_one(index: Option<i32>) -> Option<i32> {
    let Some(i) = index else {
        return None;
    }
    Some(i + 1); // i 是有效的
}
```

## 第六部分 访问控制
- *包（Package）*：软件项目包，包含 `src`、`Config.toml`、`Config.lock` 等。
- *箱（Crate）*：可独立编译的单元，编译为可执行文件（src/main.rs）或库（src/lib.rs）。
- *模块（Module）*：将功能相关的代码组织在一起并用 mod 命名。一个文件可以包含多个 mod，mod 之间也可以嵌套。其中 `src/main.rs` 和 `src/lib.rs` 是 crate 根。

`pub`：控制模块和项的访问。
```rust
mod front_of_house {
    pub mod hosting {
        fn add_to_waitlist() {}
    }
}
```

`super`：相当于操作系统文件系统中的 `..`。
```rust
fn serve_order() {}

mod back_of_house {
    fn fix_incorrect_order() {
        cook_order();
        super::serve_order();
    }

    fn cook_order() {}
}
```

`self`：相当于操作系统文件系统中的 `.`。
```rust
fn serve_order() {
    self::back_of_house::cook_order()
}

mod back_of_house {
    fn fix_incorrect_order() {
        cook_order();
        crate::serve_order();
    }

    pub fn cook_order() {}
}
```

`use`：导入模块。
```rust
mod front_of_house {
    pub mod hosting {
        pub fn add_to_waitlist() {}
    }
}

use crate::front_of_house::hosting;

pub fn eat_at_restaurant() {
    hosting::add_to_waitlist();
    hosting::add_to_waitlist();
    hosting::add_to_waitlist();
}
```

**有限的可见性**：
- `pub`：对可见性没有限制
- `pub(crate)`：在当前 crate 中可见
- `pub(self)`：在当前模块中可见
- `pub(super)`：在父模块中可见
- `pub(in <path>)`：在 <path> 中可见

在 Rust 中，所有项（函数、方法、结构体、枚举、模块和常量）默认对父模块私有。
模块上的 `pub` 关键字只允许其祖先模块中的代码引用它，而不能访问其内部代码。

## 第七部分 常用集合
- `Vec`：列表。
  ```rust
    // 通过 Vec::new() 创建 Vec
    let v: Vec<i32> = Vec::new();

    // 通过宏 vec! 创建 Vec
    let v = vec![1, 2, 3];

    // 创建一个可变的 Vec
    let mut v = Vec::new();
    v.push(5);

    // 从 Vec 读取值：索引或 get()
    let v = vec![1, 2, 3, 4, 5];
    let third: &i32 = &v[2];
    println!("The third element is {third}");
    let third: Option<&i32> = v.get(2);
    match third {
        Some(third) => println!("The third element is {third}"),
        None => println!("There is no third element."),
    }

    // 遍历 Vec
    let mut v = vec![100, 32, 57];
    for i in &mut v {
        *i += 50;
    }
  ```
- `String`：字符串。
  ```rust
    // String 采用 UTF-8 编码
    let hello = String::from("السلام عليكم");
    let hello = String::from("Dobrý den");
    let hello = String::from("Hello");
    let hello = String::from("שלום");
    let hello = String::from("नमस्ते");
    let hello = String::from("こんにちは");
    let hello = String::from("안녕하세요");
    let hello = String::from("你好");
    let hello = String::from("Olá");
    let hello = String::from("Здравствуйте");
    let hello = String::from("Hola");

    // 遍历 String
    for c in "Зд".chars() {
        println!("{c}");
    }
    // З д

    for b in "Зд".bytes() {
        println!("{b}");
    }
    // 208 151 208 180
  ```
- `HashMap`：映射。
  ```rust
    // 
    use std::collections::HashMap;
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert(String::from("Blue"), 10);

    // 覆盖
    scores.insert(String::from("Blue"), 20);

    // 不存在时添加
    scores.entry(String::from("Blue")).or_insert(50);

    // 根据旧值更新值
    *scores.entry(String::from("Blue")).or_insert(50) += 50;
  ```

Rust 不允许在同一作用域中同时拥有可变引用和不可变引用。当我们持有指向向量中第一个元素的不可变引用并尝试在末尾添加元素时。如果我们在函数后面还尝试引用该元素，这个程序将无法工作。
向量将值在内存中紧挨着存放，如果在向量当前存储位置没有足够的空间将所有元素紧挨着放下，那么向向量末尾添加新元素可能需要分配新内存并将旧元素复制到新空间。
```rust
    let mut v = vec![1, 2, 3, 4, 5];

    let first = &v[0];

    v.push(6);

    println!("The first element is: {first}");
    //$ cargo run
    // Compiling collections v0.1.0 (file:///projects/collections)
    // error[E0502]: cannot borrow `v` as mutable because it is also borrowed as immutable
    // --> src/main.rs:6:5
    // |
    // 4 |     let first = &v[0];
    // |                  - immutable borrow occurs here
    // 5 |
    // 6 |     v.push(6);
    // |     ^^^^^^^^^ mutable borrow occurs here
    // 7 |
    // 8 |     println!("The first element is: {first}");
    // |                                     ------- immutable borrow later used here

    // For more information about this error, try `rustc --explain E0502`.
    // error: could not compile `collections` (bin "collections") due to 1 previous error
```

*String 不支持索引*：String 采用 UTF-8 编码，因此字符串字节的索引不总是对应有效的 Unicode 标量值。**在使用范围创建字符串切片时应谨慎，因为这样做可能导致程序崩溃。**

## 第八部分 错误处理
实际上有两种方式会导致 panic：采取某种导致代码 panic 的操作（例如访问数组越界），或者显式调用 `panic!` 宏。`RUST_BACKTRACE=1` 打印堆栈信息，如 `RUST_BACKTRACE=1 cargo run`。

出错时 panic 的快捷方式：
```rust
use std::fs::File;

// 原始写法
let greeting_file_result = File::open("hello.txt");
let greeting_file = match greeting_file_result {
    Ok(file) => file,
    Err(error) => panic!("Problem opening the file: {error:?}"),
};

// unwrap()
let greeting_file = File::open("hello.txt").unwrap();

// expect()
let greeting_file = File::open("hello.txt")
    .expect("hello.txt should be included in this project");
```

如果不想在出错时处理 panic，可以将错误传播给调用者。`?` 是传播错误的快捷方式，只能用于返回类型与 `?` 所作用的值兼容的函数中。而 `?` 在 `Option` 中的工作方式相同。
```rust
use std::fs::File;
use std::io::{self, Read};

fn read_username_from_file() -> Result<String, io::Error> {
    let username_file_result = File::open("hello.txt");

    let mut username_file = match username_file_result {
        Ok(file) => file,
        Err(e) => return Err(e),
    };

    let mut username = String::new();

    match username_file.read_to_string(&mut username) {
        Ok(_) => Ok(username),
        Err(e) => Err(e),
    }
}

// 快捷方式 `?`
fn read_username_from_file() -> Result<String, io::Error> {
    let mut username = String::new();
    File::open("hello.txt")?.read_to_string(&mut username)?;
    Ok(username)
}
```

什么时候应该 `panic`？
1. 测试时 panic
2. 如果我们能提供比编译器更多的信息，则 panic

遵循以下指导原则使用 panic：
- 这种错误状态是意料之外的，而不是可能偶尔发生的事情，比如用户输入了错误格式的数据。
- 此后的代码需要依赖不处于这种错误状态，而不是在每一步都检查这个问题。
- 没有办法在你使用的类型中编码这些信息。

## 第九部分 泛型、Trait 与生命周期
*泛型类型*：使用泛型类型不会使程序比使用具体类型运行得更慢。Rust 在编译时会将泛型类型转换为所使用的具体类型。
```rust
// 函数
fn largest<T>(list: &[T]) -> &T {}

// 结构体
struct Point<T, U> {
    x: T,
    y: U,
}

// 枚举
enum Result<T, E> {
    Ok(T),
    Err(E),
}

// impl
struct Point<T> {
    x: T,
    y: T,
}
impl<T> Point<T> {
    fn x(&self) -> &T {
        &self.x
    }
}
```

`trait`：某些方面类似于 Java/Go 中的 `interface`，trait 可以有默认实现，但在类型上实现 trait 时无需覆盖 trait 的所有 `fn`。
请注意，无法从覆盖同一方法本身的实现中调用该方法的默认实现。
Trait 作为参数，该参数接受任何实现了指定 trait 的类型。
仅当 trait 或类型（或两者）是我们 crate 的本地内容时，才能在类型上实现 trait。
```rust
pub trait Summary {
    fn summarize(&self) -> String;
}

pub struct NewsArticle {
    pub headline: String,
    pub location: String,
    pub author: String,
    pub content: String,
}

impl Summary for NewsArticle {
    fn summarize(&self) -> String {
        format!("{}, by {} ({})", self.headline, self.author, self.location)
    }
}

// 默认 trait
pub trait Summary {
    fn summarize(&self) -> String {
        String::from("(Read more...)")
    }
}
impl Summary for NewsArticle {}

// trait 作为参数
pub fn notify(item: &impl Summary) {
    println!("Breaking news! {}", item.summarize());
}

// trait bound 语法
// 等同于 `pub fn notify(item1: &impl Summary, item2: &impl Summary) {}`
pub fn notify<T: Summary>(item1: &T, item2: &T) {}

// 绑定多个 trait
fn some_function<T: Display + Clone, U: Clone + Debug>(t: &T, u: &U) -> i32 {}
// 使用 `where`
fn some_function<T, U>(t: &T, u: &U) -> i32
where
    T: Display + Clone,
    U: Clone + Debug,
{}

// 返回类型实现 trait
fn returns_summarizable() -> impl Summary {}
```

使用 trait bound 有条件地实现方法：
```rust
use std::fmt::Display;

struct Pair<T> {
    x: T,
    y: T,
}

impl<T> Pair<T> {
    fn new(x: T, y: T) -> Self {
        Self { x, y }
    }
}

// 仅当 Pair<T> 的内部类型 T 实现了支持比较的 PartialOrd trait 和支持打印的 Display trait 时，Pair<T> 才实现 cmp_display 方法
impl<T: Display + PartialOrd> Pair<T> {
    fn cmp_display(&self) {
        if self.x >= self.y {
            println!("The largest member is x = {}", self.x);
        } else {
            println!("The largest member is y = {}", self.y);
        }
    }
}

// 为任何实现了另一个 trait 的类型有条件地实现某个 trait
impl<T: Display> ToString for T {
    // --snip--
}
```

Rust 编译器有一个*借用检查器*，它通过比较作用域来判断所有借用是否有效。
在编译时，Rust 比较两个生命周期的长度，发现 r 的生命周期为 'a，但它引用的内存生命周期为 'b。程序被拒绝，因为 'b 比 'a 短：引用的目标存活时间没有引用本身长。
```rust
fn main() {
    let r;                // ---------+-- 'a
                          //          |
    {                     //          |
        let x = 5;        // -+-- 'b  |
        r = &x;           //  |       |
    }                     // -+       |
                          //          |
    println!("r: {r}");   //          |
}                         // ---------+
```

生命周期标注语法：生命周期标注不会改变任何引用的存活时间。它们描述的是多个引用之间生命周期的关系，而不影响生命周期本身。
```rust
&i32        // 一个引用
&'a i32     // 带有显式生命周期的引用
&'a mut i32 // 带有显式生命周期的可变引用

fn main() {
    let string1 = String::from("abcd");
    let string2 = "xyz";

    let result = longest(string1.as_str(), string2);
    println!("The longest string is {result}");
}

fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// 结构体定义中的生命周期标注
struct ImportantExcerpt<'a> {
    part: &'a str,
}

fn main() {
    let novel = String::from("Call me Ishmael. Some years ago...");
    let first_sentence = novel.split('.').next().unwrap();
    let i = ImportantExcerpt {
        part: first_sentence,
    };
}
```
当我们向 `longest` 传递具体的引用时，泛型生命周期 `'a` 将获得等于 `x` 和 `y` 中较短生命周期的具体生命周期。

**生命周期标注省略规则**：
1. 编译器为每个引用参数分配一个生命周期参数
2. 如果恰好只有一个输入生命周期参数，那么该生命周期被赋给所有输出生命周期参数
3. 如果有多个输入生命周期参数，但其中一个是 &self 或 &mut self（因为这是一个方法），那么 self 的生命周期被赋给所有输出生命周期参数

静态生命周期：`'static`，表示受影响的引用可以在程序的整个持续时间内存活。

[1]: 更多内容请参阅 [The Stack and the Heap](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#the-stack-and-the-heap)