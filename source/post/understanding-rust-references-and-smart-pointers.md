---
title: Understanding Rust References and Smart Pointers
category: Tech
tag: Rust
date: 2026-03-27T12:56:04+08:00
---


## Part 1 Why Rust Has Types of Pointers?
It's really confused for Rust beginer: Why Rust has so many types pointers?
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

Pointer is a very very powerful tool which can arbitrarily control and modify memory. 

Sometimes the developers have to use *pointer-combo* like Russian nesting dolls, forming strange shapes nested within each other, almost like a wizard's scribbles, such as `Arc<Mutex<Vec<Rc<RefCell<T>>>>>` in a binary tree. So what's the difference between `&T` and `Box<T>`? Or for concurrency safety, how is the difference between `Mutex`, `Arc` and `RefCell`?

Before answer this question, let's see how is the pointers like in other languages. In other languages, there are usually only one or two pointer forms. Like pointers in C language:

Raw pointers can be *copy freely*, *modified at will* and *point to anywhere*. 
```c
int a = 10; 
int * p = &a; 

*p = 20; 
```

Raw pointers are so powerful that even small, unconsidered use by the user can lead to memory insecurity. The follow examples will illustrate the potential memory safety issues.
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

Also gc languages can solve these problems with auto *garbage collect*, but **a simpler memory model comes at the cost of performance compromises.**

Rust aims to ensure memory safety without compromising performance, so there is a whole set of "pointer types" for different purposes. Rust has a whole memory safety model: **Ownership**, **Borrowing Check**, **Smart Pointer** and **Interior Mutability**.
- No *gc*
- No memory unsafety
- No delay mistakes to runtime as more as possible, try to find problems during compilation.

## Part 2 Raw Pointers and Unsafe
Rust also has raw pointers: `*const T` and `*mut T`. Same as c/cpp, raw pointers could can bring some potential problems (like we said in prev part).

> Unsafe Rust exists because, by nature, static analysis is conservative.

When the compiler tries to determine whether or not code upholds the guarantees, it’s better for it to reject some valid programs (although the code might be okay) than to accept some invalid programs. Clearly, for compilers, it is difficult to determine whether using raw pointers is safe in some scenarios.
```rust
let mut x = 10;

let p1 = &mut x as *mut i32;
let p2 = &mut x as *mut i32;

unsafe {
    *p1 = 20;
    *p2 = 30; // maybe incur UB
}
```

## Part 3 Rust References and Borrowing
Before introduce Rust's multiple pointer types, let us see Rust's referencing (`&T`) and mutable references (`&mut T`). This is Rust's most fundamental mechanism for ensuring memory safety.

### 2.1 &T
In C, a similar concept is the pointer:
```c
int x = 10;
int* p = &x;
printf("%d\n", *p);
```
Rust introduced the concept of borrowing, using `&T` which indicates an `immutable` borrow. `&` do not transfer ownership and compiler checks lifetimes at compile time to ensure that references are not dangling.
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
Design principles:
- Avoid hanging pointers: Borrowing must be done within the validity period of the referenced value.
- Ensure data security: The compiler ensures that the original value cannot be modified during the immutable borrowing period.
- Zero runtime overhead: References are a *compile-time concept* and do not require GC or runtime checks.

### 2.2 &mut T
In C, pointers naturally have the power to modify the value they point to in memory. The most common problem is **data race**.
```c
int x = 10;
int* p1 = &x;
int* p2 = p1;
*p1 = 20;
*p2 = 30;
printf("%d\n", *p1); // expect 20, but get 30
```
Rust uses `&mut T` that indicates variable borrowing. Compiler make sure only one mutable reference can exist at a time.
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
Rust enforces "either multiple immutable borrows or one mutable borrow" to ensure that data races are eliminated at compile time. In a single-threaded environment, this rule is sufficient to ensure memory safety.

### 2.3 Dereference
Dereference (`*T`) means accessing the value pointed to by the reference. If the struct already implements the `Deref` trait, Rust will automatic processing dereference.
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

## Part 4 Box<T>
> `Box<T>` allow user to store data on the heap rather than the stack.

`&T` and `&mut T` actually are *borrowing*, that means they dont have the objects' ownership. Conversely, the abstraction of having complete ownership of an object is `Box<T>`. 
```rust
fn main() {
    let b1 = Box::new(10);
    let b2 = b1; // move

    // println!("{}", b1); // compile err
}
```

`Box<T>` have the characteristics of automatic release, unique object ownership, and no gc.
- automatic release: avoid double free
- unique ownership: avoid use-after-free
- no gc: zero performance overhead 

