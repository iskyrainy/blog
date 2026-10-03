---
title: 理解 Rust 的引用与智能指针
category: Tech
tag: Rust
date: 2026-03-27T12:56:04+08:00
---


## 第一部分 为什么 Rust 有这么多种指针类型？
对于 Rust 初学者来说，这确实很令人困惑：为什么 Rust 有这么多种指针类型？
```console
&T
&mut T
Box<T>
Rc<T>
Arc<T>
Cell<T>
RefCell<T>
Mutex<T>
Pin<T>
```

指针是一种非常非常强大的工具，可以任意地控制和修改内存。

有时开发者不得不像俄罗斯套娃一样使用*指针组合*，形成相互嵌套的奇怪形状，几乎就像巫师的涂鸦，比如二叉树中的 `Arc<Mutex<Vec<Rc<RefCell<T>>>>>`。那么 `&T` 和 `Box<T>` 有什么区别？或者就并发安全而言，`Mutex`、`Arc` 和 `RefCell` 之间又有什么区别？

在回答这个问题之前，让我们先看看其他语言中的指针是什么样的。在其他语言中，通常只有一到两种指针形式。比如 C 语言中的指针：

裸指针可以*自由复制*、*随意修改*、*指向任何地方*。
```c
int a = 10; 
int * p = &a; 

*p = 20; 
```

裸指针如此强大，以至于即使用户只是稍有不慎、未经深思熟虑地使用，也可能导致内存不安全。下面的例子将说明潜在的内存安全问题。
```c
// 悬垂指针
// 访问已被释放或超出作用域的内存会导致未定义行为。
#include <stdio.h>

int* create_pointer() {
    int x = 10;
    return &x; // x 是局部变量，它的生命周期在 return 后结束
}

int main() {
    int* p = create_pointer();
    printf("%d\n", *p); // 未定义行为，可能输出垃圾值或崩溃
}

// 双重释放
// 如果同一块内存被释放两次，可能导致程序崩溃或内存损坏。
#include <stdlib.h>
int main() {
    int* p = (int*)malloc(sizeof(int));
    free(p);
    free(p); // 未定义行为，双重释放
}

// 内存泄漏
// 丢失指针，导致内存无法被释放。
#include <stdlib.h>
int main() {
    int* p = (int*)malloc(sizeof(int));
    p = NULL; // 内存泄漏
}

// 释放后使用/未初始化指针
// 使用未初始化或已释放的指针访问内存。
#include <stdio.h>
int main() {
    int* p;      // 未初始化
    printf("%d\n", *p); // 未定义行为

    int* q = (int*)malloc(sizeof(int));
    free(q);
    *q = 42; // 使用已被释放的内存
}

// 缓冲区溢出
// 指向数组之外内存的指针可能会破坏其他内存。
#include <stdio.h>
int main() {
    int arr[3] = {1,2,3};
    int* p = arr;
    p[5] = 10; // 越界访问
}
```

带 GC 的语言也可以通过自动*垃圾回收*来解决这些问题，但**更简单的内存模型是以性能妥协为代价的。**

Rust 的目标是在不牺牲性能的前提下确保内存安全，因此它有一整套用于不同目的的"指针类型"。Rust 拥有一套完整的内存安全模型：**所有权**、**借用检查**、**智能指针**和**内部可变性**。
- 没有 *GC*
- 没有内存不安全
- 尽可能不把错误延迟到运行时，尽量在编译期间发现问题。

## 第二部分 裸指针与 Unsafe
Rust 也有裸指针：`*const T` 和 `*mut T`。与 C/C++ 一样，裸指针可能带来一些潜在问题（正如我们在上一部分所说的）。

> Unsafe Rust 之所以存在，是因为静态分析本质上是保守的。

当编译器试图判断代码是否维护了各项保证时，它宁愿拒绝一些有效的程序（尽管这些代码可能是没问题的），也不愿接受一些无效的程序。显然，对于编译器来说，在某些场景下判断使用裸指针是否安全是很困难的。
```rust
let mut x = 10;

let p1 = &mut x as *mut i32;
let p2 = &mut x as *mut i32;

unsafe {
    *p1 = 20;
    *p2 = 30; // 可能引发 UB
}
```

## 第三部分 Rust 的引用与借用
在介绍 Rust 的多种指针类型之前，让我们先看看 Rust 的引用（`&T`）和可变引用（`&mut T`）。这是 Rust 确保内存安全的最基础机制。

