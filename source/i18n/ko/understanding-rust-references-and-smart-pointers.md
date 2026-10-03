---
title: Rust의 참조와 스마트 포인터 이해하기
category: Tech
tag: Rust
date: 2026-03-27T12:56:04+08:00
---


## Part 1 Rust에는 왜 여러 종류의 포인터가 있을까?
Rust 입문자에게는 정말 혼란스러운 점입니다: Rust에는 왜 이렇게 많은 종류의 포인터가 있을까?
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

포인터는 메모리를 마음대로 제어하고 수정할 수 있는 매우 강력한 도구입니다.

때로는 개발자가 러시아 인형처럼 *포인터 조합*을 사용해야 하는데, 서로 중첩된 기묘한 형태를 만들게 되어 마치 마법사의 낙서처럼 됩니다. 이진 트리에서의 `Arc<Mutex<Vec<Rc<RefCell<T>>>>>` 같은 경우가 그렇습니다. 그렇다면 `&T`와 `Box<T>`의 차이는 무엇일까요? 또는 동시성 안전성을 위해 `Mutex`, `Arc`, `RefCell`은 어떻게 다를까요?

이 질문에 답하기 전에, 다른 언어에서는 포인터가 어떤 모습인지 살펴봅시다. 다른 언어에서는 보통 하나 또는 두 가지 포인터 형태만 존재합니다. C 언어의 포인터처럼요:

Raw 포인터는 *자유롭게 복사*되고, *마음대로 수정*되며, *어디든 가리킬* 수 있습니다.
```c
int a = 10; 
int * p = &a; 

*p = 20; 
```

Raw 포인터는 너무 강력해서, 사용자가 작은 실수만 해도 메모리 불안전성을 초래할 수 있습니다. 다음 예제들은 잠재적인 메모리 안전성 문제를 보여줍니다.
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

또한 GC 언어는 자동 *가비지 컬렉션*으로 이러한 문제를 해결할 수 있지만, **더 단순한 메모리 모델은 성능 타협이라는 대가를 치릅니다.**

Rust는 성능을 타협하지 않으면서 메모리 안전성을 보장하는 것을 목표로 하므로, 다양한 목적을 위한 일련의 "포인터 타입"이 존재합니다. Rust에는 완전한 메모리 안전성 모델이 있습니다: **소유권(Ownership)**, **대여 검사(Borrowing Check)**, **스마트 포인터(Smart Pointer)**, **내부 가변성(Interior Mutability)**.
- *GC* 없음
- 메모리 불안전성 없음
- 실수를 가능한 한 런타임으로 지연시키지 않고, 컴파일 중에 문제를 찾으려 함

## Part 2 Raw 포인터와 Unsafe
Rust에도 raw 포인터가 있습니다: `*const T`와 `*mut T`. C/C++와 마찬가지로, raw 포인터는 (이전 파트에서 언급한 것처럼) 잠재적인 문제를 일으킬 수 있습니다.

> Unsafe Rust가 존재하는 이유는, 본질적으로 정적 분석이 보수적이기 때문입니다.

컴파일러가 코드가 보장을 준수하는지 판단하려고 할 때, 일부 유효한 프로그램(코드가 괜찮을 수 있음)을 거부하는 것이 일부 유효하지 않은 프로그램을 수용하는 것보다 낫습니다. 분명히 컴파일러 입장에서는 raw 포인터 사용이 안전한지 판단하기 어려운 시나리오가 있습니다.
```rust
let mut x = 10;

let p1 = &mut x as *mut i32;
let p2 = &mut x as *mut i32;

unsafe {
    *p1 = 20;
    *p2 = 30; // maybe incur UB
}
```

## Part 3 Rust 참조와 대여
Rust의 여러 포인터 타입을 소개하기 전에, Rust의 참조(`&T`)와 가변 참조(`&mut T`)를 살펴봅시다. 이것은 Rust가 메모리 안전성을 보장하는 가장 기본적인 메커니즘입니다.

