---
title: 理解 Rust 的引用与智能指针
category: Tech
tag: Rust
date: 2026-03-27T12:56:04+08:00
---


## 第一部分 为什么 Rust 有多种指针类型？
对于 Rust 初学者来说，这件事真的很令人困惑：为什么 Rust 有这么多指针类型？
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

指针是一种非常非常强大的工具，可以任意控制和修改内存。

有时开发者不得不像俄罗斯套娃一样使用*指针组合*，形成彼此嵌套的奇怪形状，几乎就像巫师的涂鸦，比如二叉树中的 `Arc<Mutex<Vec<Rc<RefCell<T>>>>>`。那么 `&T` 和 `Box<T>` 有什么区别？或者出于并发安全的考虑，`Mutex`、`Arc` 和 `RefCell` 之间又有什么差异？

在回答这个问题之前，让我们看看其他语言中的指针是什么样的。在其他语言中，通常只有一两种指针形式。比如 C 语言中的指针：

裸指针可以*自由复制*、*随意修改*并*指向任何地方*。
```c
int a = 10; 
int * p = &a; 

*p = 20; 
```

裸指针如此强大，以至于用户哪怕只是微小、欠考虑地使用，也可能导致内存不安全。下面的例子将说明潜在的内存安全问题。
```c
// Dangling Pointer
// Accessing memory that has been freed or is out of scope will result in undefined behavior.
#include <stdio.h>

int* create_pointer() {
    int x = 10;
    return &x; // x is a local variable, its lifetime ends after return
}

int main() {
    int* p = create_pointer();
    printf("%d\n", *p); // Undefined behavior, may output garbage values or crash
}

// Double Free
// If the same memory block is freed twice, it can cause the program to crash or the memory to become corrupted.
#include <stdlib.h>
int main() {
    int* p = (int*)malloc(sizeof(int));
    free(p);
    free(p); // Undefined behavior, double free
}

// Memory Leak
// Lost pointer so that memory cannot be free.
#include <stdlib.h>
int main() {
    int* p = (int*)malloc(sizeof(int));
    p = NULL; // memory leak
}

// Use After Free/Uninitialized Pointer
// Access memory using an uninitialized or already freed pointer.
#include <stdio.h>
int main() {
    int* p;      // uninit
    printf("%d\n", *p); // Undefined behavior

    int* q = (int*)malloc(sizeof(int));
    free(q);
    *q = 42; // use memory which has be freed
}

// Buffer Overflow
// Pointers pointing to memory outside the array can corrupt other memory.
#include <stdio.h>
int main() {
    int arr[3] = {1,2,3};
    int* p = arr;
    p[5] = 10; // out-of-bounds access
}
```

带 GC 的语言也可以通过自动*垃圾回收*解决这些问题，但**更简单的内存模型是以牺牲性能为代价的。**

Rust 的目标是在不牺牲性能的前提下确保内存安全，因此它有一整套用于不同目的的“指针类型”。Rust 拥有一整套内存安全模型：**所有权**、**借用检查**、**智能指针**和**内部可变性**。
- 无需 *GC*
- 没有内存不安全
- 尽可能不把错误推迟到运行时，尽量在编译期发现问题。

## 第二部分 裸指针与 Unsafe
Rust 也有裸指针：`*const T` 和 `*mut T`。与 C/C++ 一样，裸指针可能带来一些潜在问题（就像我们在上一部分所说的那样）。

> Unsafe Rust 之所以存在，是因为静态分析从本质上来说是保守的。

当编译器试图判断代码是否遵守这些保证时，拒绝一些有效的程序（尽管代码可能是没问题的）总比接受一些无效程序更好。显然，对于编译器来说，在某些场景下判断使用裸指针是否安全是很困难的。
```rust
let mut x = 10;

let p1 = &mut x as *mut i32;
let p2 = &mut x as *mut i32;

unsafe {
    *p1 = 20;
    *p2 = 30; // maybe incur UB
}
```

## 第三部分 Rust 的引用与借用
在介绍 Rust 的多种指针类型之前，让我们先看看 Rust 的引用（`&T`）和可变引用（`&mut T`）。这是 Rust 确保内存安全的最基本机制。

### 2.1 &T
在 C 中，类似的概念是指针：
```c
int x = 10;
int* p = &x;
printf("%d\n", *p);
```
Rust 引入了借用的概念，使用 `&T` 表示一种 `不可变` 借用。`&` 不会转移所有权，编译器会在编译期检查生命周期，以确保引用不会悬垂。
```rust
fn print_string(s: &String) {
    println!("{}", s);
}

fn main() {
    let s = String::from("hello");
    print_string(&s); // borrow s
    println!("{}", s); // s still have the ownership
}
```
设计原则：
- 避免悬垂指针：借用必须发生在被引用值的有效期内。
- 确保数据安全：编译器确保在不可变借用期间原始值不能被修改。
- 零运行时开销：引用是一种*编译期概念*，不需要 GC 或运行时检查。

