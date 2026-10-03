---
title: Access Rust 2
category: Tech
tag: Rust
date: 2025-06-16T00:27:12+08:00
---


# AccessRust-2
## Part 10 테스트
함수를 테스트 함수로 바꾸려면 `fn` 바로 앞 줄에 `#[test]`를 추가한다. `assert!`/`assert_eq!`/`assert_ne!` 매크로로 결과를 확인한다.
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

`#[should_panic]`은 함수 내부의 코드가 패닉하면 테스트가 통과하고, 함수 내부의 코드가 패닉하지 않으면 테스트가 실패한다고 표시한다.
기본적으로 `cargo test`는 멀티 스레드로 테스트를 실행하며, `cargo test -- --test-threads=[num]`으로 스레드 수를 설정한다.
`cargo test -- --show-output`을 사용하면 통과한 테스트의 출력을 표시한다. `cargo test [str]`은 이름에 [str]이 포함된 특정 테스트만 실행한다. `#[ignore]`는 `cargo test`를 실행할 때 무시되지만 `cargo test -- --ignored`에서는 실행된다는 것을 나타낸다.

`#[cfg]`는 *configuration*의 약자로, 뒤따르는 항목이 특정 구성 옵션이 주어졌을 때만 포함되어야 함을 표시한다. `#[cfg(test)]` 블록이 `cargo test`에 의해서만 포함되는 것과 같다.


## Part 11 함수형 언어 기능
클로저(closure): 익명 함수
클로저 정의에서 컴파일러는 각 매개변수와 반환 값에 대해 하나의 구체적인 타입을 추론한다.
```rust
let example_closure = |x| x;

let s = example_closure(String::from("hello")); // x의 타입을 String으로 추론
let n = example_closure(5); // String을 기대했는데 정수를 받았으므로 여기서 패닉
```

클로저 본문이 여전히 불변 참조만 필요로 하더라도, 클로저 정의 시작 부분에 `move` 키워드를 두어 `list`가 클로저로 이동되어야 함을 명시해야 한다. 새 스레드가 메인 스레드의 나머지 부분보다 먼저 끝날 수도 있고, 메인 스레드가 먼저 끝날 수도 있다. 만약 메인 스레드가 list의 소유권을 유지했지만 새 스레드보다 먼저 끝나서 list를 드롭하면, 스레드 내의 불변 참조는 유효하지 않게 된다.
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

클로저의 트레이트:
- `FnOnce`: 본문 밖으로 캡처된 값을 이동시키는 클로저는 한 번만 호출될 수 있기 때문에 `FnOnce`만 구현하고 다른 `Fn` 트레이트는 구현하지 않는다. 모든 클로저는 최소한 이 트레이트를 구현한다.
- `FnMut`: 본문 밖으로 캡처된 값을 이동시키지는 않지만 캡처된 값을 변경할 수 있다.
- `Fn`: 본문 밖으로 캡처된 값을 이동시키지 않고 캡처된 값도 변경하지 않으며, 환경에서 아무것도 캡처하지 않는 클로저도 포함한다.

## Part 12 Cargo
### 12.1 빌드
`cargo build`: *dev* 프로파일로 빌드
`cargo build --release`: *release* 프로파일로 빌드

`opt-level`은 Rust가 코드에 적용할 최적화 수준을 제어하며 0부터 3까지의 범위를 가진다. 높은 수준(3)은 코드를 컴파일하는 데 더 많은 시간이 걸리지만 더 빠른 결과물을 얻는다:
```rust
[profile.dev]
opt-level = 0

[profile.release]
opt-level = 3
```

### 12.2 문서 추가 및 크레이트 발행
`cargo doc`은 프로젝트의 문서를 생성하며(문서 주석은 슬래시 세 개 `///`를 사용한다), `cargo doc --open`은 생성된 index.html을 브라우저에서 연다(wsl에서 열 경우 `wslview`가 설치되어 있는지 확인하라).

`pub use`를 사용하여 항목을 재내보내기(re-export)함으로써 비공개 구조와 다른 공개 구조를 만들 수 있다.