### 2.1 &T
C에서 유사한 개념은 포인터입니다:
```c
int x = 10;
int* p = &x;
printf("%d\n", *p);
```
Rust는 대여(borrowing)라는 개념을 도입하여, `&T`는 `불변` 대여를 나타냅니다. `&`는 소유권을 이전하지 않으며, 컴파일러는 컴파일 시점에 수명을 검사하여 참조가 댕글링되지 않도록 합니다.
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
설계 원칙:
- 댕글링 포인터 방지: 대여는 참조 대상의 유효 기간 내에 이루어져야 합니다.
- 데이터 안전성 보장: 컴파일러는 불변 대여 기간 동안 원래 값을 수정할 수 없도록 합니다.
- 런타임 오버헤드 제로: 참조는 *컴파일 타임 개념*이며, GC나 런타임 검사가 필요하지 않습니다.

### 2.2 &mut T
C에서 포인터는 본질적으로 메모리에서 가리키는 값을 수정할 수 있는 힘을 가집니다. 가장 흔한 문제는 **데이터 레이스**입니다.
```c
int x = 10;
int* p1 = &x;
int* p2 = p1;
*p1 = 20;
*p2 = 30;
printf("%d\n", *p1); // expect 20, but get 30
```
Rust는 가변 대여를 나타내는 `&mut T`를 사용합니다. 컴파일러는 한 번에 하나의 가변 참조만 존재할 수 있도록 보장합니다.
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
Rust는 "여러 불변 대여 또는 하나의 가변 대여"를 강제하여 데이터 레이스가 컴파일 타임에 제거되도록 합니다. 단일 스레드 환경에서는 이 규칙만으로 메모리 안전성을 보장하기에 충분합니다.

### 2.3 역참조
역참조(`*T`)는 참조가 가리키는 값에 접근하는 것을 의미합니다. 구조체가 이미 `Deref` 트레이트를 구현했다면, Rust가 자동으로 역참조를 처리합니다.
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
> `Box<T>`는 사용자가 데이터를 스택이 아닌 힙에 저장할 수 있게 해줍니다.

`&T`와 `&mut T`는 실제로 *대여*이며, 이는 객체의 소유권을 가지지 않는다는 것을 의미합니다. 반대로, 객체에 대한 완전한 소유권을 가지는 추상화는 `Box<T>`입니다.
```rust
fn main() {
    let b1 = Box::new(10);
    let b2 = b1; // move

    // println!("{}", b1); // compile err
}
```

`Box<T>`는 자동 해제, 유일한 객체 소유권, GC 없음이라는 특징을 가집니다.
- 자동 해제: 이중 해제 방지
- 유일한 소유권: 해제 후 사용 방지
- GC 없음: 성능 오버헤드 제로

그러면 사용자는 언제 `Box`를 사용하여 데이터를 저장해야 할까요? 주로 다음과 같은 상황에서 사용합니다:
- 컴파일 타임에 크기를 알 수 없는 타입이지만 컨텍스트가 정확한 크기를 필요로 하는 경우.
  일부 재귀 타입의 경우, Rust는 값이 얼마나 많은 공간을 필요로 하는지 알 수 없습니다. Box는 알려진 크기를 가지므로, 재귀 타입 정의에 Box를 삽입하여 재귀 타입을 활성화할 수 있습니다.
  ```rust
  struct Node {
    next: Node // compile err 
  }


  struct Node {
    next: Option<Box<Node>> // compile success
  }
  ```
- 데이터를 복사하는 대신 큰 데이터의 소유권을 이전하는 경우.
  ```rust
  let large = Box::new([0; 10_000_000]);
  let large_new = large; // not copy, but transfer
  ```
- 트레이트만 알 뿐 구체적인 타입을 확신할 수 없는 값을 유지하는 경우.
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


|     | raw 포인터      | `Box<T>` |
| --- | ---------- | ------------- |
| 힙 메모리 | malloc/new | Box::new      |
| 해제  | 수동         | 자동 drop       |
| 소유권 | 다중 소유        | 유일한 소유         |
| 안전성 | 런타임 에러       | 컴파일 타임 에러        |


