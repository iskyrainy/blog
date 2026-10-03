---
title: Access Rust 1
category: Tech
tag: Rust
date: 2025-05-19T00:37:17+08:00
---


> 캠퍼스에서 처음 프로그래밍을 접하고 비 GC 언어(C/C++)를 배웠던 때를 제외하면, 대부분 수동 메모리 관리가 필요 없는 언어(Java/Go/Kotlin 등)를 다뤄왔다. 그래서 항상 새로운 비 GC 언어인 Rust를 시도해 보고 싶었다. *AccessRust* 블로그 시리즈는 Rust를 학습하며(주로 [The Rust Programming Language](https://doc.rust-lang.org/book/title-page.html)를 읽으면서) 기록할 점들을 정리한 것이다. 🦀

# AccessRust-1

## Part 1 Rust 설치

여기서는 WSL(Ubuntu)에서 Rust를 온라인으로 설치하는 방법을 보여준다:

1. apt 업데이트
   ```bash
    sudo apt upgrade
    sudo apt update
   ```

2. rust 설치
   ```bash
    sudo apt install gcc
    gcc -v
    # or install version you want, like rust-1.80-all etc.
    sudo apt install rust-all
   ```

3. 도구 설치
   ```bash
    # may take some time
    rustup default stable
   ```

4. 확인
   ```bash
    rustc -V
    cargo --version
    # touch cargo
    cargo new hello_world
    cd hello_world
    cargo run
   ```

## Part 2 기본 개념
`let`: 불변 변수를 정의한다. 예: `let x = 0;`
`mut`: 가변 변수를 정의한다. 예: `let mut y = 1;`
`const`: 상수를 선언한다. `mut`와 함께 사용할 수 없다. 예: `const THREE_HOURS_IN_SECONDS: u32 = 60 * 60 * 3;`
Rust는 같은 이름의 변수를 재정의할 수 있다.
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

데이터 타입:
- 스칼라 타입: 정수, 부동 소수점 수, 불리언, 문자
- 복합 타입: 튜플, 배열
  

정수:
| Length | Signed | Unsigned |
| :-: | :-: | :-: |
| 8-bit   | `i8`     | `u8`       |
| 16-bit  | `i16`    | `u16`      |
| 32-bit  | `i32`    | `u32`      |
| 64-bit  | `i64`    | `u64`      |
| 128-bit | `i128`   | `u128`     |
| arch    | `isize`  | `usize`    |

16진수: `0xff`, 8진수: `0o77`, 2진수: `0b1111_0000`, 바이트(`u8` 전용): `b'A'`
오버플로는 `debug` 모드에서 panic 오류를 발생시키지만, `release` 모드에서는 '감싸기(wrap around)'(예: `u8` 변수의 경우 257에서 1로)가 발생한다.
부동 소수점 수: `f32`/`f64`
불리언: `bool`(`true`/`false`)
문자: `char`
튜플: 예: `let tup: (i32, f64, u8) = (500, 6.4, 1);`
배열: 예: `let a: [i32; 5] = [1, 2, 3, 4, 5];`

## Part 3 소유권

  스택에 저장된 모든 데이터는 알려진 고정 크기를 가져야 한다. 컴파일 시점에 크기를 알 수 없거나 크기가 변경될 수 있는 데이터는 대신 힙에 저장해야 한다<sup>[1]</sup>.
소유권 규칙:
- Rust의 각 값에는 *소유자*(owner)가 있다.
- 한 번에 하나의 소유자만 있을 수 있다.
- 소유자가 스코프를 *벗어나면* 값은 해제(drop)된다.

```rust
    {
        let s = String::from("hello"); // s is valid from this point forward

        // do stuff with s

    }                                  // this scope is now over, and s is no longer valid
                                       // when out of scope, Rust auto call the `drop` function to free memory of s
```

얕은 복사는 없고 **이동**(move)만 있다.
힙에 저장된 데이터의 경우, *스코프를 벗어난* 후 두 번의 `drop` 호출로 인한 메모리 손상을 고려하여 Rust는 얕은 복사를 move로 대체한다. 그리고 **move**는 매우 저렴한 연산이다.

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

Rust에는 `Copy` 트레이트와 `Drop` 트레이트가 있다. 타입이 `Copy` 트레이트를 구현하면 스택에 저장된 변수는 **move**되지 않는다. 타입 또는 그 일부가 `Drop` 트레이트를 구현한 경우, Rust는 그 타입이 `Copy` 트레이트를 구현하도록 허용하지 않는다.

함수와 소유권:
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

> 번거로운 소유권 관리를 피하기 위해, Rust는 소유권을 이전하지 않고 값을 사용할 수 있는 기능을 제공하는데, 이를 *참조*(references)라고 한다.

Rust는 변수를 가리키는 참조를 생성하기 위해 `&`를 사용한다. `&` 참조는 기본적으로 불변이며, 소유권을 전달하거나 반환하지 않는다. `mut`로 가변 참조를 생성할 수 있지만, *데이터 경합*(data race)을 피하기 위해 한 번에 각 변수에 대해 하나의 가변 참조만 허용된다.

Rust는 같은 값에 대한 불변 참조를 가지고 있는 동안 가변 참조를 가질 수 없다.

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

참조 규칙:
- 어느 시점에서든 하나의 가변 참조 또는 여러 개의 불변 참조를 가질 수 있다.
- 참조는 항상 유효해야 한다.
  

## Part 4 구조체

전체 인스턴스가 가변이어야 한다는 점에 유의하자. Rust는 특정 필드만 가변으로 표시하는 것을 허용하지 않는다.
기존 객체에서 새 구조체 객체를 만들고, 기존 객체의 `Drop` 트레이트 필드 일부를 새 객체로 이동하면 기존 객체는 무효가 된다.

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

Rust는 *튜플 구조체*(tuple structs)와 *유닛 유사 구조체*(unit-like struct)를 지원한다.
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

구조체 필드는 수명 필드이므로 `username: &str`처럼 될 수 없다.

`impl` 블록 내에 정의된 모든 함수를 연관 함수(associated functions)라고 한다.

## Part 5 열거형과 패턴 매칭

`Option<T>`가 있을 때만 값이 없을 가능성을 걱정해야 하며, 컴파일러는 값을 사용하기 전에 해당 경우를 처리하도록 보장한다.

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

**`match`의 각 arm 패턴은 모든 가능성을 커버해야 한다.**

`other`는 특별히 나열되지 않은 모든 값을 나열한다.
`_`는 모든 값과 일치하며 그 값에 바인딩되지 않는다.
`if let`은 `match`의 문법 설탕(syntax sugar)이다:

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

`let else`는 본문 스코프 변수를 만든다:

```rust
fn add_one(index: Option<i32>) -> Option<i32> {
    let Some(i) = index else {
        return None;
    }
    Some(i + 1); // i is valid
}
```

## Part 6 접근 제어
- *패키지*(Package): 소프트웨어 프로젝트 패키지로, `src`, `Config.toml`, `Config.lock` 등을 포함한다.
- *크레이트*(Crate): 독립적으로 컴파일 가능한 단위로, 실행 파일(src/main.rs) 또는 라이브러리(src/lib.rs)로 컴파일된다.
- *모듈*(Module): 기능 관련 코드를 함께 구성하고 mod로 이름을 지정한다. 하나의 파일에 여러 mod를 포함할 수 있고, mod끼리 중첩될 수도 있다. 여기서 `src/main.rs`와 `src/lib.rs`는 크레이트 루트(crate root)이다.

`pub`: 모듈과 항목의 접근을 제어한다.
```rust
mod front_of_house {
    pub mod hosting {
        fn add_to_waitlist() {}
    }
}
```

`super`: OS 파일 시스템의 `..`와 같다.
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

`self`: OS 파일 시스템의 `.`과 같다.
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

`use`: 모듈을 가져온다.
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

**제한된 가시성**:
- `pub`: 가시성에 제한 없음
- `pub(crate)`: 현재 크레이트에서 가시적
- `pub(self)`: 현재 모듈에서 가시적
- `pub(super)`: 부모 모듈에서 가시적
- `pub(in <path>)`: <path>에서 가시적

Rust에서 모든 항목(함수, 메서드, 구조체, 열거형, 모듈, 상수)은 기본적으로 부모 모듈에 대해 비공개이다.
모듈의 `pub` 키워드는 상위 모듈의 코드가 그 모듈을 참조할 수 있게만 할 뿐, 내부 코드에 접근할 수 있게 하지는 않는다.

## Part 7 일반적인 컬렉션
- `Vec`: 리스트.
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
- `String`: 문자열.
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
- `HashMap`: 맵.
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

Rust는 같은 스코프에서 가변 참조와 불변 참조를 함께 가지는 것을 허용하지 않는다. 벡터의 첫 번째 요소에 대한 불변 참조를 가지고 있으면서 끝에 요소를 추가하려고 할 때를 생각해 보자. 함수 뒤에서 그 요소를 참조하려고 하면 이 프로그램은 작동하지 않는다.
벡터는 값을 메모리에 서로 인접하게 배치하는데, 벡터가 현재 저장된 위치에 모든 요소를 나란히 둘 공간이 충분하지 않으면 벡터 끝에 새 요소를 추가할 때 새로운 메모리를 할당하고 기존 요소를 새 공간으로 복사해야 할 수 있다.
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

*문자열은 인덱싱을 지원하지 않는다*: 문자열은 UTF-8로 인코딩되므로 문자열의 바이트에 대한 인덱스가 항상 유효한 유니코드 스칼라 값과 대응되지는 않는다. **범위로 문자열 슬라이스를 만들 때는 주의해야 한다. 그렇게 하면 프로그램이 충돌할 수 있기 때문이다.**

## Part 8 오류 처리
실제로 panic을 발생시키는 방법은 두 가지가 있다: 코드가 panic을 일으키는 동작을 하는 경우(예: 배열 끝을 넘어 접근) 또는 명시적으로 `panic!` 매크로를 호출하는 경우이다. `RUST_BACKTRACE=1`은 스택 정보를 출력한다. 예: `RUST_BACKTRACE=1 cargo run`.

오류 발생 시 Panic을 위한 단축 표현:
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

오류 발생 시 panic을 처리하고 싶지 않다면, 오류를 호출자에게 전파한다. `?`는 오류를 전파하는 단축 표현으로, `?`가 사용된 값과 호환되는 반환 타입을 가진 함수에서만 사용할 수 있다. 그리고 `?`는 `Option`에서도 동일하게 작동한다.
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

언제 `panic`해야 할까?
1. 테스트할 때 panic
2. 컴파일러보다 더 많은 정보를 제공할 수 있을 때 panic

Panic에 대한 가이드라인:
- 나쁜 상태가 가끔 일어날 법한 일(예: 사용자가 잘못된 형식으로 데이터를 입력하는 것)이 아니라 예상치 못한 것일 때.
- 이 시점 이후의 코드가 매 단계마다 문제를 확인하기보다 이 나쁜 상태가 아닌 것에 의존해야 할 때.
- 사용하는 타입에 이 정보를 인코딩할 좋은 방법이 없을 때.

## Part 9 제네릭 타입, 트레이트, 수명
*제네릭 타입*: 제네릭 타입을 사용해도 구체적인 타입을 사용할 때보다 프로그램이 더 느리게 실행되지 않는다. Rust는 컴파일될 때 제네릭 타입을 사용된 구체적인 타입으로 변환한다.
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

`trait`: Java/Go의 `interface`와 몇 가지 측면에서 유사하다. trait은 기본 구현을 가질 수 있지만, 어떤 타입에 trait을 구현할 때 그 trait의 모든 `fn`을 재정의할 필요는 없다.
같은 메서드의 재정의된 구현에서 기본 구현을 호출하는 것은 불가능하다는 점에 유의하자.
trait을 매개변수로 사용하면, 그 매개변수는 지정된 trait을 구현하는 모든 타입을 받아들인다.
trait 또는 타입 중 하나, 또는 둘 다 우리 크레이트에 로컬인 경우에만 타입에 trait을 구현할 수 있다.
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

트레이트 바운드로 조건부 메서드 구현:
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

Rust 컴파일러에는 모든 빌림(borrow)이 유효한지 결정하기 위해 스코프를 비교하는 *빌림 검사기*(borrow checker)가 있다.
컴파일 시점에 Rust는 두 수명의 크기를 비교하여 r이 'a라는 수명을 가지지만 'b라는 수명을 가진 메모리를 참조한다는 것을 확인한다. 'b가 'a보다 짧기 때문에 프로그램은 거부된다: 참조 대상이 참조만큼 오래 살지 않기 때문이다.
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

수명 어노테이션 문법: 수명 어노테이션은 참조가 얼마나 오래 사는지를 바꾸지 않는다. 오히려 수명에 영향을 주지 않으면서 여러 참조의 수명 간 관계를 설명한다.
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
`longest`에 구체적인 참조를 전달하면, 제네릭 수명 `'a`는 `x`와 `y`의 수명 중 더 작은 것과 같은 구체적인 수명을 얻게 된다.

**수명 어노테이션 생략 규칙**:
1. 컴파일러는 참조인 각 매개변수에 수명 매개변수를 할당한다
2. 입력 수명 매개변수가 정확히 하나라면, 그 수명이 모든 출력 수명 매개변수에 할당된다
3. 입력 수명 매개변수가 여러 개이지만, 이것이 메서드이기 때문에 그중 하나가 &self 또는 &mut self라면, self의 수명이 모든 출력 수명 매개변수에 할당된다

정적 수명(The Static Lifetime): `'static`은 영향을 받는 참조가 프로그램 전체 기간 동안 살 수 있음을 나타낸다.

[1]: 자세한 내용은 [The Stack and the Heap](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#the-stack-and-the-heap)를 참조하자.