So when user should use `Box` to store data? Use them most often in these situations:
- have a type whose size can’t be known at compile time but context need an exact size.
  For some recursive type, Rust can’t know how much space the value needs. Because boxes have a known size, user can enable recursive types by inserting a box in the recursive type definition.
  ```rust
  struct Node {
    next: Node // compile err 
  }


  struct Node {
    next: Option<Box<Node>> // compile success
  }
  ```
- transfer ownership of large data rather than copy data.
  ```rust
  let large = Box::new([0; 10_000_000]);
  let large_new = large; // not copy, but transfer
  ```
- keep a value that only kown trait but not sure its specific type.
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


The essence of why a `Box` can be converted to a raw pointer is that a `Box` is the only one that owns a raw pointer and implements the Drop trait.
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

Beyond trait `Drop`, another very important trait is `Deref`, this two trait will be talk later.

## Part 5 Rc<T>, Arc<T>, Weak<T>
For enable multiple ownership explicitly, developers need use `Rc<T>` (*reference counting*) in Rust. The `Rc<T>` type keeps track of the number of references to a value to determine whether or not the value is still in use. If there are zero references to a value, the value can be cleaned up without any references becoming invalid.

The most common scene is sharing data in a chain list as `b -> a; c -> a;`.
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

Notice that, `Rc::clone` is not same with `T.clone`, the implementation of `Rc::clone` doesn’t make a deep copy of all the data like most types’ implementations of clone do. The call to `Rc::clone` only increments the reference count, which has a better performance and *not cause performance problems*. `Rc<T>` only keep immutable data, if need mutable share then use `Rc<RefCell<T>>`.

> `Rc` can cause a **memory leak** by recursive reference. In the follow case, `parent` and `child` are recursive references. Both them reference count never be 0, cause a memory leak.
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

Rust calling `Rc::clone` increases the *strong_count* of an `Rc<T>` instance, and an `Rc<T>` instance is only cleaned up if its *strong_count* is 0. Strong references are how you can share ownership of an `Rc<T>` instance. `Weak` references don’t express an ownership relationship, and their count doesn’t affect when an `Rc<T>` instance is cleaned up. Calling the `Rc::downgrade` increases the weak_count by 1.
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

`Arc<T>` is the implementation under multithreading.
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

## Part 6 Pin<T>
Rust also has a special requirement: preventing data from being moved. This is very common in self-referential structures, asynchronous Futures, and low-level operating system interfaces. Rust provides `Pin<T>` to solve this problem.

Consider the problem scene: here has a struct (SelfRef) and its one field point to self another data's reference, and in some point SelfRef move out heap or a new heap position, then there is a **dangling pointer**.
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

`Pin<T>` on the heap are fixed in memory and cannot be moved, suitable for self-referential struct and must use with other heap pointers (`Box`/`Arc` etc.).
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

> `Pin` is essentially a semantic constraint on an existing pointer, not a change in how it is allocated. It tells the compiler to *prohibit moving values* and the compiler enforces this in the type system. So `Pin` has no extra performance cost.

`Pin<T>` is often used in asynchronous programming. In Rust asynchronous programming, Futures need to be kept in memory:
- A `Future` may contain self-referential state.
- The state machine generated by the `async/await` syntax may move on the stack.

## Part 7 Pointer Table
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

> - Mutability: Whether the internal value can be modified through a pointer
> - Pinned: Whether movement is prohibited
> - Cycle-prone: Cause memory leaks?

**Usage Recommendations**:
1. Single-threaded scenario
  Sole ownership → `Box<T>`
  Multiple owners, immutable → `Rc<T>`
  Multiple owners can change → `Rc<RefCell<T>>`
  Self-referencing structure → `Pin<Box<T>>` or `Pin<Rc<T>>`
2. Multithreaded scenarios
  Sole ownership can change → `Box<T>`(Send is required for cross-thread communication)
  Multiple owners, immutable → `Arc<T>`
  Multiple owners can change → `Arc<Mutex<T>>` or `Arc<RwLock<T>>`
  Self-referencing structure → `Pin<Arc<T>>`
3. Circular references
  Single thread → `Rc<T>` + `Weak<T>`
  Multithreading → `Arc<T>` + `Weak<T>`
4. Asynchronous/Self-referencing structures
  Future/Async State Machine → `Pin<Box<dyn Future<...>>>`
  Self-referencing structures (trees, linked lists) → `Pin<Box<T>>` or `Pin<Rc<T>>`

Links:
- [Rust std API](https://doc.rust-lang.org/stable/std/index.html)
- [Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)