`Box`가 raw 포인터로 변환될 수 있는 본질적인 이유는, `Box`가 raw 포인터를 소유하는 유일한 존재이며 Drop 트레이트를 구현하기 때문입니다.
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

`Drop` 트레이트 외에도, 또 다른 매우 중요한 트레이트는 `Deref`이며, 이 두 트레이트는 나중에 다룰 것입니다.

## Part 5 Rc<T>, Arc<T>, Weak<T>
다중 소유권을 명시적으로 활성화하기 위해, 개발자는 Rust에서 `Rc<T>`(*참조 카운팅*)를 사용해야 합니다. `Rc<T>` 타입은 값에 대한 참조 수를 추적하여 값이 여전히 사용 중인지 판단합니다. 값에 대한 참조가 0개라면, 참조가 무효화되지 않고 값이 정리될 수 있습니다.

가장 흔한 장면은 `b -> a; c -> a;`처럼 연결 리스트에서 데이터를 공유하는 것입니다.
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

`Rc::clone`은 `T.clone`과 다르다는 점에 주목하세요. `Rc::clone`의 구현은 대부분의 타입에서 clone 구현이 하는 것처럼 모든 데이터를 깊은 복사하지 않습니다. `Rc::clone` 호출은 참조 카운트만 증가시키며, 이는 더 나은 성능을 가지며 *성능 문제를 일으키지 않습니다*. `Rc<T>`는 불변 데이터만 유지하며, 가변 공유가 필요하다면 `Rc<RefCell<T>>`를 사용하세요.

> `Rc`는 재귀 참조로 인해 **메모리 누수**를 일으킬 수 있습니다. 다음 경우에서 `parent`와 `child`는 재귀 참조입니다. 둘 다 참조 카운트가 절대 0이 되지 않아 메모리 누수가 발생합니다.
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

Rust에서 `Rc::clone` 호출은 `Rc<T>` 인스턴스의 *strong_count*를 증가시키며, `Rc<T>` 인스턴스는 *strong_count*가 0일 때만 정리됩니다. 강한 참조는 `Rc<T>` 인스턴스의 소유권을 공유하는 방법입니다. `Weak` 참조는 소유권 관계를 표현하지 않으며, 그 카운트는 `Rc<T>` 인스턴스가 정리되는 시점에 영향을 주지 않습니다. `Rc::downgrade` 호출은 weak_count를 1 증가시킵니다.
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

`Arc<T>`는 멀티스레딩 환경에서의 구현입니다.
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
Rust에는 특별한 요구사항도 있습니다: 데이터가 이동되는 것을 방지하는 것입니다. 이는 자기 참조 구조, 비동기 Future, 저수준 운영체제 인터페이스에서 매우 흔합니다. Rust는 이 문제를 해결하기 위해 `Pin<T>`를 제공합니다.

문제 장면을 고려해봅시다: 여기에 구조체(SelfRef)가 있고 그 필드 중 하나가 자신의 다른 데이터에 대한 참조를 가리키며, 어느 시점에 SelfRef가 힙 밖으로 또는 새로운 힙 위치로 이동하면 **댕글링 포인터**가 발생합니다.
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

`Pin<T>`는 힙에 있는 값을 메모리에 고정하여 이동할 수 없게 하며, 자기 참조 구조에 적합하고 다른 힙 포인터(`Box`/`Arc` 등)와 함께 사용해야 합니다.
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

> `Pin`은 본질적으로 기존 포인터에 대한 의미적 제약이며, 할당 방식의 변경이 아닙니다. 컴파일러에게 *값 이동을 금지*하도록 지시하며, 컴파일러는 타입 시스템에서 이를 강제합니다. 따라서 `Pin`은 추가적인 성능 비용이 없습니다.

`Pin<T>`는 비동기 프로그래밍에서 자주 사용됩니다. Rust 비동기 프로그래밍에서 Future는 메모리에 유지되어야 합니다:
- `Future`는 자기 참조 상태를 포함할 수 있습니다.
- `async/await` 문법으로 생성된 상태 머신은 스택에서 이동할 수 있습니다.

