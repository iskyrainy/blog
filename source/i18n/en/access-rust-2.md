---
title: 深入 Rust 2
category: Tech
tag: Rust
date: 2025-06-16T00:27:12+08:00
---


# AccessRust-2
## 第 10 部分 测试
要将一个函数变为测试函数，在 `fn` 上一行添加 `#[test]`。使用 `assert!`/`assert_eq!`/`assert_ne!` 宏检查结果。
```rust
pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

// cargo test
// running 1 test
// test tests::it_works ... ok
```

`#[should_panic]` 标记的测试在函数内部代码 panic 时通过，在函数内部代码没有 panic 时失败。
默认情况下 `cargo test` 在多线程中运行测试，使用 `cargo test -- --test-threads=[num]` 设置线程数。
使用 `cargo test -- --show-output` 显示通过的测试输出。`cargo test [str]` 运行名称包含 [str] 的指定测试。`#[ignore]` 表示该测试在运行 `cargo test` 时会被忽略，但会在 `cargo test -- --ignored` 中运行。

`#[cfg]` 代表 *configuration*（配置），标记后面的项只应在给定某个配置选项时才被包含。比如 `#[cfg(test)]` 块只会被 `cargo test` 包含。


## 第 11 部分 函数式语言特性
闭包：匿名函数
对于闭包定义，编译器会为其每个参数和返回值推断一个具体类型。
```rust
let example_closure = |x| x;

let s = example_closure(String::from("hello")); // 推断 x 的类型为 String
let n = example_closure(5); // 期望 String，却得到整数，此处 panic
```

即使闭包体仍然只需要一个不可变引用，我们也需要通过在闭包定义开头放置 `move` 关键字来指定 `list` 应该被移动到闭包中。新线程可能在主线程其余部分完成之前结束，或者主线程可能先结束。如果主线程保持了 list 的所有权但在新线程之前结束并丢弃了 list，线程中的不可变引用就会失效。
```rust
use std::thread;

fn main() {
    let list = vec![1, 2, 3];
    println!("Before defining closure: {list:?}");

    thread::spawn(move || println!("From thread: {list:?}"))
        .join()
        .unwrap();
}
```

闭包的 trait：
- `FnOnce`：将捕获值移出其闭包体的闭包只会实现 `FnOnce`，而不实现其他 `Fn` trait，因为它只能被调用一次。所有闭包至少实现这个 trait。
- `FnMut`：不会将捕获值移出其闭包体，但可能会修改捕获值。
- `Fn`：不会将捕获值移出其闭包体，也不会修改捕获值，以及不从其环境中捕获任何内容的闭包。

## 第 12 部分 Cargo
### 12.1 构建
`cargo build`：在 *dev* profile 中构建
`cargo build --release`：在 *release* profile 中构建

使用 `opt-level` 控制 Rust 将对代码应用的优化数量，范围为 0 到 3，较高的级别（3）会花费更多时间编译代码，并得到更快的产物：
```rust
[profile.dev]
opt-level = 0

[profile.release]
opt-level = 3
```

### 12.2 添加文档并发布 crate
`cargo doc` 生成项目文档（文档注释使用三个斜杠，`///`），而 `cargo doc --open` 会在浏览器中打开生成的 index.html（如果在 wsl 中打开，请确保已安装 `wslview`）。

使用 `pub use` 重新导出项，以创建一个与私有结构不同的公共结构。