### 2.1 &T
在 C 中，类似的概念是指针：
```c
int x = 10;
int* p = &x;
printf("%d\n", *p);
```
Rust 引入了借用的概念，使用 `&T` 表示`不可变`借用。`&` 不会转移所有权，编译器在编译期检查生命周期，以确保引用不会悬垂。
```rust
fn print_string(s: &String) {
    println!("{}", s);
}

fn main() {
    let s = String::from("hello");
    print_string(&s); // 借用 s
    println!("{}", s); // s 仍然拥有所有权
}
```
设计原则：
- 避免悬垂指针：借用必须在被引用值的有效期内进行。
- 确保数据安全：编译器确保在不可变借用期间原值不能被修改。
- 零运行时开销：引用是一个*编译期概念*，不需要 GC 或运行时检查。

### 2.2 &mut T
在 C 中，指针天然拥有修改其指向内存中值的权力。最常见的问题是**数据竞争**。
```c
int x = 10;
int* p1 = &x;
int* p2 = p1;
*p1 = 20;
*p2 = 30;
printf("%d\n", *p1); // 期望 20，但得到 30
```
Rust 使用 `&mut T` 表示可变借用。编译器确保同一时间只能存在一个可变引用。
```rust
fn add_one(x: &mut i32) {
    *x += 1;
}

fn main() {
    let mut a = 10;
    add_one(&mut a);
    println!("{}", a); // 输出 11

    let mut x = 5;
    let r1 = &mut x;
    let r2 = &mut x; // 错误：不能将 `x` 同时借用为可变引用多于一次
}
```
Rust 强制实行"要么多个不可变借用，要么一个可变借用"的规则，以确保在编译期消除数据竞争。在单线程环境中，这条规则足以确保内存安全。

### 2.3 解引用
解引用（`*T`）意味着访问引用所指向的值。如果结构体已经实现了 `Deref` trait，Rust 会自动处理解引用。
```rust
fn print_str(s: &str) {
    println!("{}", s);
}

let s = String::from("hello");
print_str(&s); // 自动将 &String 解引用为 &str

// std 中 String 的 Deref 实现
#[stable(feature = "rust1", since = "1.0.0")]
impl ops::Deref for String {
    type Target = str;

    #[inline]
    fn deref(&self) -> &str {
        self.as_str()
    }
}
```

## 第四部分 Box<T>
> `Box<T>` 允许用户将数据存储在堆上而不是栈上。

`&T` 和 `&mut T` 实际上都是*借用*，这意味着它们不拥有对象的所有权。相反，对一个对象拥有完全所有权的抽象就是 `Box<T>`。
```rust
fn main() {
    let b1 = Box::new(10);
    let b2 = b1; // 移动

    // println!("{}", b1); // 编译错误
}
```

`Box<T>` 具有自动释放、唯一对象所有权和无 GC 的特点。
- 自动释放：避免双重释放
- 唯一所有权：避免释放后使用
- 无 GC：零性能开销

那么用户应该在什么时候使用 `Box` 来存储数据呢？最常用于以下情况：
- 有一个编译期无法知道大小的类型，但上下文需要确切的大小。
  对于某些递归类型，Rust 无法知道该值需要多少空间。由于 box 具有已知大小，用户可以通过在递归类型定义中插入一个 box 来启用递归类型。
  ```rust
  struct Node {
    next: Node // 编译错误
  }


  struct Node {
    next: Option<Box<Node>> // 编译成功
  }
  ```
- 转移大数据的所有权，而不是复制数据。
  ```rust
  let large = Box::new([0; 10_000_000]);
  let large_new = large; // 不是复制，而是转移
  ```
- 保存一个只知道 trait 而不确定其具体类型的值。
  ```rust
  trait Animal {
    fn speak(&self);
  }

  struct Dog;

  impl Animal for Dog {
    fn speak(&self) {
      println!("woof");
    }
  }

  fn main() {
    let a: Box<dyn Animal> = Box::new(Dog); // 不是具体类型，而是 trait
    a.speak();
  }
  ```


|     | 裸指针      | `Box<T>` |
| --- | ---------- | ------------- |
| 堆内存 | malloc/new | Box::new      |
| 释放  | 手动         | 自动 drop       |
| 所有权 | 多重所有权        | 唯一所有权         |
| 安全性 | 运行时错误       | 编译期错误        |


`Box` 之所以能够转换为裸指针，其本质在于 `Box` 是唯一拥有裸指针并实现了 Drop trait 的类型。
```rust
/// 内部模型
pub struct Box<
    T: ?Sized,
    #[unstable(feature = "allocator_api", issue = "32838")] A: Allocator = Global,
>(Unique<T>, A);

pub struct Unique<T: PointeeSized> {
    pointer: NonNull<T>,
    _marker: PhantomData<T>,
}

pub struct NonNull<T: PointeeSized> {
    pointer: *const T,
}

unsafe impl<#[may_dangle] T: ?Sized, A: Allocator> Drop for Box<T, A> {
    #[inline]
    fn drop(&mut self) {
        // Box 中的 T 在析构函数运行之前由编译器丢弃
        let ptr = self.0;
        unsafe {
            let layout = Layout::for_value_raw(ptr.as_ptr());
            if layout.size() != 0 {
                self.1.deallocate(From::from(ptr.cast()), layout);
            }
        }
    }
}


let b = Box::new(10);
let p = Box::into_raw(b); // Box -> 裸指针

let b = unsafe { Box::from_raw(p) }; // 裸指针 -> Box
```

