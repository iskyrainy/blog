---
title: Access Rust 1
category: Tech
tag: Rust
date: 2025-05-19T00:37:17+08:00
---


> Except for when I first encountered programming on campus and learned to use non-GC languages (C/C++), I have mostly engaged with languages that do not require manual memory management (Java/Go/Kotlin, etc.). Therefore, I've always wanted to try a new non-GC language: Rust. The *AccessRust* blog series records the points I need to note while learning Rust (mainly while reading [The Rust Programming Language](https://doc.rust-lang.org/book/title-page.html)). 🦀

# AccessRust-1

## Part 1 Install Rust

Here I show how to install Rust in WSL(Ubuntu) online:

1. update apt
   ```bash
    sudo apt upgrade
    sudo apt update
   ```

2. install rust
   ```bash
    sudo apt install gcc
    gcc -v
    # or install version you want, like rust-1.80-all etc.
    sudo apt install rust-all
   ```

3. install tools
   ```bash
    # may take some time
    rustup default stable
   ```

4. verfiy
   ```bash
    rustc -V
    cargo --version
    # touch cargo
    cargo new hello_world
    cd hello_world
    cargo run
   ```

## Part 2 Base concepts
`let`: define an immutable variable. like `let x = 0;`
`mut`: define a mutable variable. like `let mut y = 1;`
`const`: declare a constant, cannot with `mut`. like `const THREE_HOURS_IN_SECONDS: u32 = 60 * 60 * 3;`
Rust allow re-define variables with same name.
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

Data types:
- scalar type: Integer, Floating-point number, Boolean, and Character
- compound type: Tuple, Array
  

Integer:
| Length | Signed | Unsigned |
| :-: | :-: | :-: |
| 8-bit   | `i8`     | `u8`       |
| 16-bit  | `i16`    | `u16`      |
| 32-bit  | `i32`    | `u32`      |
| 64-bit  | `i64`    | `u64`      |
| 128-bit | `i128`   | `u128`     |
| arch    | `isize`  | `usize`    |

Hex: `0xff`, Octal: `0o77`, Bin: `0b1111_0000`, Byte(`u8` only): `b'A'`
Overflow causes an error with panic in `debug` mode, but 'wrap around'(like from 257 to 1 for a `u8` variable) in `release` mode.
Floating-point numbers: `f32`/`f64`
Boolean: `bool`(`true`/`false`)
Character: `char`
Tuple: like `let tup: (i32, f64, u8) = (500, 6.4, 1);`
Array: like `let a: [i32; 5] = [1, 2, 3, 4, 5];`

## Part 3 Ownership

 All data stored on the stack must have a known, fixed size. Data with an unknown size at compile time or a size that might change must be stored on the heap instead<sup>[1]</sup>.
Ownership rules:
- Each value in Rust has an *owner*.
- There can only be one owner at a time.
- When the owner goes *out of* scope, the value will be dropped.

```rust
    {
        let s = String::from("hello"); // s is valid from this point forward

        // do stuff with s

    }                                  // this scope is now over, and s is no longer valid
                                       // when out of scope, Rust auto call the `drop` function to free memory of s
```

No shallow copy but **move**.
For those data stored in heap, conside memory corruption caused by twice `drop` call after *out of scope*, Rust replace shallow copy from move. And **move** is a very cheep operation.

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

Rust has `Copy` trait and `Drop` trait. If a type implements the `Copy` trait, variables stored in stack and do not **move**. If the type, or any of its parts, has implemented the `Drop` trait, Rust wont allow the type implements the `Copy` trait.

Ownership about function:
```rust
fn main() {
    let s = String::from("Hello, world!");
    take_ownership(s);

    println!("{}", s); // This line will cause a compile-time error

    let x = 5;
    make_copy(x);
    println!("{}", x); // This line will work because i32 is a Copy type
}

fn take_ownership(s: String) {
    println!("{}", s);
}

fn make_copy(x: i32) {
    println!("{}", x);
}
```

> To avoid the tedious ownership managment, Rust offer a feature for using a value without transferring ownership, called *references*.

Rust use `&` to create a reference that refers to variable. `&` reference, default immutable, do not pass and return ownership. Create a mutable reference with `mut`, but here allow only one mutable reference for each variable at one time to avoid *data race*.

Rust cannot have a mutable reference while we have an immutable one to the same value.

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

Reference rule:
- At any given time, you can have either one mutable reference or any number of immutable references.
- References must always be valid.
  

## Part 4 Struct

Note that the entire instance must be mutable; Rust doesn’t allow us to mark only certain fields as mutable.
If build a new struct object from an exist obj, and move some of old's `Drop` trait fields to new, then old obj is invalid.

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
        ..user1 // user1 invalid
    };

    let user3 = User {
        username: String::from("example_user"),
        email: String::from("aa"),
        ..user2 // user2 valid
    }
}