1. 在 [crates.io](https://crates.io) 中创建 API token，并在 cmd 中使用 `cargo login` 登录
2. 设置 crate 信息，包括 *description、license、license-file、documentation、homepage 或 repository*，然后使用 `cargo publish` 发布 crate
3. cargo 不允许删除任何已发布的版本。但可以使用 `cargo yank --vers [x.x.x]` 将版本标记为已弃用。yank 意味着所有带有 *Cargo.lock* 的项目都不会损坏，并且任何未来生成的 *Cargo.lock* 文件都不会使用被 yank 的版本。通过在命令中添加 --undo，你也可以撤销 yank 并允许项目重新开始依赖某个版本，例如 `cargo yank --vers [x.x.x] --undo`

### 12.3 使用 workspace
进入 workspace 目录并创建包含以下内容的 `Cargo.toml`：
```rust
[workspace]
resolver = "3"
```
然后使用 `cargo new` 创建二进制 crate。workspace 在顶层有一个 target 目录，编译产物将放置其中。

Cargo 不会假设 workspace 中的 crate 会相互依赖，因此我们需要明确说明依赖关系。
```rust
[dependencies]
add_one = { path = "../add_one" }
```

通过 `-p [crate_name]` 指定我们想要运行 workspace 中的哪个 package。注意，workspace 在顶层只有一个 Cargo.lock 文件，而不是每个 crate 目录中都有一个 Cargo.lock。这确保所有 crate 使用相同版本的所有依赖。

### 12.4 从 crates.io 安装二进制文件
`cargo install` 在本地安装二进制文件（当 crate 具有 src/main.rs 文件或指定为二进制的另一个文件时创建的可运行程序，相对于库目标而言，库目标本身不可运行但适合包含在其他程序中）。
```bash
$ cargo install ripgrep
    Updating crates.io index
  Downloaded ripgrep v14.1.1
  Downloaded 1 crate (213.6 KB) in 0.40s
  Installing ripgrep v14.1.1
--snip--
   Compiling grep v0.3.2
    Finished `release` profile [optimized + debuginfo] target(s) in 6.73s
  Installing ~/.cargo/bin/rg
   Installed package `ripgrep v14.1.1` (executable `rg`)
```
### 12.5 使用自定义命令扩展 cargo
Cargo 的设计使你可以用新的子命令扩展它，而无需修改它。如果你的 $PATH 中有一个名为 cargo-something 的二进制文件，你可以通过运行 `cargo something` 将其当作 Cargo 子命令来运行。当你运行 `cargo --list` 时，这样的自定义命令也会被列出。能够使用 cargo install 安装扩展，然后像内置命令一样运行它们。

## 第 13 部分 智能指针
智能指针实现了 `Deref` 和 `Drop` trait。
- `Deref`：允许智能指针结构体的实例表现得像引用
- `Drop`：允许你自定义当智能指针实例离开作用域时运行的代码

`std` 中的一些智能指针：
- `Box<T>`：用于在堆上分配值
- `Rc<T>`：一种引用计数类型，支持多重所有权
- `Ref<T>`/`RefMut<T>`：通过 `RefCell<T>` 访问，这是一种在运行时而非编译时强制执行借用规则的类型

### 13.1 Box<T>
`Box<T>` 允许将数据存储在堆上而不是栈上，只在栈上存储指针。
在以下情况中最常使用 `Box<T>`：
- 当你有一个编译时无法知道大小的类型，并且你想在需要确切大小的上下文中使用该类型的值时：比如将 *递归类型* 转换为 *非递归类型*<sup>[1]</sup>
- 当你有大量数据并且想转移所有权，但确保在这样做时数据不会被复制时
- 当你想拥有一个值并且只关心它是实现了特定 trait 的类型，而不是具体类型时

### 13.2 Deref/Drop trait
实现 Deref trait 允许你自定义 *解引用运算符* `*` 的行为。当我们输入 `*y` 时，Rust 实际上在背后运行了 `*(y.deref())`。

当实例离开作用域时，Rust 自动调用 `drop`。

### 13.3 Rc<T>
Rc：*reference counting*（引用计数）
如果对某个值的引用为零，该值就可以被清理，而不会使任何引用失效。

`Rc::clone` 的实现不像大多数类型的 `clone` 实现那样对所有数据进行深拷贝。调用 `Rc::clone` 只会增加引用计数。

### 13.4 RefCell<T>
RefCell：通过 *Interior mutability*（内部可变性）允许修改不可变值。
注意 `RefCell<T>` 不适用于多线程代码！`Mutex<T>` 是 `RefCell<T>` 的线程安全版本。

### 13.5 内存泄漏
如果你有包含 `Rc<T>` 值的 `RefCell<T>` 值，或类似的内部可变性与引用计数的嵌套类型组合，你必须确保不会创建循环；你不能依赖 Rust 来捕获它们。创建引用循环将是你程序中的逻辑错误，你应该使用自动化测试、代码审查和其他软件开发实践来尽量减少它。
避免引用循环的另一个解决方案是重组数据结构，例如使用弱引用而不是强引用。弱引用不表达所有权关系，它们的计数不影响 `Rc<T>` 实例何时被清理。它们不会导致引用循环，因为任何涉及一些弱引用的循环在相关值的强引用计数为 0 时都会被打破。
因为 `Weak<T>` 引用的值可能已经被丢弃，所以要对 `Weak<T>` 指向的值做任何事，你必须确保该值仍然存在。可以通过调用 `Weak<T>` 实例上的 `upgrade` 方法来实现，它会返回一个 `Option<Rc<T>>`。

一个关于不会导致引用循环的树节点的例子：
```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

#[derive(Debug)]
struct Node {
    value: i32,
    parent: RefCell<Weak<Node>>,
    children: RefCell<Vec<Rc<Node>>>,
}
```

## 第 14 部分 并发
通过利用所有权和类型检查，许多并发错误在 Rust 中是编译时错误，而不是运行时错误。

Rust 标准库使用 1:1 的线程实现模型，即程序为每个语言线程使用一个操作系统线程。

### 14.1 通道
`mpsc::channel` 函数（mpsc：*multiple producer, single consumer*，多生产者，单消费者）返回一个元组，第一个元素是发送端——发送者——第二个元素是接收端——接收者。
```rust
// --snip--

let (tx, rx) = mpsc::channel();

let tx1 = tx.clone();
thread::spawn(move || {
    let vals = vec![
        String::from("hi"),
        String::from("from"),
        String::from("the"),
        String::from("thread"),
    ];

    for val in vals {
        tx1.send(val).unwrap();
        thread::sleep(Duration::from_secs(1));
    }
});

thread::spawn(move || {
    let vals = vec![
        String::from("more"),
        String::from("messages"),
        String::from("for"),
        String::from("you"),
    ];

    for val in vals {
        tx.send(val).unwrap();
        thread::sleep(Duration::from_secs(1));
    }
});

for received in rx {
    println!("Got: {received}");
}

// --snip--

// 输出
// Got: hi
// Got: more
// Got: from
// Got: messages
// Got: for
// Got: the
// Got: thread
// Got: you
```

### 14.2 共享状态并发
通道类似于单一所有权，一旦将值通过通道传递，就不应对该值做任何更改。
共享内存并发类似于多重所有权：多个线程可以同时访问同一内存位置。

`Mutex<T>` 是一个智能指针。对 lock 的调用返回一个名为 `MutexGuard` 的智能指针，它被包裹在 `LockResult` 中，我们通过调用 unwrap 来处理。`MutexGuard` 智能指针实现了 `Deref` 来指向我们的内部数据；该智能指针还有一个 `Drop` 实现，当 `MutexGuard` 离开作用域时自动释放锁，这发生在内部作用域结束时。
`Mutex<T>` 是不可变的，但我们可以获得对其内部值的可变引用，`Mutex<T>` 提供内部可变性，就像 `Cell` 系列一样。
```rust
use std::sync::Mutex;

fn main() {
    let m = Mutex::new(5);

    {
        let mut num = m.lock().unwrap();
        *num = 6; // 通过 * 解引用
    } // 自动释放锁

    println!("m = {m:?}");
}
```

使用 `Arc<T>` 确保跨线程共享安全，而不是 `Rc<T>`。
```rust
/// 使用 Mutex<T> 在多个线程之间共享一个值
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter.lock().unwrap();

            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Result: {}", *counter.lock().unwrap());
}
```

### 14.3 可扩展并发
处理并发不限于语言或标准库。嵌入语言而非标准库的关键并发概念包括 `std::marker` trait 中的 `Send` 和 `Sync`<sup>[2]</sup>。
- `Send`：表示实现 `Send` 的类型的值的所有权可以在线程之间转移。任何完全由 `Send` 类型组成的类型也会自动被标记为 `Send`。
- `Sync`：表示实现 `Sync` 的类型可以安全地从多个线程中被引用。完全由实现 `Sync` 的类型组成的类型也实现 `Sync`。

## 第 15 部分 异步编程
`await`：后缀关键字，便于形成方法链。
```rust
let response_text = trpl::get(url).await.text().await;
```

当 Rust 看到标记有 `async` 关键字的块时，它会将其编译为一个实现了 `Future` trait 的唯一匿名数据类型。当 Rust 看到标记有 `async` 的函数时，它会将其编译为一个非 async 函数，其主体是一个 async 块。async 函数的返回类型是编译器为该 async 块创建的匿名数据类型的类型。
```rust
// 源码
use trpl::Html;

async fn page_title(url: &str) -> Option<String> {
    let response = trpl::get(url).await;
    let text = response.text().await;
    Html::parse(&text)
        .select_first("title")
        .map(|title| title.inner_html())
}

// 编译后
use std::future::Future;
use trpl::Html;

fn page_title(url: &str) -> impl Future<Output = Option<String>> {
    async move {
        let text = trpl::get(url).await.text().await;
        Html::parse(&text)
            .select_first("title")
            .map(|title| title.inner_html())
    }
}
```

每个 *`await`* 点代表将控制权交还给运行时的地方。Rust 有一个不可见的状态机，编译器确保相邻状态之间的安全性。

`Future`：当看到使用 `await` 的代码时，Rust 会在底层将其编译为在一个特殊的 `loop` 中调用 `poll` 的代码。Rust 确保该 `loop` 可以将控制权移交给某个能够暂停此 future 的工作以处理其他 future 并在稍后再次检查此 future 的东西。
```rust
use std::pin::Pin;
use std::task::{Context, Poll};

pub trait Future {
    type Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

enum Poll<T> {
    Ready(T),
    Pending,
}
```

`Pin`/`Unpin`：
对于那些可能具有自引用数据类型的对象（默认情况下，任何对自身有引用的对象在移动时都是不安全的）。
![移动自引用数据类型的不安全结果](https://doc.rust-lang.org/book/img/trpl17-05.svg)

当通过将指向该值的指针包裹在 `Pin` 中来固定一个值时，它就不能再移动了。因此，对于 `Pin<Box<SomeType>>`，运行时实际上固定的是 `SomeType` 值（存储在堆中），而不是 `Box` 指针。
![移动指向自引用 future 类型的 `Box`。](https://doc.rust-lang.org/book/img/trpl17-07.svg)

`Unpin` 是一个标记 trait，类似于 `Send` 和 `Sync` trait（编译器会为所有它能证明安全安全的类型自动实现 `Unpin`）。标记 trait 的存在只是为了告诉编译器在特定上下文中使用实现给定 trait 的类型是安全的。`Unpin` 告知编译器给定类型不需要保证相关值是否可以安全移动。

`Stream`：为了表示随时间变得就绪的项序列，定义了一个 `Stream` trait 将这些特性组合在一起。
```rust
use std::pin::Pin;
use std::task::{Context, Poll};

trait Stream {
    type Item;

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>
    ) -> Poll<Option<Self::Item>>;
}
```

关于 `Future`/`Pin`/`Stream` trait 的更多实现细节见 [A Closer Look at the Traits for Async](https://doc.rust-lang.org/book/ch17-05-traits-for-async.html)。


## 第 16 部分 模式与匹配
### 16.1 所有模式
1. `match`：`match` 表达式需要是 *穷尽的*，`match` 表达式中值的所有可能性都必须被考虑到。
   ```rust
    match x {
        None => None,
        Some(i) => Some(i + 1),
    }
    ```
2. `if let`：编译器不检查穷尽性。
   ```rust
    fn main() {
        let favorite_color: Option<&str> = None;
        let is_tuesday = false;
        let age: Result<u8, _> = "34".parse();

        if let Some(color) = favorite_color {
            println!("Using your favorite color, {color}, as the background");
        } else if is_tuesday {
            println!("Tuesday is green day!");
        } else if let Ok(age) = age {
            if age > 30 {
                println!("Using purple as the background color");
            } else {
                println!("Using orange as the background color");
            }
        } else {
            println!("Using blue as the background color");
        }
    }
   ```
3. `while let`：
   ```rust
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        for val in [1, 2, 3] {
            tx.send(val).unwrap();
        }
    });

    while let Ok(value) = rx.recv() {
        println!("{value}");
    }
   ```
4. `for`：
   ```rust
    let v = vec!['a', 'b', 'c'];

    for (index, value) in v.iter().enumerate() {
        println!("{value} is at index {index}");
    }
   ```

### 16.2 可反驳性
模式有两种形式：可反驳的和不可反驳的。对于传入的任何可能值都会匹配的模式是不可反驳的。
```rust
let x = 5; // 不可反驳：x 可以匹配任何值

let Some(x) = a_value; // 可反驳：如果 a_value 是 None，则匹配失败
```
函数参数、`let` 语句和 `for` 循环只能接受不可反驳的模式。
`if let` 和 `while let` 表达式以及 `let...else` 语句接受可反驳和不可反驳的模式。

更多模式语法见 [Pattern Syntax](https://doc.rust-lang.org/book/ch19-03-pattern-syntax.html)。

## 第 17 部分 高级特性
### 17.1 unsafe
`unsafe` 提供超能力，包括以下能力<sup>[3]</sup>：
- 解引用裸指针
  ```rust
    let mut num = 5;

    let r1 = &raw const num;
    let r2 = &raw mut num;
    let address = 0x012345usize;
    let r = address as *const i32;

    unsafe {
        println!("r1 is: {}", *r1);
        println!("r2 is: {}", *r2);
        println!("r is: {}", *r);
    }
  ```
- 调用 unsafe 函数或方法
  ```rust
    unsafe fn dangerous() {}

    unsafe {
        dangerous();
    }
  ```
  在 unsafe 代码之上创建安全抽象：
  ```rust
    let mut v = vec![1, 2, 3, 4, 5, 6];

    let r = &mut v[..];

    let (a, b) = r.split_at_mut(3);

    assert_eq!(a, &mut [1, 2, 3]);
    assert_eq!(b, &mut [4, 5, 6]);
  ```
  调用 extern 函数：
  ```rust
    unsafe extern "C" {
        safe fn abs(input: i32) -> i32;
    }

    fn main() {
        println!("Absolute value of -3 according to C: {}", abs(-3));
    }
  ```
- 访问或修改可变静态变量
  ```rust
    static mut COUNTER: u32 = 0;

    /// SAFETY: Calling this from more than a single thread at a time is undefined
    /// behavior, so you *must* guarantee you only call it from a single thread at
    /// a time.
    unsafe fn add_to_count(inc: u32) {
        unsafe {
            COUNTER += inc;
        }
    }

    fn main() {
        unsafe {
            // SAFETY: This is only called from a single thread in `main`.
            add_to_count(3);
            println!("COUNTER: {}", *(&raw const COUNTER));
        }
    }
  ```
- 实现 unsafe trait
  ```rust
    unsafe trait Foo {
        // methods go here
    }

    unsafe impl Foo for i32 {
        // method implementations go here
    }
  ```
- 访问 `union` 的字段：union 主要用于与 C 代码中的 union 交互。访问 union 字段是 unsafe 的，因为 Rust 无法保证当前存储在 union 实例中的数据的类型

### 17.2 高级 trait
*关联类型* 将类型占位符与 trait 连接起来，使得 trait 方法定义可以在其签名中使用这些占位符类型。

关联类型与泛型的区别：关联类型 trait 只能实现一次，但泛型 trait 可以为每种类型实现

运算符重载：Rust 不允许创建运算符或重载任意运算符。但可以通过实现与运算符关联的 trait 来重载 `std::ops` 中列出的操作和对应 trait。
```rust
use std::ops::Add;

#[derive(Debug, Copy, Clone, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}

impl Add for Point {
    type Output = Point;

    fn add(self, other: Point) -> Point {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

fn main() {
    assert_eq!(
        Point { x: 1, y: 0 } + Point { x: 2, y: 3 },
        Point { x: 3, y: 3 }
    );
}
```

默认泛型类型：`Rhs`（right-hand side，右侧）
```rust
trait Add<Rhs=Self> {
    type Output;

    fn add(self, rhs: Rhs) -> Self::Output;
}
```

当调用同名方法时：
```rust
trait Pilot {
    fn fly(&self);
}

trait Wizard {
    fn fly(&self);
}

struct Human;

impl Pilot for Human {
    fn fly(&self) {
        println!("This is your captain speaking.");
    }
}

impl Wizard for Human {
    fn fly(&self) {
        println!("Up!");
    }
}

impl Human {
    fn fly(&self) {
        println!("*waving arms furiously*");
    }
}

fn main() {
    let person = Human;
    Pilot::fly(&person); // This is your captain speaking.
    Wizard::fly(&person); // Up!
    person.fly(); // *waving arms furiously*
}
```

如果是不带 `self` 参数的关联函数：
```rust
trait Animal {
    fn baby_name() -> String;
}

struct Dog;

impl Dog {
    fn baby_name() -> String {
        String::from("Spot")
    }
}

impl Animal for Dog {
    fn baby_name() -> String {
        String::from("puppy")
    }
}

fn main() {
    println!("A baby dog is called a {}", Dog::baby_name()); // Spot
    println!("A baby dog is called a {}", <Dog as Animal>::baby_name()); // puppy
}
```

要让一个类型实现第一个 trait，并要求该类型也实现第二个 trait：`trait <trait_1>: <trait_2>`
```rust
use std::fmt;

trait OutlinePrint: fmt::Display {
    fn outline_print(&self) {
        // snip
    }
}
```

***newtype 模式***：*orphan rule*（孤儿规则）只允许在 trait 或类型其中之一（或两者都）属于当前 crate 时，为类型实现 trait。如果我们希望新类型具有内部类型的所有方法，在 Wrapper 上实现 `Deref` trait 以返回内部类型将是一种解决方案。
```rust
use std::fmt;

// impl Display for Vec<>
struct Wrapper(Vec<String>);

impl fmt::Display for Wrapper {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "[{}]", self.0.join(", "))
    }
}

fn main() {
    let w = Wrapper(vec![String::from("hello"), String::from("world")]);
    println!("w = {w}");
}
```

### 17.3 高级类型
类型别名：只是别名，不是新类型
```rust
type Kilometers = i32;

let x: i32 = 5;
let y: Kilometers = 5;

println!("x + y = {}", x + y);
```

*never 类型*：`!`，它没有值。比如在 `let ... match` 分支中（必须返回相同类型，以便编译器知道值的类型）：
```rust
let guess: u32 = match guess.trim().parse() {
    Ok(num) => num,
    Err(_) => continue, // continue 具有 ! 值，所以 Rust 知道 guess 是 u32 类型
};

impl<T> Option<T> {
    pub fn unwrap(self) -> T {
        match self {
            Some(val) => val,
            None => panic!("called `Option::unwrap()` on a `None` value"), // panic! 也具有 ! 值，所以 Rust 知道 val 是 T 类型
        }
    }
}

loop {
    print!("and ever "); // 循环永不结束，所以 ! 是该表达式的值
}
```

*动态大小类型* 的规则是我们必须始终将动态大小类型的值放在某种指针之后。

### 17.4 高级函数和闭包
函数指针：将常规函数而非新函数传递给函数
```rust
fn add_one(x: i32) -> i32 {
    x + 1
}

fn do_twice(f: fn(i32) -> i32, arg: i32) -> i32 {
    f(arg) + f(arg)
}

fn main() {
    let answer = do_twice(add_one, 5);

    println!("The answer is: {answer}");
}
```

返回闭包：`returns_closure` 和 `returns_initialized_closure` 都返回 `impl Fn(i32) -> i32`，但不能被视为相同类型。每当返回 `impl Trait` 时，Rust 都会创建一个唯一的不透明类型。
```rust
fn returns_closure() -> impl Fn(i32) -> i32 {
    |x| x + 1
}

fn returns_initialized_closure(init: i32) -> impl Fn(i32) -> i32 {
    move |x| x + init
}
```

### 17.5 宏
宏与函数的区别：
| 方面 | 宏 | 函数 |
| :-     | :-    | :-       |
| 定义 | `macro_rules!`/`proc_macro` | `fn` |
| 调用 | `!` 后缀 | function_name() |
| 展开 | 编译时展开 | 运行时展开 |
| 参数 | 可变数量的参数 | 固定数量的参数 |
| 类型检查 | 无 | 有 |
| 运行时开销 | 无 | 有 |
| 代码复用性 | 高复用性 | 有限的复用性 |
| 维护和调试 | 困难 | 简单 |

相同点：
1. 宏和函数都可以用来封装逻辑并减少代码重复
2. 宏和函数都需要在编译前定义（宏需要在调用前定义，函数没有这种限制）
3. 宏和函数都可以结合泛型参数（如 T）来实现多态

使用 `macro_rules!` 定义一个略微简化的 `vec!` 宏：
```rust
#[macro_export]
macro_rules! vec {
    ( $( $x:expr ),* ) => {
        {
            let mut temp_vec = Vec::new();
            $(
                temp_vec.push($x);
            )*
            temp_vec
        }
    };
}
// `#[macro_export]` 注解表示只要定义该宏的 crate 被引入作用域，这个宏就应可用
// `macro_rules!` 和宏名称定义这是一个宏，{} 是宏定义的主体
// `vec!` 的主体类似于 match 表达式的结构。如果模式匹配，将发出关联的代码块
// `$()` 内是 `$x:expr`，它匹配任何 Rust 表达式，并将该表达式命名为 `$x`
// `*` 指定模式匹配 `*` 前面的内容零次或多次
```

过程宏是一种高级元编程工具，允许开发者在编译时动态生成或修改代码。与基于模式匹配的声明式宏（`macro_rules!`）不同，过程宏通过对 `TokenStream`（Rust 的语法单元）和抽象语法树（AST）的操作实现更复杂的逻辑，使其成为构建库、框架和工具的核心技术。
三种 *过程* 宏：
- 自定义 `#[derive]` 宏，指定通过用于结构体和枚举的 `derive` 属性添加的代码。自动为结构体或枚举实现特定 Trait。
  ```rust
    #[derive(Debug, Clone)]
    struct Point { x: i32, y: i32 }
  ```
- 类属性宏，定义可用于任何项的自定义属性。修改或扩展函数、结构体、模块等项的行为。常用于添加自定义注解或配置。
  ```rust
    #[route(GET, "/")]
    fn index() {}
  ```
- 类函数宏，看起来像函数调用，但对作为其参数指定的 token 进行操作，类型类似于 `macro_rules!`
  ```rust
    sql!(SELECT * FROM users WHERE id = 1);
  ```
如何创建 derive 宏？<sup>[4]</sup>

[1]: 更多内容见 [Enabling Recursive Types with Boxes](https://doc.rust-lang.org/book/ch15-01-box.html#enabling-recursive-types-with-boxes)
[2]: 更多内容见 [The Rustonomicon](https://doc.rust-lang.org/nomicon/index.html)
[3]: 阅读 Rust 官方关于该主题的指南 [Rustonomicon](https://doc.rust-lang.org/nomicon/)
[4]: 见 [How to Write a Custom derive Macro](https://doc.rust-lang.org/book/ch20-05-macros.html#how-to-write-a-custom-derive-macro)