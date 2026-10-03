---
title: Access Rust 2
category: Tech
tag: Rust
date: 2025-06-16T00:27:12+08:00
---


# AccessRust-2
## Part 10 Tests
To change a function into a test function, add `#[test]` on the line before `fn`. Checking results with the `assert!`/`assert_eq!`/`assert_ne!` macro.
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

`#[should_panic]` tags test passes if the code inside the function panic, test fails if the code inside the function doesn't panic.
Default `cargo test` run tests in mutil-threads, set thread number with `cargo test -- --test-threads=[num]`.
Use `cargo test -- --show-output` display passed test output. `cargo test [str]` run the specify test that name contains [str]. `#[ignore]` show that the test will be ignore when run `cargo test` but will run in `cargo test -- --ignored`

`#[cfg]` stands for *configuration* and marks the following item should only be included given a certain configuration option. As `#[cfg(test)]` block only be included by `cargo test`.


## Part 11 Functional Language Features
closure: anonymous function
For closure definitions, the compiler will infer one concrete type for each of their parameters and for their return value.
```rust
let example_closure = |x| x;

let s = example_closure(String::from("hello")); // infer type of x is String
let n = example_closure(5); // expect String, get whole number, panic here
```

Even though the closure body still only needs an immutable reference, we need to specify that `list` should be moved into the closure by putting the `move` keyword at the beginning of the closure definition. The new thread might finish before the rest of the main thread finishes, or the main thread might finish first. If the main thread maintained ownership of list but ended before the new thread did and dropped list, the immutable reference in the thread would be invalid.
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

Traits of closure:
- `FnOnce`: A closure that moves captured values out of its body will only implement `FnOnce` and none of the other `Fn` traits, because it can only be called once. All closures implement at least this trait. 
- `FnMut`: Don’t move captured values out of their body, but that might mutate the captured values.
- `Fn`: Don’t move captured values out of their body and that don’t mutate captured values, as well as closures that capture nothing from their environment.

## Part 12 Cargo
### 12.1 Build
`cargo build`: build in *dev* profile
`cargo build --release`: build in *release* profile

Use `opt-level` controls the number of optimizations Rust will apply to your code, with a range of 0 to 3, high level(3) will cost more time to compile code, and get a more faster product:
```rust
[profile.dev]
opt-level = 0

[profile.release]
opt-level = 3
```

### 12.2 Add doc and publish crate
`cargo doc` generate doc of project(Documentation comments use three slashes, `///`), and `cargo doc --open` will open the generated index.html in browser(If open in wsl, ensure `wslview` has been installed).

Re-export items to make a public structure that’s different from your private structure by using `pub use`.