struct User{
    active: bool,
    username: String,
    email: String,
    sign_in_count: u64,
}
```

Rust supports *tuple structs* and *unit-like struct*.
```rust
struct Color(i32, i32, i32);
struct Point(i32, i32, i32);
struct AlwaysEqual; // unit-like struct

fn main() {
    let black = Color(0, 0, 0);
    let origin = Point(0, 0, 0);
    let subject = AlwaysEqual;
}
```

Struct fields are lifetime fields, cannot be like `username: &str`.

All functions defined within an `impl` block are called associated functions.

## Part 5 Enum and Pattern matching

Only when we have an `Option<T>` do we have to worry about possibly not having a value, and the compiler will make sure we handle that case before using the value.

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

**`match` arms' pattern must cover all possibilities.**

`other` list all values not specifically listed.
`_` matches any value and does not bind to that value.
`if let` as a syntax sugar for `match`:

```rust
let mut count = 0;
if let Some(i) = index {
    println!("{}", i);
} else {
    count += 1;
}

// same as
let mut count = 0;
match index {
    Some(i) => println!("{}", i),
    _ => count += 1,
}
```

`let else` make a main body scope variable:

```rust
fn add_one(index: Option<i32>) -> Option<i32> {
    let Some(i) = index else {
        return None;
    }
    Some(i + 1); // i is valid
}
```

## Part 6 Access Control
- *Package*: Software project package, include `src`, `Config.toml`, `Config.lock` etc.
- *Crate*: Independently compilable units, compile to a executable file(src/main.rs) or a lib(src/lib.rs).
- *Module*: Organize feature-related code together and name it by mod. A file can contain multiple mods, and mods can also be nested between them. where `src/main.rs` and `src/lib.rs` are crate root.

`pub`: Control modules and items access.
```rust
mod front_of_house {
    pub mod hosting {
        fn add_to_waitlist() {}
    }
}
```

`super`: Same as `..` in OS file system.
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

`self`: Same as `.` in OS file system.
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

`use`: Import module.
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

**Limited visibility**: 
- `pub`: No restrictions on visibility
- `pub(crate)`: Visible in the current crate
- `pub(self)`: Visible in the current module
- `pub(super)`: Visible in the parent module
- `pub(in <path>)`: Visible in the <path>

In Rust, all items (functions, methods, structs, enums, modules, and constants) are private to parent modules by default.
The `pub` keyword on a module only lets code in its ancestor modules refer to it, not access its inner code.

## Part 7 Common Collections
- `Vec`: list.
  ```rust
    // create Vec by Vec::new()
    let v: Vec<i32> = Vec::new();

    // create Vec by macro vec!
    let v = vec![1, 2, 3];

    // creat a mut Vec
    let mut v = Vec::new();
    v.push(5);

    // read value from Vec: index or get()
    let v = vec![1, 2, 3, 4, 5];
    let third: &i32 = &v[2];
    println!("The third element is {third}");
    let third: Option<&i32> = v.get(2);
    match third {
        Some(third) => println!("The third element is {third}"),
        None => println!("There is no third element."),
    }

    // iterating Vec
    let mut v = vec![100, 32, 57];
    for i in &mut v {
        *i += 50;
    }
  ```
- `String`: string.
  ```rust
    // String is UTF-8 encoded 
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

    // iterating String
    for c in "Зд".chars() {
        println!("{c}");
    }
    // З д

    for b in "Зд".bytes() {
        println!("{b}");
    }
    // 208 151 208 180
  ```
- `HashMap`: map.
  ```rust
    // 
    use std::collections::HashMap;
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert(String::from("Blue"), 10);

    // overwrite
    scores.insert(String::from("Blue"), 20);

    // add if not present
    scores.entry(String::from("Blue")).or_insert(50);

    // update value by old value
    *scores.entry(String::from("Blue")).or_insert(50) += 50;
  ```

Rust not allow have mutable and immutable references in the same scope. When we hold an immutable reference to the first element in a vector and try to add an element to the end. This program won’t work if we also try to refer to that element later in the function.
Vectors put the values next to each other in memory, adding a new element onto the end of the vector might require allocating new memory and copying the old elements to the new space, if there isn’t enough room to put all the elements next to each other where the vector is currently stored.
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

*String dont support indexing*: String is UTF-8 encoded, so an index into the string’s bytes will not always correlate to a valid Unicode scalar value. **Should use caution when creating string slices with ranges, because doing so can crash program.**

## Part 8 Error Handling
There are two ways to cause a panic in practice: by taking an action that causes our code to panic (such as accessing an array past the end) or by explicitly calling the `panic!` macro. `RUST_BACKTRACE=1` print the stack info, as `RUST_BACKTRACE=1 cargo run`.

Shortcuts for Panic on Error:
```rust
use std::fs::File;