1. [crates.io](https://crates.io)에서 API 토큰을 생성하고 cmd에서 `cargo login`으로 로그인한다
2. *description, license, license-file, documentation, homepage 또는 repository*에 대한 크레이트 정보를 설정한 다음 `cargo publish`로 크레이트를 발행한다
3. cargo는 발행된 버전을 삭제하는 것을 허용하지 않는다. 하지만 `cargo yank --vers [x.x.x]`로 버전을 사용 중단(deprecated)으로 표시할 수 있다. yank는 *Cargo.lock*을 가진 모든 프로젝트가 깨지지 않으며, 앞으로 생성되는 *Cargo.lock* 파일은 yank된 버전을 사용하지 않는다는 것을 의미한다. 명령에 --undo를 추가하면 yank를 취소하고 프로젝트가 다시 해당 버전에 의존하기 시작하도록 허용할 수도 있다. 예: `cargo yank --vers [x.x.x] --undo`

### 12.3 워크스페이스 사용
워크스페이스 디렉터리로 이동하여 다음 내용으로 `Cargo.toml`을 생성한다:
```rust
[workspace]
resolver = "3"
```
그런 다음 `cargo new`로 바이너리 크레이트를 생성한다. 워크스페이스는 최상위 수준에 하나의 target 디렉터리를 가지며 컴파일된 산출물이 그곳에 배치된다.

Cargo는 워크스페이스의 크레이트들이 서로 의존한다고 가정하지 않으므로 의존 관계를 명시적으로 지정해야 한다.
```rust
[dependencies]
add_one = { path = "../add_one" }
```

`-p [crate_name]`으로 워크스페이스에서 실행하려는 패키지를 지정한다. 워크스페이스는 각 크레이트 디렉터리에 Cargo.lock을 두는 대신 최상위 수준에 단 하나의 Cargo.lock 파일만 가진다는 점에 유의하라. 이는 모든 크레이트가 모든 의존성의 동일한 버전을 사용하도록 보장한다.

### 12.4 crates.io에서 바이너리 설치
`cargo install`은 바이너리(크레이트에 src/main.rs 파일이나 바이너리로 지정된 다른 파일이 있으면 생성되는 실행 가능한 프로그램으로, 그 자체로는 실행할 수 없지만 다른 프로그램에 포함하기 적합한 라이브러리 타깃과는 대조된다)를 로컬에 설치한다.
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
### 12.5 사용자 정의 명령으로 cargo 확장
Cargo는 수정하지 않고도 새로운 하위 명령으로 확장할 수 있도록 설계되었다. $PATH에 있는 바이너리 이름이 cargo-something이라면 `cargo something`을 실행하여 마치 Cargo 하위 명령인 것처럼 실행할 수 있다. 이런 사용자 정의 명령은 `cargo --list`를 실행할 때도 나열된다. cargo install로 확장을 설치한 다음 내장 명령처럼 실행할 수 있다.

## Part 13 스마트 포인터
스마트 포인터는 `Deref`와 `Drop` 트레이트를 구현한다.
- `Deref`: 스마트 포인터 구조체의 인스턴스가 참조처럼 동작할 수 있게 해준다
- `Drop`: 스마트 포인터의 인스턴스가 스코프를 벗어날 때 실행되는 코드를 사용자 정의할 수 있게 해준다

`std`의 몇 가지 스마트 포인터:
- `Box<T>`: 힙에 값을 할당하기 위한 것
- `Rc<T>`: 다중 소유권을 가능하게 하는 참조 카운팅 타입
- `Ref<T>`/`RefMut<T>`: `RefCell<T>`를 통해 접근하며, 컴파일 타임 대신 런타임에 빌림 규칙을 강제하는 타입

### 13.1 Box<T>
`Box<T>`는 데이터를 스택이 아닌 힙에 저장할 수 있게 하며, 스택에는 포인터만 저장한다.
`Box<T>`는 주로 다음과 같은 상황에서 사용한다:
- 컴파일 타임에 크기를 알 수 없는 타입이 있고, 정확한 크기를 요구하는 컨텍스트에서 그 타입의 값을 사용하고 싶을 때: *재귀 타입*을 *비재귀 타입*으로 바꾸는 것과 같다<sup>[1]</sup>
- 많은 양의 데이터가 있고 소유권을 이전하고 싶지만 이전할 때 데이터가 복사되지 않도록 보장하고 싶을 때
- 값을 소유하고 싶지만 특정 타입이 아니라 특정 트레이트를 구현하는 타입이라는 점만 중요할 때

### 13.2 Deref/Drop 트레이트
Deref 트레이트를 구현하면 *역참조 연산자* `*`의 동작을 사용자 정의할 수 있다. 우리가 `*y`를 입력하면 내부적으로 Rust는 실제로 `*(y.deref())`를 실행했다.

Rust는 인스턴스가 스코프를 벗어날 때 자동으로 `drop`을 호출했다.

### 13.3 Rc<T>
Rc: *reference counting*(참조 카운팅)
값에 대한 참조가 0개라면, 어떤 참조도 유효하지 않게 되지 않고 값이 정리될 수 있다.

`Rc::clone`의 구현은 대부분의 타입의 `clone` 구현처럼 모든 데이터를 깊은 복사하지 않는다. `Rc::clone` 호출은 참조 카운트만 증가시킨다.

### 13.4 RefCell<T>
RefCell: *내부 가변성*(Interior mutability)을 통해 불변 값을 변경할 수 있게 해준다.
`RefCell<T>`는 멀티스레드 코드에서는 작동하지 않는다는 점에 유의하라! `Mutex<T>`는 `RefCell<T>`의 스레드 안전 버전이다.

### 13.5 메모리 누수
`Rc<T>` 값을 포함하는 `RefCell<T>` 값이나 내부 가변성과 참조 카운팅을 가진 타입의 유사한 중첩 조합이 있다면, 순환을 생성하지 않도록 보장해야 하며 Rust가 이를 잡아줄 것이라고 기대할 수 없다. 참조 순환을 생성하는 것은 프로그램의 논리 버그이며, 자동화된 테스트, 코드 리뷰 및 기타 소프트웨어 개발 관행을 통해 최소화해야 한다.
참조 순환을 피하는 또 다른 해결책은 강한 참조가 아닌 약한 참조를 사용하는 것처럼 데이터 구조를 재구성하는 것이다. 약한 참조는 소유권 관계를 표현하지 않으며, 그 카운트는 `Rc<T>` 인스턴스가 정리되는 시점에 영향을 주지 않는다. 약한 참조가 관련된 순환은 관련된 값의 강한 참조 카운트가 0이 되면 끊어지기 때문에 참조 순환을 일으키지 않는다.
`Weak<T>`가 참조하는 값은 드롭되었을 수 있으므로, `Weak<T>`가 가리키는 값으로 무언가를 하려면 값이 여전히 존재하는지 확인해야 한다. `Weak<T>` 인스턴스에서 `upgrade` 메서드를 호출하여 이를 수행하며, 이는 `Option<Rc<T>>`를 반환한다.

참조 순환을 일으키지 않는 트리 노드에 대한 예:
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

## Part 14 동시성
소유권과 타입 검사를 활용함으로써 많은 동시성 오류는 Rust에서 런타임 오류가 아닌 컴파일 타임 오류가 된다.

Rust 표준 라이브러리는 1:1 스레드 구현 모델을 사용하며, 이에 따라 프로그램은 언어 스레드 하나당 운영 체제 스레드 하나를 사용한다.

### 14.1 채널
`mpsc::channel` 함수(mpsc: *multiple producer, single consumer*)는 튜플을 반환하며, 첫 번째 요소는 송신 측인 transmitter이고 두 번째 요소는 수신 측인 receiver이다.
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

### 14.2 공유 상태 동시성
채널은 단일 소유권과 유사하며, 값을 채널을 통해 전송한 후에는 그 값에 어떤 변경도 있어서는 안 된다.
공유 메모리 동시성은 다중 소유권과 유사하다: 여러 스레드가 동시에 동일한 메모리 위치에 접근할 수 있다.

`Mutex<T>`는 스마트 포인터이다. lock 호출은 `MutexGuard`라는 스마트 포인터를 반환하며, 이는 unwrap 호출로 처리한 `LockResult`로 감싸여 있다. `MutexGuard` 스마트 포인터는 내부 데이터를 가리키도록 `Deref`를 구현하며, `MutexGuard`가 스코프를 벗어날 때 자동으로 락을 해제하는 `Drop` 구현도 가지고 있는데, 이는 내부 스코프의 끝에서 발생한다.
`Mutex<T>`는 불변이지만 내부 값에 대한 가변 참조를 얻을 수 있으며, `Mutex<T>`는 `Cell` 계열처럼 내부 가변성을 제공한다.
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

`Rc<T>`가 아닌 `Arc<T>`를 사용하여 스레드 간에 안전하게 공유되도록 보장하라.
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

### 14.3 확장 가능한 동시성
동시성 처리는 언어나 표준 라이브러리에 국한되지 않는다. 표준 라이브러리가 아닌 언어에 내장된 주요 동시성 개념 중에는 `std::marker` 트레이트인 `Send`와 `Sync`가 있다<sup>[2]</sup>.
- `Send`: `Send`를 구현하는 타입의 값에 대한 소유권이 스레드 간에 이전될 수 있음을 나타낸다. 전적으로 `Send` 타입으로 구성된 모든 타입은 자동으로 `Send`로 표시된다.
- `Sync`: `Sync`를 구현하는 타입이 여러 스레드에서 참조되어도 안전함을 나타낸다. 전적으로 `Sync`를 구현하는 타입으로 구성된 타입도 `Sync`를 구현한다.

## Part 15 비동기 프로그래밍
`await`: 후위 키워드로, 메서드 체인을 쉽게 만들 수 있다.
```rust
let response_text = trpl::get(url).await.text().await;
```

Rust는 `async` 키워드로 표시된 블록을 보면 `Future` 트레이트를 구현하는 고유한 익명 데이터 타입으로 컴파일한다. Rust는 `async`로 표시된 함수를 보면 본문이 async 블록인 비동기 함수로 컴파일한다. 비동기 함수의 반환 타입은 컴파일러가 그 async 블록을 위해 생성한 익명 데이터 타입의 타입이다.
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

각 *`await`* 지점은 제어가 런타임으로 반환되는 곳을 나타낸다. Rust에는 보이지 않는 상태 기계가 있으며, 컴파일러는 인접한 상태 간의 안전성을 보장한다.

`Future`: `await`를 사용하는 코드를 보면, Rust는 내부적으로 특별한 `loop`에서 `poll`을 호출하는 코드로 컴파일한다. Rust는 `loop`가 이 future에 대한 작업을 일시 중지하고 다른 future에 대한 작업을 한 다음 나중에 이 future를 다시 확인할 수 있는 무언가로 제어를 넘길 수 있도록 보장한다.
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
자기 참조 데이터 타입을 가질 수 있는 객체의 경우(기본적으로 자신에 대한 참조를 가진 모든 객체는 이동하기에 안전하지 않다).
![The unsafe result of moving a self-referential data type](https://doc.rust-lang.org/book/img/trpl17-05.svg)

`Pin`으로 값에 대한 포인터를 감싸서 값을 고정하면 더 이상 이동할 수 없다. 따라서 `Pin<Box<SomeType>>`의 경우 런타임은 `Box` 포인터가 아니라(힙에 저장된) `SomeType` 값을 실제로 고정한다.
![Moving a `Box` which points to a self-referential future type.](https://doc.rust-lang.org/book/img/trpl17-07.svg)

`Unpin`은 `Send`와 `Sync` 트레이트와 유사한 마커 트레이트이다(컴파일러는 안전함을 증명할 수 있는 모든 타입에 대해 `Unpin`을 자동으로 구현한다). 마커 트레이트는 주어진 트레이트를 구현하는 타입을 특정 컨텍스트에서 사용하는 것이 안전하다고 컴파일러에게 알려주기 위해 존재한다. `Unpin`은 해당 값이 안전하게 이동될 수 있는지에 대한 어떤 보장도 유지할 필요가 없음을 컴파일러에게 알린다.

`Stream`: 시간이 지남에 따라 준비되는 일련의 항목을 나타내기 위해, 이러한 기능들을 함께 모은 `Stream` 트레이트를 정의한다.
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

`Future`/`Pin`/`Stream` 트레이트에 대한 더 자세한 구현 내용은 [A Closer Look at the Traits for Async](https://doc.rust-lang.org/book/ch17-05-traits-for-async.html)를 참고하라.


## Part 16 패턴과 매치
### 16.1 모든 패턴
1. `match`: `match` 표현식은 *철저해야* 하며, `match` 표현식의 값에 대한 모든 가능성이 고려되어야 한다.
   ```rust
    match x {
        None => None,
        Some(i) => Some(i + 1),
    }
    ```
2. `if let`: 컴파일러가 철저함을 검사하지 않는다.
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

### 16.2 반박 가능성
패턴은 반박 가능(refutable)과 반박 불가능(irrefutable)의 두 가지 형태로 나뉜다. 전달된 모든 가능한 값에 대해 매치되는 패턴은 반박 불가능하다.
```rust
let x = 5; // irrefutable: x can match any value

let Some(x) = a_value; // refutable: if a_value is None, then match failed
```
함수 매개변수, `let` 문, `for` 루프는 반박 불가능한 패턴만 받아들일 수 있다.
`if let`과 `while let` 표현식, 그리고 `let...else` 문은 반박 가능한 패턴과 반박 불가능한 패턴을 모두 받아들인다.

더 많은 패턴 문법은 [Pattern Syntax](https://doc.rust-lang.org/book/ch19-03-pattern-syntax.html)를 참고하라.

## Part 17 고급 기능
### 17.1 unsafe
`unsafe`는 다음과 같은 초능력을 제공한다<sup>[3]</sup>:
- 원시 포인터 역참조
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
- unsafe 함수나 메서드 호출
  ```rust
    unsafe fn dangerous() {}

    unsafe {
        dangerous();
    }
  ```
  unsafe 코드 위에 안전한 추상화 만들기:
  ```rust
    let mut v = vec![1, 2, 3, 4, 5, 6];

    let r = &mut v[..];

    let (a, b) = r.split_at_mut(3);

    assert_eq!(a, &mut [1, 2, 3]);
    assert_eq!(b, &mut [4, 5, 6]);
  ```
  extern 함수 호출:
  ```rust
    unsafe extern "C" {
        safe fn abs(input: i32) -> i32;
    }

    fn main() {
        println!("Absolute value of -3 according to C: {}", abs(-3));
    }
  ```
- 가변 정적 변수 접근 또는 수정
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
- unsafe 트레이트 구현
  ```rust
    unsafe trait Foo {
        // methods go here
    }

    unsafe impl Foo for i32 {
        // method implementations go here
    }
  ```
- `union`의 필드 접근: 유니언은 주로 C 코드의 유니언과 인터페이스하기 위해 사용된다. Rust는 유니언 인스턴스에 현재 저장된 데이터의 타입을 보장할 수 없기 때문에 유니언 필드 접근은 unsafe하다

### 17.2 고급 트레이트
*연관 타입*(Associated types)은 타입 자리 표시자를 트레이트와 연결하여 트레이트 메서드 정의가 시그니처에서 이러한 자리 표시자 타입을 사용할 수 있게 한다.

연관 타입과 제네릭의 차이: 연관 타입 트레이트는 한 번만 구현할 수 있지만, 제네릭 트레이트는 각 타입에 대해 구현할 수 있다

연산자 오버로딩: Rust는 연산자를 만들거나 임의의 연산자를 오버로드하는 것을 허용하지 않는다. 하지만 연산자와 관련된 트레이트를 구현하여 `std::ops`에 나열된 연산과 해당 트레이트를 오버로드할 수 있다.
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

기본 제네릭 타입: `Rhs`(right-hand side)
```rust
trait Add<Rhs=Self> {
    type Output;

    fn add(self, rhs: Rhs) -> Self::Output;
}
```

같은 이름의 메서드를 호출할 때:
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

메서드가 아닌 연관 함수에 `self` 매개변수가 없는 경우:
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

어떤 타입이 첫 번째 트레이트를 구현하도록 하고 그 타입이 두 번째 트레이트도 구현하도록 요구하려면: `trait <trait_1>: <trait_2>`
```rust
use std::fmt;

trait OutlinePrint: fmt::Display {
    fn outline_print(&self) {
        // snip
    }
}
```

***뉴타입 패턴***(newtype pattern): *고아 규칙*(orphan rule)은 트레이트나 타입, 또는 둘 다 우리 크레이트에 로컬인 경우에만 타입에 트레이트를 구현할 수 있게 한다. 새 타입이 내부 타입이 가진 모든 메서드를 가지기를 원한다면, Wrapper에 `Deref` 트레이트를 구현하여 내부 타입을 반환하는 것이 해결책이 될 수 있다.
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

### 17.3 고급 타입
타입 별칭: 단지 별칭일 뿐, 새로운 타입이 아니다
```rust
type Kilometers = i32;

let x: i32 = 5;
let y: Kilometers = 5;

println!("x + y = {}", x + y);
```

*never 타입*: `!`이며, 값이 없다. `let ... match` 갈래에서처럼(컴파일러가 어떤 타입의 값인지 알 수 있도록 같은 타입을 반환해야 한다):
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

*동적 크기 타입*(dynamically sized types)의 규칙은 동적 크기 타입의 값을 항상 어떤 종류의 포인터 뒤에 두어야 한다는 것이다.

### 17.4 고급 함수와 클로저
함수 포인터: 새로운 함수가 아닌 일반 함수를 함수에 전달한다
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

클로저 반환: `returns_closure`와 `returns_initialized_closure`는 둘 다 `impl Fn(i32) -> i32`를 반환하지만 같은 타입이 될 수 없다. `impl Trait`를 반환할 때마다 Rust는 고유한 불투명 타입(opaque type)을 생성한다.
```rust
fn returns_closure() -> impl Fn(i32) -> i32 {
    |x| x + 1
}

fn returns_initialized_closure(init: i32) -> impl Fn(i32) -> i32 {
    move |x| x + init
}
```

### 17.5 매크로
매크로와 함수의 차이:
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

공통점:
1. 매크로와 함수는 논리를 캡슐화하고 코드 중복을 줄이는 데 사용될 수 있다