除了 `Drop` trait 之外，另一个非常重要的 trait 是 `Deref`，这两个 trait 将在后面讨论。

## 第五部分 Rc<T>、Arc<T>、Weak<T>
为了显式地启用多重所有权，开发者需要在 Rust 中使用 `Rc<T>`（*引用计数*）。`Rc<T>` 类型跟踪某个值的引用数量，以确定该值是否仍在使用中。如果某个值的引用数为零，该值就可以被清理，而不会使任何引用失效。

最常见的场景是在链表中共享数据，如 `b -> a; c -> a;`。
```rust
enum List {
    Cons(i32, Rc<List>),
    Nil,
}

use crate::List::{Cons, Nil};
use std::rc::Rc;

fn main() {
    let a = Rc::new(Cons(5, Rc::new(Cons(10, Rc::new(Nil)))));
    let b = Cons(3, Rc::clone(&a));
    let c = Cons(4, Rc::clone(&a));
}
```

请注意，`Rc::clone` 与 `T.clone` 不同，`Rc::clone` 的实现不会像大多数类型的 clone 实现那样对所有数据进行深拷贝。调用 `Rc::clone` 只是增加引用计数，性能更好，而且*不会引起性能问题*。`Rc<T>` 只保存不可变数据，如果需要可变共享，则使用 `Rc<RefCell<T>>`。

> `Rc` 可能因循环引用而导致**内存泄漏**。在下面的例子中，`parent` 和 `child` 是循环引用。它们的引用计数永远不会为 0，从而导致内存泄漏。
```rust
use std::rc::Rc;
use std::cell::RefCell;

struct Node {
    child: Option<Rc<RefCell<Node>>>,
    parent: Option<Rc<RefCell<Node>>>,
}

fn main() {
    let parent = Rc::new(RefCell::new(Node { child: None, parent: None }));
    let child = Rc::new(RefCell::new(Node { child: None, parent: Some(Rc::clone(&parent)) }));
    parent.borrow_mut().child = Some(Rc::clone(&child));
}
```

Rust 调用 `Rc::clone` 会增加 `Rc<T>` 实例的 *strong_count*，只有当 `Rc<T>` 实例的 *strong_count* 为 0 时，该实例才会被清理。强引用是共享 `Rc<T>` 实例所有权的方式。`Weak` 引用不表达所有权关系，其计数不影响 `Rc<T>` 实例何时被清理。调用 `Rc::downgrade` 会使 weak_count 增加 1。
```rust
use std::rc::{Rc, Weak};
use std::cell::RefCell;

struct Node {
    value: i32,
    parent: RefCell<Weak<Node>>,
}

fn main() {
    let leaf = Rc::new(Node { value: 3, parent: RefCell::new(Weak::new()) });
    let parent = Rc::new(Node { value: 10, parent: RefCell::new(Weak::new()) });

    *leaf.parent.borrow_mut() = Rc::downgrade(&parent);

    println!("leaf parent upgrade: {:?}", leaf.parent.borrow().upgrade());
    println!(
        "leaf strong = {}, weak = {}",
        Rc::strong_count(&parent), // 调用 Rc::strong_count 获取 strong_count 的值
        Rc::weak_count(&parent), // 调用 Rc::weak_count 获取 weak_count 的值
    );
}
```

`Arc<T>` 是多线程下的实现。
```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(5);

    let mut handles = vec![];

    for _ in 0..3 {
        let data_clone = Arc::clone(&data);
        handles.push(thread::spawn(move || {
            println!("data = {}", data_clone);
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }
}
```

## 第六部分 Pin<T>
Rust 还有一个特殊的需求：防止数据被移动。这在自引用结构、异步 Future 和底层操作系统接口中非常常见。Rust 提供了 `Pin<T>` 来解决这个问题。

考虑这个问题场景：这里有一个结构体（SelfRef），它的一个字段指向自身另一个数据的引用，而在某个时刻 SelfRef 从堆中移出或移动到新的堆位置，于是产生了**悬垂指针**。
```rust
/// 一个字段指向另一个字段的结构体
struct SelfRef {
    data: String,
    slice: *const str, // 指向 data 的切片，当 SelfRef 移动时，会导致悬垂指针问题
}

impl SelfRef {
    fn new(s: String) -> Self {
        let slice = s.as_str();
        Self { data: s, slice }
    }
}
```