// origin
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

If dont want to handle panic on error, propagating error to caller. `?` is a shortcut for propagating error, only use in functions whose return type is compatible with the value the `?` is used on. And `?` works same in `Option`.
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

// shortcut `?`
fn read_username_from_file() -> Result<String, io::Error> {
    let mut username = String::new();
    File::open("hello.txt")?.read_to_string(&mut username)?;
    Ok(username)
}
```

What time should we `panic`?
1. panic when testing
2. panic if we can offer more informations than compiler

Panic in guidelines:
- The bad state is something that is unexpected, as opposed to something that will likely happen occasionally, like a user entering data in the wrong format.
- Your code after this point needs to rely on not being in this bad state, rather than checking for the problem at every step.
- There’s not a good way to encode this information in the types you use.

## Part 9 Generic Types, Traits, Lifetimes
*Generic Type*: Using generic types won’t make program run any slower than it would with concrete types. Rust turn generic types to concrete types that are used when compiled.
```rust
// fn
fn largest<T>(list: &[T]) -> &T {}

// struct
struct Point<T, U> {
    x: T,
    y: U,
}

// enum
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

`trait`: Some aspects as `interface` in Java/Go, trait can has a default implement, but there is no need override all trait's `fn` when implement a trait on a type.
Note that it isn’t possible to call the default implementation from an overriding implementation of that same method.
Trait as parameter, that parameter accepts any type that implements the specified trait.
Implement a trait on a type only if either the trait or the type, or both, are local to our crate.
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

// default trait
pub trait Summary {
    fn summarize(&self) -> String {
        String::from("(Read more...)")
    }
}
impl Summary for NewsArticle {}

// trait as parameter
pub fn notify(item: &impl Summary) {
    println!("Breaking news! {}", item.summarize());
}

// trait bound syntax
// same as `pub fn notify(item1: &impl Summary, item2: &impl Summary) {}`
pub fn notify<T: Summary>(item1: &T, item2: &T) {}

// bound multiple traits
fn some_function<T: Display + Clone, U: Clone + Debug>(t: &T, u: &U) -> i32 {}
// use `where`
fn some_function<T, U>(t: &T, u: &U) -> i32
where
    T: Display + Clone,
    U: Clone + Debug,
{}

// return type implement trait
fn returns_summarizable() -> impl Summary {}
```

Trait bounds to conditionally implement methods: 
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

// Pair<T> only implements the cmp_display method if its inner type T implements the PartialOrd trait that enables comparison and the Display trait that enables printing
impl<T: Display + PartialOrd> Pair<T> {
    fn cmp_display(&self) {
        if self.x >= self.y {
            println!("The largest member is x = {}", self.x);
        } else {
            println!("The largest member is y = {}", self.y);
        }
    }
}

// conditionally implement a trait for any type that implements another trait
impl<T: Display> ToString for T {
    // --snip--
}
```

The Rust compiler has a *borrow checker* that compares scopes to determine whether all borrows are valid.
At compile time, Rust compares the size of the two lifetimes and sees that r has a lifetime of 'a but that it refers to memory with a lifetime of 'b. The program is rejected because 'b is shorter than 'a: the subject of the reference doesn’t live as long as the reference.
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

Lifetime Annotation Syntax: Lifetime annotations don’t change how long any of the references live. Rather, they describe the relationships of the lifetimes of multiple references to each other without affecting the lifetimes.
```rust
&i32        // a reference
&'a i32     // a reference with an explicit lifetime
&'a mut i32 // a mutable reference with an explicit lifetime

fn main() {
    let string1 = String::from("abcd");
    let string2 = "xyz";

    let result = longest(string1.as_str(), string2);
    println!("The longest string is {result}");
}

fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// Lifetime Annotations in Struct Definitions
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
When we pass concrete references to `longest`, the generic lifetime `'a` will get the concrete lifetime that is equal to the smaller of the lifetimes of `x` and `y`.

**Lifetime Annotation Elision Rules**:
1. the compiler assigns a lifetime parameter to each parameter that’s a reference
2. if there is exactly one input lifetime parameter, that lifetime is assigned to all output lifetime parameters
3. if there are multiple input lifetime parameters, but one of them is &self or &mut self because this is a method, the lifetime of self is assigned to all output lifetime parameters

The Static Lifetime: `'static`, which denotes that the affected reference can live for the entire duration of the program.

[1]: See more [The Stack and the Heap](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#the-stack-and-the-heap)
