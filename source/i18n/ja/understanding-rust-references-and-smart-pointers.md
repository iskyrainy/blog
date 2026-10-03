---
title: Rustの参照とスマートポインタを理解する
category: Tech
tag: Rust
date: 2026-03-27T12:56:04+08:00
---


## Part 1 なぜRustには複数のポインタ型があるのか？
Rustの初心者にとって非常に混乱しやすい疑問です：なぜRustにはこんなに多くのポインタ型があるのか？
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

ポインタはメモリを任意に制御・変更できる非常に強力なツールです。

時に開発者はマトリョーシカのように*ポインタの組み合わせ*を使い、互いに入れ子になった奇妙な形——まるで魔法使いの落書きのような——を形成します。例えば二分木における `Arc<Mutex<Vec<Rc<RefCell<T>>>>>` のように。では `&T` と `Box<T>` の違いは何でしょうか？あるいは並行安全性のために、`Mutex`、`Arc`、`RefCell` はどう違うのでしょうか？

この問いに答える前に、他の言語ではポインタがどのようなものか見てみましょう。他の言語では、通常ポインタの形式は1つか2つしかありません。C言語のポインタのように：

生ポインタは*自由にコピー*でき、*自由に変更*でき、*どこでも指し示す*ことができます。
```c
int a = 10; 
int * p = &a; 

*p = 20; 
```

生ポインタは非常に強力で、ユーザーが少しでも考慮せずに使うとメモリの安全性を損なう可能性があります。以下の例は、潜在的なメモリ安全性の問題を示しています。
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

またGC言語は自動的な*ガベージコレクション*でこれらの問題を解決できますが、**より単純なメモリモデルはパフォーマンスの妥協という代償を伴います。**

Rustはパフォーマンスを損なわずにメモリ安全性を確保することを目指しており、そのために目的別の「ポインタ型」の一式が存在します。Rustには完全なメモリ安全モデルがあります：**所有権**、**借用チェック**、**スマートポインタ**、**内部可変性**です。
- *GC*なし
- メモリの非安全性なし
- 誤りを可能な限り実行時まで遅らせず、コンパイル時に問題を見つけるよう努める

## Part 2 生ポインタとUnsafe
Rustにも生ポインタがあります：`*const T` と `*mut T` です。C/C++と同様に、生ポインタは潜在的な問題を引き起こす可能性があります（前のパートで述べたように）。

> Unsafe Rustが存在するのは、静的解析が本質的に保守的であるためです。

コンパイラがコードが保証を守っているかどうかを判断しようとするとき、無効なプログラムを受け入れるよりも、有効なプログラム（コードが問題ないかもしれないもの）を拒否する方が良いのです。明らかに、コンパイラにとって生ポインタの使用が安全かどうかを判断するのは、いくつかのシナリオでは困難です。
```rust
let mut x = 10;

let p1 = &mut x as *mut i32;
let p2 = &mut x as *mut i32;

unsafe {
    *p1 = 20;
    *p2 = 30; // maybe incur UB
}
```

## Part 3 Rustの参照と借用
Rustの複数のポインタ型を紹介する前に、Rustの参照（`&T`）と可変参照（`&mut T`）を見てみましょう。これはメモリ安全性を確保するRustの最も基本的な仕組みです。

### 2.1 &T
C言語では、類似の概念はポインタです：
```c
int x = 10;
int* p = &x;
printf("%d\n", *p);
```
Rustは借用という概念を導入し、`&T` を使って`不変`な借用を表します。`&` は所有権を移転せず、コンパイラはコンパイル時にライフタイムをチェックして参照がダングリングしないことを保証します。
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
設計原則：
- ダングリングポインタを避ける：借用は参照される値の有効期間内で行わなければならない。
- データの安全性を確保する：コンパイラは不変借用期間中に元の値を変更できないことを保証する。
- 実行時オーバーヘッドゼロ：参照は*コンパイル時の概念*であり、GCや実行時チェックを必要としない。

### 2.2 &mut T
C言語では、ポインタは当然ながらメモリ内で指し示す値を変更する力を持っています。最も一般的な問題は**データ競合**です。
```c
int x = 10;
int* p1 = &x;
int* p2 = p1;
*p1 = 20;
*p2 = 30;
printf("%d\n", *p1); // expect 20, but get 30
```
Rustは可変借用を表す `&mut T` を使います。コンパイラは同時に1つの可変参照しか存在できないことを保証します。
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
Rustは「複数の不変借用か1つの可変借用のいずれか」を強制し、データ競合がコンパイル時に排除されることを保証します。シングルスレッド環境では、この規則はメモリ安全性を確保するのに十分です。

### 2.3 参照外し
参照外し（`*T`）とは、参照が指し示す値にアクセスすることを意味します。構造体がすでに `Deref` トレイトを実装している場合、Rustは参照外しを自動的に処理します。
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
> `Box<T>` はスタックではなくヒープにデータを格納することを可能にします。

`&T` と `&mut T` は実際には*借用*であり、オブジェクトの所有権を持たないことを意味します。逆に、オブジェクトの完全な所有権を持つ抽象化が `Box<T>` です。
```rust
fn main() {
    let b1 = Box::new(10);
    let b2 = b1; // move

    // println!("{}", b1); // compile err
}
```

`Box<T>` は自動解放、オブジェクト所有権の唯一性、GCなしという特徴を持っています。
- 自動解放：二重解放を避ける
- 唯一の所有権：解放後使用を避ける
- GCなし：ゼロパフォーマンスオーバーヘッド