### 2.2 &mut T
在 C 中，指针天生拥有修改其指向内存中值的权力。最常见的问题是**数据竞争**。
```c
int x = 10;
int* p1 = &x;
int* p2 = p1;
*p1 = 20;
*p2 = 30;
printf("%d\n", *p1); // expect 20, but get 30
```
Rust 使用 `&mut T` 表示可变借用。编译器确保同一时间只能存在一个可变引用。
```rust
fn add_one(x: &mut i32) {
    *x += 1;
}

fn main() {
    let mut a = 10;
    add_one(&mut a);
    println!("{}", a); // output 11

    let mut x = 5;
    let r1 = &mut x;
    let r2 = &mut x; // error: cannot borrow `x` as mutable more than once at a time
}
```
Rust 强制遵循“要么多个不可变借用，要么一个可变借用”的规则，以确保在编译期消除数据竞争。在单线程环境中，这条规则足以确保内存安全。

### 2.3 解引用
解引用（`*T`）意味着访问引用所指向的值。如果结构体已经实现了 `Deref` trait，Rust 会自动处理解引用。
```rust
fn print_str(s: &str) {
    println!("{}", s);
}

let s = String::from("hello");
print_str(&s); // auto turn &String deref to &str

// Deref impl for String in std
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

`&T` 和 `&mut T` 实际上都是*借用*，这意味着它们并不拥有对象的所有权。相反，完全拥有某个对象所有权的抽象就是 `Box<T>`。
```rust
fn main() {
    let b1 = Box::new(10);
    let b2 = b1; // move

    // println!("{}", b1); // compile err
}
```

`Box<T>` 具有自动释放、唯一的对象所有权以及无 GC 的特性。
- 自动释放：避免双重释放
- 唯一所有权：避免释放后使用
- 无 GC：零性能开销

那么用户应该在什么时候使用 `Box` 来存储数据呢？最常见的使用场景是：
- 拥有一个在编译期无法知道大小的类型，但上下文需要确切的大小。
  对于某些递归类型，Rust 无法知道该值需要多少空间。因为 box 具有已知大小，用户可以通过在递归类型定义中插入一个 box 来启用递归类型。
  ```rust
  struct Node {
    next: Node // compile err 
  }


  struct Node {
    next: Option<Box<Node>> // compile success
  }
  ```
- 转移大数据的所有权，而不是复制数据。
  ```rust
  let large = Box::new([0; 10_000_000]);
  let large_new = large; // not copy, but transfer
  ```
- 保存一个只知道 trait 而不知道其具体类型的值。
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
    let a: Box<dyn Animal> = Box::new(Dog); // not specific type, but trait
    a.speak();
  }
  ```


|     | raw pointers      | `Box<T>` |
| --- | ---------- | ------------- |
| heap memory | malloc/new | Box::new      |
| release  | handly         | automatic drop       |
| ownership | multiple ownership        | unique ownership         |
| safety | runtime error       | compile-time error        |


`Box` 之所以能够转换为裸指针，其本质在于 `Box` 是唯一一个拥有裸指针并实现了 Drop trait 的类型。
```rust
/// internal model
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
        // the T in the Box is dropped by the compiler before the destructor is run
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
let p = Box::into_raw(b); // Box -> raw pointers

let b = unsafe { Box::from_raw(p) }; // raw pointers -> Box
```

除了 trait `Drop` 之外，另一个非常重要的 trait 是 `Deref`，这两个 trait 稍后会讨论。

## 第五部分 Rc<T>、Arc<T>、Weak<T>
为了显式地启用多重所有权，开发者需要在 Rust 中使用 `Rc<T>`（*引用计数*）。`Rc<T>` 类型会跟踪某个值的引用数量，以确定该值是否仍在使用中。如果某个值的引用数为零，该值就可以被清理，而不会使任何引用变为无效。

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

注意，`Rc::clone` 与 `T.clone` 不同，`Rc::clone` 的实现不会像大多数类型的 clone 实现那样对所有数据进行深拷贝。调用 `Rc::clone` 只会增加引用计数，这具有更好的性能，并且*不会引起性能问题*。`Rc<T>` 只保存不可变数据，如果需要可变共享，则使用 `Rc<RefCell<T>>`。

> `Rc` 可能因递归引用而导致**内存泄漏**。在下面的例子中，`parent` 和 `child` 是递归引用。它们的引用计数永远不会变为 0，从而导致内存泄漏。
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

Rust 调用 `Rc::clone` 会增加 `Rc<T>` 实例的 *strong_count*，而 `Rc<T>` 实例只有在它的 *strong_count* 为 0 时才会被清理。强引用是共享 `Rc<T>` 实例所有权的方式。`Weak` 引用不表达所有权关系，它们的计数不会影响 `Rc<T>` 实例何时被清理。调用 `Rc::downgrade` 会将 weak_count 增加 1。
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
        Rc::strong_count(&parent), // call Rc::strong_count to get strong_count value
        Rc::weak_count(&parent), // call Rc::weak_count to get weak_count value
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
Rust 还有一个特殊需求：防止数据被移动。这在自引用结构、异步 Future 以及底层操作系统接口中非常常见。Rust 提供了 `Pin<T>` 来解决这个问题。