## Part 7 포인터 표
| 스마트 포인터 | 스레드 안전성           | 소유권       | 가변성                | 고정 여부               | 순환 가능성                   | 일반적인 사용 사례                                               |
| ------------- | --------------------- | --------------- | ------------------------- | -------------------- | ----------------------------- | -------------------------------------------------------------- |
| `Box<T>`      | 단일 스레드         | 유일한 소유          | 가변 (`&mut`)          | 이동 가능              | 아니오                            | 힙 할당, 재귀 타입, 트레이트 객체, 큰 객체 |
| `Rc<T>`       | 단일 스레드         | 다중 소유자 | 불변                 | 이동 가능              | 순환 시 누수 가능            | 단일 스레드 공유 소유권, 트리 구조                |
| `RefCell<T>`  | 단일 스레드         | 대여        | 가변 (런타임 검사) | 이동 가능              | 아니오                            | 내부 가변성, 종종 `Rc<T>`와 함께 사용               |
| `Arc<T>`      | 멀티 스레드          | 다중 소유자 | 불변                 | 이동 가능              | 순환 시 누수 가능            | 멀티 스레드 공유 소유권, 캐싱, 전역 데이터            |
| `Mutex<T>`    | 멀티 스레드          | 다중 소유자 | 가변 (락 보호)  | 이동 가능              | 아니오                            | 스레드 간 공유 가변 상태                            |
| `RwLock<T>`   | 멀티 스레드          | 다중 소유자 | 가변 (읽기/쓰기 락) | 이동 가능              | 아니오                            | 읽기가 많고 쓰기가 드문 공유 가변 상태       |
| `Weak<T>`     | 단일 / 멀티 스레드 | 비소유      | 불변                 | 이동 가능              | 아니오                            | 참조 순환 끊기 (`Rc`/`Arc`와 Weak)               |
| `Pin<Box<T>>` | 단일 스레드         | 유일한 소유          | 가변                   | 고정 (이동 불가) | 아니오                            | 자기 참조 구조, 비동기 `Future`, 힙 고정 데이터      |
| `Pin<Rc<T>>`  | 단일 스레드         | 다중 소유자 | 불변                 | 고정               | 순환 방지를 위해 Weak 사용 필요 | 공유 자기 참조 구조 (단일 스레드)             |
| `Pin<Arc<T>>` | 멀티 스레드          | 다중 소유자 | 불변                 | 고정               | 순환 방지를 위해 Weak 사용 필요 | 공유 자기 참조 구조 (멀티 스레드)              |

> - 가변성: 포인터를 통해 내부 값을 수정할 수 있는지 여부
> - 고정: 이동이 금지되는지 여부
> - 순환 가능성: 메모리 누수를 일으키는가?

**사용 권장 사항**:
1. 단일 스레드 시나리오
  단독 소유 → `Box<T>`
  다중 소유자, 불변 → `Rc<T>`
  다중 소유자가 변경 가능 → `Rc<RefCell<T>>`
  자기 참조 구조 → `Pin<Box<T>>` 또는 `Pin<Rc<T>>`
2. 멀티스레드 시나리오
  단독 소유 변경 가능 → `Box<T>`(스레드 간 통신에는 Send가 필요)
  다중 소유자, 불변 → `Arc<T>`
  다중 소유자가 변경 가능 → `Arc<Mutex<T>>` 또는 `Arc<RwLock<T>>`
  자기 참조 구조 → `Pin<Arc<T>>`
3. 순환 참조
  단일 스레드 → `Rc<T>` + `Weak<T>`
  멀티스레딩 → `Arc<T>` + `Weak<T>`
4. 비동기/자기 참조 구조
  Future/Async 상태 머신 → `Pin<Box<dyn Future<...>>>`
  자기 참조 구조 (트리, 연결 리스트) → `Pin<Box<T>>` 또는 `Pin<Rc<T>>`

링크:
- [Rust std API](https://doc.rust-lang.org/stable/std/index.html)
- [Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)