では、ユーザーはいつ `Box` を使ってデータを格納すべきでしょうか？最もよく使われるのは以下の状況です：
- コンパイル時にサイズが不明な型を持つが、コンテキストが正確なサイズを必要とする場合。
  再帰的な型では、Rustは値がどれだけのスペースを必要とするか分かりません。Boxは既知のサイズを持つため、再帰的な型定義にBoxを挿入することで再帰型を可能にできます。
  ```rust
  struct Node {
    next: Node // compile err 
  }


  struct Node {
    next: Option<Box<Node>> // compile success
  }
  ```
- データをコピーするのではなく、大きなデータの所有権を移転する場合。
  ```rust
  let large = Box::new([0; 10_000_000]);
  let large_new = large; // not copy, but transfer
  ```
- トレイトのみが分かっていて、その具体的な型が確かでない値を保持する場合。
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


`Box` が生ポインタに変換できる本質は、`Box` が生ポインタを所有する唯一のものであり、Dropトレイトを実装していることです。
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

`Drop` トレイト以外に、もう1つ非常に重要なトレイトが `Deref` です。これら2つのトレイトについては後で説明します。

## Part 5 Rc<T>, Arc<T>, Weak<T>
複数の所有権を明示的に可能にするために、開発者はRustで `Rc<T>`（*参照カウント*）を使う必要があります。`Rc<T>` 型は値への参照数を追跡して、その値がまだ使用されているかどうかを判断します。値への参照がゼロになれば、参照が無効になることなく値をクリーンアップできます。

最も一般的な場面は、`b -> a; c -> a;` のように連結リストでデータを共有する場合です。
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

注意すべきは、`Rc::clone` は `T.clone` と同じではないということです。`Rc::clone` の実装は、ほとんどの型のclone実装のようにすべてのデータの深いコピーを作成しません。`Rc::clone` の呼び出しは参照カウントを増やすだけで、より良いパフォーマンスを持ち、*パフォーマンス問題を引き起こしません*。`Rc<T>` は不変データのみを保持します。可変の共有が必要な場合は `Rc<RefCell<T>>` を使います。

> `Rc` は再帰的な参照によって**メモリリーク**を引き起こす可能性があります。以下のケースでは、`parent` と `child` が相互参照しています。両方の参照カウントが決して0にならず、メモリリークを引き起こします。
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

Rustで `Rc::clone` を呼び出すと `Rc<T>` インスタンスの*strong_count*が増加し、`Rc<T>` インスタンスは*strong_count*が0になったときのみクリーンアップされます。強い参照は `Rc<T>` インスタンスの所有権を共有する方法です。`Weak` 参照は所有関係を表さず、そのカウントは `Rc<T>` インスタンスがいつクリーンアップされるかに影響しません。`Rc::downgrade` を呼び出すとweak_countが1増加します。
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

`Arc<T>` はマルチスレッド下での実装です。
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
Rustには特別な要件もあります：データのムーブを防ぐことです。これは自己参照構造体、非同期Future、低レベルのオペレーティングシステムインターフェースで非常によく見られます。Rustはこの問題を解決するために `Pin<T>` を提供しています。

問題の場面を考えてみましょう：ここに構造体（SelfRef）があり、そのフィールドの1つが自身の別のデータへの参照を指しており、ある時点でSelfRefがヒープからムーブされるか新しいヒープ位置に移されると、**ダングリングポインタ**が発生します。
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

`Pin<T>` はヒープ上でメモリに固定され、ムーブできず、自己参照構造体に適しており、他のヒープポインタ（`Box`/`Arc` など）と一緒に使う必要があります。
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

> `Pin` は本質的に既存のポインタに対する意味的な制約であり、その割り当て方法を変えるものではありません。コンパイラに*値のムーブを禁止*するよう伝え、コンパイラは型システムでこれを強制します。そのため `Pin` には追加のパフォーマンスコストはありません。

`Pin<T>` は非同期プログラミングでよく使われます。Rustの非同期プログラミングでは、Futureをメモリに保持する必要があります：
- `Future` は自己参照状態を含む可能性がある。
- `async/await` 構文で生成されるステートマシンはスタック上でムーブする可能性がある。

## Part 7 ポインタ表
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

**使用の推奨**：
1. シングルスレッドシナリオ
  単独所有 → `Box<T>`
  複数所有、不変 → `Rc<T>`
  複数所有で変更可能 → `Rc<RefCell<T>>`
  自己参照構造体 → `Pin<Box<T>>` または `Pin<Rc<T>>`
2. マルチスレッドシナリオ
  単独所有で変更可能 → `Box<T>`（スレッド間通信にはSendが必要）
  複数所有、不変 → `Arc<T>`
  複数所有で変更可能 → `Arc<Mutex<T>>` または `Arc<RwLock<T>>`
  自己参照構造体 → `Pin<Arc<T>>`
3. 循環参照
  シングルスレッド → `Rc<T>` + `Weak<T>`
  マルチスレッド → `Arc<T>` + `Weak<T>`
4. 非同期/自己参照構造体
  Future/非同期ステートマシン → `Pin<Box<dyn Future<...>>>`
  自己参照構造体（木、連結リスト）→ `Pin<Box<T>>` または `Pin<Rc<T>>`

リンク：
- [Rust std API](https://doc.rust-lang.org/stable/std/index.html)
- [Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)