考虑这个问题场景：这里有一个结构体（SelfRef），它的一个字段指向自身另一个数据的引用，而在某个时刻 SelfRef 被移出堆或移动到新的堆位置，那么就会出现**悬垂指针**。
```rust
/// struct which one field point to other field
struct SelfRef {
    data: String,
    slice: *const str, // point to data's slice, when SelfRef moving, cause dangling pointer problem
}

impl SelfRef {
    fn new(s: String) -> Self {
        let slice = s.as_str();
        Self { data: s, slice }
    }
}
```

`Pin<T>` 在堆上的数据固定在内存中且无法移动，适用于自引用结构体，并且必须与其他堆指针（`Box`/`Arc` 等）一起使用。
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

    // store value to heap and pin it
    let mut pinned = Box::pin(sr);
    let pinned_ref: Pin<&mut SelfRef> = pinned.as_mut();

    unsafe {
        println!("{}", (*pinned_ref.get_ref().slice));
    }
}
```

> `Pin` 本质上是对现有指针的一种语义约束，而不是改变其分配方式。它告诉编译器*禁止移动值*，编译器在类型系统中强制执行这一点。因此 `Pin` 没有额外的性能成本。

`Pin<T>` 常用于异步编程。在 Rust 异步编程中，Future 需要保持在内存中：
- 一个 `Future` 可能包含自引用状态。
- 由 `async/await` 语法生成的状态机可能在栈上移动。

## 第七部分 指针对照表
| Smart Pointer | Thread-safe           | Ownership       | Mutability                | Pinned               | Cycle-prone                   | Typical Use Case                                               |
| ------------- | --------------------- | --------------- | ------------------------- | -------------------- | ----------------------------- | -------------------------------------------------------------- |
| `Box<T>`      | Single-thread         | Unique          | Mutable (`&mut`)          | Movable              | No                            | Heap allocation, recursive types, trait objects, large objects |
| `Rc<T>`       | Single-thread         | Multiple owners | Immutable                 | Movable              | May leak if cycles            | Single-thread shared ownership, tree structures                |
| `RefCell<T>`  | Single-thread         | Borrowed        | Mutable (runtime checked) | Movable              | No                            | Interior mutability, often combined with `Rc<T>`               |
| `Arc<T>`      | Multi-thread          | Multiple owners | Immutable                 | Movable              | May leak if cycles            | Multi-thread shared ownership, caching, global data            |
| `Mutex<T>`    | Multi-thread          | Multiple owners | Mutable (lock-protected)  | Movable              | No                            | Shared mutable state across threads                            |
| `RwLock<T>`   | Multi-thread          | Multiple owners | Mutable (read/write lock) | Movable              | No                            | Shared mutable state with frequent reads and rare writes       |
| `Weak<T>`     | Single / Multi-thread | Non-owning      | Immutable                 | Movable              | No                            | Breaking reference cycles (`Rc`/`Arc` with Weak)               |
| `Pin<Box<T>>` | Single-thread         | Unique          | Mutable                   | Pinned (not movable) | No                            | Self-referential structs, async `Future`, heap-fixed data      |
| `Pin<Rc<T>>`  | Single-thread         | Multiple owners | Immutable                 | Pinned               | Must use Weak to avoid cycles | Shared self-referential structures (single-thread)             |
| `Pin<Arc<T>>` | Multi-thread          | Multiple owners | Immutable                 | Pinned               | Must use Weak to avoid cycles | Shared self-referential structures (multi-thread)              |

> - Mutability：是否可以通过指针修改内部值
> - Pinned：是否禁止移动
> - Cycle-prone：是否会导致内存泄漏？

**使用建议**：
1. 单线程场景
  独占所有权 → `Box<T>`
  多所有者、不可变 → `Rc<T>`
  多所有者且可变 → `Rc<RefCell<T>>`
  自引用结构 → `Pin<Box<T>>` 或 `Pin<Rc<T>>`
2. 多线程场景
  独占所有权且可变 → `Box<T>`（跨线程通信需要 Send）
  多所有者、不可变 → `Arc<T>`
  多所有者且可变 → `Arc<Mutex<T>>` 或 `Arc<RwLock<T>>`
  自引用结构 → `Pin<Arc<T>>`
3. 循环引用
  单线程 → `Rc<T>` + `Weak<T>`
  多线程 → `Arc<T>` + `Weak<T>`
4. 异步/自引用结构
  Future/异步状态机 → `Pin<Box<dyn Future<...>>>`
  自引用结构（树、链表）→ `Pin<Box<T>>` 或 `Pin<Rc<T>>`

链接：
- [Rust std API](https://doc.rust-lang.org/stable/std/index.html)
- [Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)