1. Create an API token in [crates.io](https://crates.io) and login in cmd with `cargo login`
2. Set crate info about *description, license, license-file, documentation, homepage or repository*, and then publish crate with `cargo publish`
3. cargo do not allow delete any versions that have been published. But can mark version as deprecated with `cargo yank --vers [x.x.x]`. A yank means that all projects with a *Cargo.lock* will not break, and any future *Cargo.lock* files generated will not use the yanked version. By adding --undo to the command, you can also undo a yank and allow projects to start depending on a version again, like `cargo yank --vers [x.x.x] --undo`

### 12.3 Use workspace
Move into workspace dir and create `Cargo.toml` with:
```rust
[workspace]
resolver = "3"
```
Then use `cargo new` create the binary crate. The workspace has one target directory at the top level that the compiled artifacts will be placed into.

Cargo doesn’t assume that crates in a workspace will depend on each other, so we need to be explicit about the dependency relationships.
```rust
[dependencies]
add_one = { path = "../add_one" }
```

By `-p [crate_name]` specify which package in the workspace we want to run. Notice that the workspace has only one Cargo.lock file at the top level, rather than having a Cargo.lock in each crate’s directory. This ensures that all crates are using the same version of all dependencies.

### 12.4 Install binary from crates.io
`cargo install` install binary(the runnable program that is created if the crate has a src/main.rs file or another file specified as a binary, as opposed to a library target that isn’t runnable on its own but is suitable for including within other programs) locally.
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
### 12.5 Extend cargo with custom commands
Cargo is designed so you can extend it with new subcommands without having to modify it. If a binary in your $PATH is named cargo-something, you can run it as if it were a Cargo subcommand by running `cargo something`. Custom commands like this are also listed when you run `cargo --list`. Being able to use cargo install to install extensions and then run them just like the built-in.

## Part 13 Smart Pointers
Smart poniters implement the `Deref` and `Drop` traits.
- `Deref`: allows an instance of the smart pointer struct to behave like a reference
- `Drop`: allows you to customize the code that’s run when an instance of the smart pointer goes out of scope

Some smart pointers in `std`:
- `Box<T>`: for allocating values on the heap
- `Rc<T>`: a reference counting type that enables multiple ownership
- `Ref<T>`/`RefMut<T>`: accessed through `RefCell<T>`, a type that enforces the borrowing rules at runtime instead of compile time

### 13.1 Box<T>
`Box<T>` allow store data on the heap rather than the stack, only store the pointer on the stack.
Use `Box<T>` most often in these situations:
- When you have a type whose size can’t be known at compile time and you want to use a value of that type in a context that requires an exact size: like turn *recursive type* to *non-recursive type*<sup>[1]</sup>
- When you have a large amount of data and you want to transfer ownership but ensure the data won’t be copied when you do so
- When you want to own a value and you care only that it’s a type that implements a particular trait rather than being of a specific type

### 13.2 Deref/Drop trait
Implementing the Deref trait allows you to customize the behavior of the *dereference operator* `*`. When we entered `*y`, behind the Rust actually ran `*(y.deref())`.

Rust automatically called `drop` when instances went out of scope.

### 13.3 Rc<T>
Rc: *reference counting*
If there are zero references to a value, the value can be cleaned up without any references becoming invalid.

The implementation of `Rc::clone` doesn’t make a deep copy of all the data like most types’ implementations of `clone` do. The call to `Rc::clone` only increments the reference count.

### 13.4 RefCell<T>
RefCell: allow mutate an immutable value by *Interior mutability*.
Note that `RefCell<T>` does not work for multithreaded code! `Mutex<T>` is the thread-safe version of `RefCell<T>`.

### 13.5 Leak memory
If you have `RefCell<T>` values that contain `Rc<T>` values or similar nested combinations of types with interior mutability and reference counting, you must ensure that you don’t create cycles; you can’t rely on Rust to catch them. Creating a reference cycle would be a logic bug in your program that you should use automated tests, code reviews, and other software development practices to minimize.
Another solution for avoiding reference cycles is reorganizing data structures like use weak reference not strong reference. Weak references don’t express an ownership relationship, and their count doesn’t affect when an `Rc<T>` instance is cleaned up. They won’t cause a reference cycle because any cycle involving some weak references will be broken once the strong reference count of values involved is 0.
Because the value that `Weak<T>` references might have been dropped, to do anything with the value that a `Weak<T>` is pointing to you must make sure the value still exists. Do this by calling the `upgrade` method on a `Weak<T>` instance, which will return an `Option<Rc<T>>`.

An example about tree node that won't cause a reference cycle:
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

## Part 14 Concurrency
By leveraging ownership and type checking, many concurrency errors are compile-time errors in Rust rather than runtime errors.

The Rust standard library uses a 1:1 model of thread implementation, whereby a program uses one operating system thread per one language thread.

### 14.1 Channel
The `mpsc::channel` function(mpsc: *multiple producer, single consumer*) returns a tuple, the first element of which is the sending end—the transmitter—and the second element of which is the receiving end—the receiver.
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

// output
// Got: hi
// Got: more
// Got: from
// Got: messages
// Got: for
// Got: the
// Got: thread
// Got: you
```

### 14.2 Shared-state concurrency
Channels are similar to single ownership, once transfer a value down a channel then there should not have any change on the value.
Shared-memory concurrency is like multiple ownership: multiple threads can access the same memory location at the same time.

`Mutex<T>` is a smart pointer. The call to lock returns a smart pointer called `MutexGuard`, wrapped in a `LockResult` that we handled with the call to unwrap. The `MutexGuard` smart pointer implements `Deref` to point at our inner data; the smart pointer also has a `Drop` implementation that releases the lock automatically when a `MutexGuard` goes out of scope, which happens at the end of the inner scope.
`Mutex<T>` is immutable but we could get a mutable reference to the value inside it, `Mutex<T>` provides interior mutability, as the `Cell` family does.
```rust
use std::sync::Mutex;

fn main() {
    let m = Mutex::new(5);

    {
        let mut num = m.lock().unwrap();
        *num = 6; // deref by *
    } // release lock automatically 

    println!("m = {m:?}");
}
```

Use `Arc<T>` ensure safe to share across threads safty not `Rc<T>`.
```rust
/// share a value between multiple threads using Mutex<T>
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

### 14.3 Extensible concurrency
Handling concurrency are not limited to the language or the standard library. Among the key concurrency concepts that are embedded in the language rather than the standard library are the `std::marker` traits `Send` and `Sync`<sup>[2]</sup>.
- `Send`: indicates that ownership of values of the type implementing `Send` can be transferred between threads. Any type composed entirely of `Send` types is automatically marked as `Send` as well.
- `Sync`: indicates that it is safe for the type implementing `Sync` to be referenced from multiple threads. Types composed entirely of types that implement `Sync` also implement `Sync`.

## Part 15 Asynchronous Programming
`await`: postfix keyword, easy to make chains of methods.
```rust
let response_text = trpl::get(url).await.text().await;
```

When Rust sees a block marked with the `async` keyword, it compiles it into a unique, anonymous data type that implements the `Future` trait. When Rust sees a function marked with `async`, it compiles it into a non-async function whose body is an async block. An async function’s return type is the type of the anonymous data type the compiler creates for that async block.
```rust
// source
use trpl::Html;

async fn page_title(url: &str) -> Option<String> {
    let response = trpl::get(url).await;
    let text = response.text().await;
    Html::parse(&text)
        .select_first("title")
        .map(|title| title.inner_html())
}

// compile
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

For each *`await`* point, represents a place where control is handed back to the runtime. Rust has an invisible state machine, and compiler ensure safty between adjacent states.

`Future`: when see code that uses `await`, Rust compiles it under the hood to code that calls `poll` in a special `loop`. Rust makes sure that the `loop` can hand off control to something that can pause work on this future to work on other futures and then check this one again later.
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

`Pin`/`Unpin`: 
For those object which maybe have self-referential data type(By default, any object that has a reference to itself is unsafe to move).
![The unsafe result of moving a self-referential data type](https://doc.rust-lang.org/book/img/trpl17-05.svg)

When pin a value by wrapping a pointer to that value in `Pin`, it can no longer move. Thus, for `Pin<Box<SomeType>>`, runtime actually pin the `SomeType` value(store in heap), not the `Box` pointer.
![Moving a `Box` which points to a self-referential future type.](https://doc.rust-lang.org/book/img/trpl17-07.svg)

`Unpin` is a marker trait, similar to the `Send` and `Sync` traits(the compiler implements `Unpin` automatically for all types where it can prove it is safe). Marker traits exist only to tell the compiler it’s safe to use the type implementing a given trait in a particular context. `Unpin` informs the compiler that a given type does not need to uphold any guarantees about whether the value in question can be safely moved.

`Stream`: To represent a sequence of items that become ready over time, then define a `Stream` trait that puts those features together.
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

More implement detail about `Future`/`Pin`/`Stream` trait in [A Closer Look at the Traits for Async](https://doc.rust-lang.org/book/ch17-05-traits-for-async.html).


## Part 16 Pattern and Match
### 16.1 All pattern
1. `match`: `match` expressions need to be *exhaustive*, all possibilities for the value in the `match` expression must be accounted for.
   ```rust
    match x {
        None => None,
        Some(i) => Some(i + 1),
    }
    ```
2. `if let`: compiler doesn't check for exhaustiveness.
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
3. `while let`:
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
4. `for`:
   ```rust
    let v = vec!['a', 'b', 'c'];

    for (index, value) in v.iter().enumerate() {
        println!("{value} is at index {index}");
    }
   ```

### 16.2 Refutability
Patterns come in two forms: refutable and irrefutable. Patterns that will match for any possible value passed are irrefutable.
```rust
let x = 5; // irrefutable: x can match any value

let Some(x) = a_value; // refutable: if a_value is None, then match failed
```
Function parameters, `let` statements, and `for` loops can only accept irrefutable patterns.
The `if let` and while `let` expressions and the `let...else` statement accept refutable and irrefutable patterns.

More pattern syntax see [Pattern Syntax](https://doc.rust-lang.org/book/ch19-03-pattern-syntax.html).

## Part 17 Advanced Features
### 17.1 unsafe
`unsafe` offer superpowers include the ability to<sup>[3]</sup>:
- Dereference a raw pointer
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
- Call an unsafe function or method
  ```rust
    unsafe fn dangerous() {}

    unsafe {
        dangerous();
    }
  ```
  creating a safe abstraction over unsafe code:
  ```rust
    let mut v = vec![1, 2, 3, 4, 5, 6];

    let r = &mut v[..];

    let (a, b) = r.split_at_mut(3);

    assert_eq!(a, &mut [1, 2, 3]);
    assert_eq!(b, &mut [4, 5, 6]);
  ```
  call extern function:
  ```rust
    unsafe extern "C" {
        safe fn abs(input: i32) -> i32;
    }

    fn main() {
        println!("Absolute value of -3 according to C: {}", abs(-3));
    }
  ```
- Access or modify a mutable static variable
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
- Implement an unsafe trait
  ```rust
    unsafe trait Foo {
        // methods go here
    }

    unsafe impl Foo for i32 {
        // method implementations go here
    }
  ```
- Access fields of a `union`: Unions are primarily used to interface with unions in C code. Accessing union fields is unsafe because Rust can’t guarantee the type of the data currently being stored in the union instance

### 17.2 Advanced trait
*Associated types* connect a type placeholder with a trait such that the trait method definitions can use these placeholder types in their signatures.

Difference of associated types and generics: Only can implement associated types trait once, but can implement generics trait for each type

Operator Overloading: Rust doesn’t allow create operators or overload arbitrary operators. But can overload the operations and corresponding traits listed in `std::ops` by implementing the traits associated with the operator.
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

Default generic type: `Rhs`(right-hand side)
```rust
trait Add<Rhs=Self> {
    type Output;

    fn add(self, rhs: Rhs) -> Self::Output;
}
```

When calling methods with the same name:
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

If associated functions that are not methods don’t have a `self` parameter:
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

For a type to implement the first trait, and require that type to also implement the second trait: `trait <trait_1>: <trait_2>`
```rust
use std::fmt;

trait OutlinePrint: fmt::Display {
    fn outline_print(&self) {
        // snip
    }
}
```

***newtype pattern***: *orphan rule* only allow to implement a trait on a type if either the trait or the type, or both, are local to our crate. If we wanted the new type to have every method the inner type has, implementing the `Deref` trait on the Wrapper to return the inner type would be a solution.
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

### 17.3 Advanced types
Type alias: just alias, not new type
```rust
type Kilometers = i32;

let x: i32 = 5;
let y: Kilometers = 5;

println!("x + y = {}", x + y);
```

*never type*: `!`, it has no values. Like in `let ... match` arms(must return the same type so complier know what type of value):
```rust
let guess: u32 = match guess.trim().parse() {
    Ok(num) => num,
    Err(_) => continue, // continue has a ! value, so Rust know guess is u32 type
};

impl<T> Option<T> {
    pub fn unwrap(self) -> T {
        match self {
            Some(val) => val,
            None => panic!("called `Option::unwrap()` on a `None` value"), // panic! also has a ! value, so Rust know val is T type
        }
    }
}

loop {
    print!("and ever "); // the loop never ends, so ! is the value of the expression
}
```

The rule of *dynamically sized types* is that we must always put values of dynamically sized types behind a pointer of some kind.

### 17.4 Advanced functions and closures
Function pointer: pass regular functions not new functions to functions
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

Return closure: `returns_closure` and `returns_initialized_closure` both return `impl Fn(i32) -> i32`, but can not be as the same type. Whenever return an `impl Trait` Rust creates a unique opaque type.
```rust
fn returns_closure() -> impl Fn(i32) -> i32 {
    |x| x + 1
}

fn returns_initialized_closure(init: i32) -> impl Fn(i32) -> i32 {
    move |x| x + init
}
```

### 17.5 Macros
Difference between macros and functions:
| aspect | macro | function |
| :-     | :-    | :-       |
| def    | `macro_rules!`/`proc_macro` | `fn` |
| call   | `!` suffix | function_name() |
| unfold | compile unfold | runtime unfold |
| param  | variable number of parameters | a fixed number of parameters |
| type check | no | yes |
| runtime cost | no | yes |
| code reusability | high reusability | limited reusability |
| maintenance and debugging | hard | simple |

Same points:
1. Macros and functions can be used to encapsulate logic and reduce code duplication
2. Both macros and functions need to be defined before compilation (macros need to be defined before calling, functions have no such limitations)
3. Both macros and functions can be combined with generic parameters such as T to achieve polymorphism

Use `macro_rules!` define a slightly simplified `vec!` macro:
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
// `#[macro_export]` annotation indicates that this macro should be made available whenever the crate in which the macro is defined is brought into scope
// `macro_rules!` and macro name define this is a macro, {} is the body of the macro definition
// `vec!`'s body is similar to the structure of a match expression. If the pattern matches, the associated block of code will be emitted
// Within `$()` is `$x:expr`, which matches any Rust expression and gives the expression the name `$x`
// The `*` specifies that the pattern matches zero or more of whatever precedes the `*`
```

Procedural macros are an advanced metaprogramming tool that allows developers to dynamically generate or modify code at compile time. Unlike declarative macros (`macro_rules!`) which are based on pattern matching, procedural macros implement more complex logic through the manipulation of `TokenStream` (the syntactic units of Rust) and Abstract Syntax Trees (AST), making them a core technology for building libraries, frameworks, and tools.
Three kinds of *procedural* macros:
- Custom `#[derive]` macros that specify code added with the `derive` attribute used on structs and enums. Automatically implement specific Traits for structures or enumerations.
  ```rust
    #[derive(Debug, Clone)]
    struct Point { x: i32, y: i32 }
  ```
- Attribute-like macros that define custom attributes usable on any item. Modification or expansion of the behavior of items such as functions, structures, and modules. Commonly used to add custom annotations or configurations.
  ```rust
    #[route(GET, "/")]
    fn index() {}
  ```
- Function-like macros that look like function calls but operate on the tokens specified as their argument, type like `macro_rules!`
  ```rust
    sql!(SELECT * FROM users WHERE id = 1);
  ```
How to create a derive macro?<sup>[4]</sup>

[1]: See more [Enabling Recursive Types with Boxes](https://doc.rust-lang.org/book/ch15-01-box.html#enabling-recursive-types-with-boxes)
[2]: See more [The Rustonomicon](https://doc.rust-lang.org/nomicon/index.html)
[3]: Read Rust’s official guide to the subject, the [Rustonomicon](https://doc.rust-lang.org/nomicon/)
[4]: See [How to Write a Custom derive Macro](https://doc.rust-lang.org/book/ch20-05-macros.html#how-to-write-a-custom-derive-macro)