`Pin<T>` 在堆中的内存是固定的，不能被移动，适用于自引用结构体，并且必须与其他堆指针（`Box`/`Arc` 等）一起使用。
```rust
use std::pin::Pin;

struct SelfRef {
    data: String,
    slice: *const str,
}

impl SelfRef {
    fn new(s: String) -> SelfRef {
        let slice = s.as_str();
        SelfRef { data: s, slice }
    }
}

fn main() {
    let sr = SelfRef::new(String::from("hello"));

    // 将值存储到堆上并将其 pin 住
    let mut pinned = Box::pin(sr);
    let pinned_ref: Pin<&mut SelfRef> = pinned.as_mut();

    unsafe {
        println!("{}", (*pinned_ref.get_ref().slice));
    }
}
```

> `Pin` 本质上是对现有指针的语义约束，而不是改变其分配方式。它告诉编译器*禁止移动值*，编译器在类型系统中强制执行这一点。所以 `Pin` 没有额外的性能开销。

`Pin<T>` 常用于异步编程。在 Rust 异步编程中，Future 需要保持在内存中：
- 一个 `Future` 可能包含自引用状态。
- `async/await` 语法生成的状态机可能会在栈上移动。

## 第七部分 指针对照表
| 智能指针 | 线程安全           | 所有权       | 可变性                | Pin 固定               | 易循环引用                   | 典型使用场景                                               |
| ------------- | --------------------- | --------------- | ------------------------- | -------------------- | ----------------------------- | -------------------------------------------------------------- |
| `Box<T>`      | 单线程         | 唯一          | 可变（`&mut`）          | 可移动              | 否                            | 堆分配、递归类型、trait 对象、大对象 |
| `Rc<T>`       | 单线程         | 多所有权 | 不可变                 | 可移动              | 循环时可能泄漏            | 单线程共享所有权、树形结构                |
| `RefCell<T>`  | 单线程         | 借用        | 可变（运行时检查） | 可移动              | 否                            | 内部可变性，常与 `Rc<T>` 配合使用               |
| `Arc<T>`      | 多线程          | 多所有权 | 不可变                 | 可移动              | 循环时可能泄漏            | 多线程共享所有权、缓存、全局数据            |
| `Mutex<T>`    | 多线程          | 多所有权 | 可变（锁保护）  | 可移动              | 否                            | 跨线程共享可变状态                            |
| `RwLock<T>`   | 多线程          | 多所有权 | 可变（读写锁） | 可移动              | 否                            | 读多写少的共享可变状态       |
| `Weak<T>`     | 单/多线程 | 非拥有      | 不可变                 | 可移动              | 否                            | 打破循环引用（`Rc`/`Arc` 配合 Weak）               |
| `Pin<Box<T>>` | 单线程         | 唯一          | 可变                   | 固定（不可移动） | 否                            | 自引用结构体、异步 `Future`、堆固定数据      |
| `Pin<Rc<T>>`  | 单线程         | 多所有权 | 不可变                 | 固定               | 必须用 Weak 避免循环 | 共享自引用结构体（单线程）             |
| `Pin<Arc<T>>` | 多线程          | 多所有权 | 不可变                 | 固定               | 必须用 Weak 避免循环 | 共享自引用结构体（多线程）              |

> - 可变性：是否可以通过指针修改内部值
> - Pin 固定：是否禁止移动
> - 易循环引用：是否会导致内存泄漏？

**使用建议**：
1. 单线程场景
  唯一所有权 → `Box<T>`
  多所有权、不可变 → `Rc<T>`
  多所有权且可变 → `Rc<RefCell<T>>`
  自引用结构 → `Pin<Box<T>>` 或 `Pin<Rc<T>>`
2. 多线程场景
  唯一所有权且可变 → `Box<T>`（跨线程传递需要 Send）
  多所有权、不可变 → `Arc<T>`
  多所有权且可变 → `Arc<Mutex<T>>` 或 `Arc<RwLock<T>>`
  自引用结构 → `Pin<Arc<T>>`
3. 循环引用
  单线程 → `Rc<T>` + `Weak<T>`
  多线程 → `Arc<T>` + `Weak<T>`
4. 异步/自引用结构
  Future/异步状态机 → `Pin<Box<dyn Future<...>>>`
  自引用结构（树、链表） → `Pin<Box<T>>` 或 `Pin<Rc<T>>`

链接：
- [Rust std API](https://doc.rust-lang.org/stable/std/index.html)
- [Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)