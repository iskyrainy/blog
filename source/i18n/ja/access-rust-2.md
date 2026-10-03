---
title: Rustを学ぶ 2
category: Tech
tag: Rust
date: 2025-06-16T00:27:12+08:00
---


# Rustを学ぶ-2
## Part 10 テスト
関数をテスト関数に変えるには、`fn` の前の行に `#[test]` を追加します。結果は `assert!`/`assert_eq!`/`assert_ne!` マクロで確認します。
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

`#[should_panic]` が付いたテストは、関数内のコードがパニックを起こせば合格し、パニックを起こさなければ失敗します。
デフォルトでは `cargo test` はマルチスレッドでテストを実行します。スレッド数は `cargo test -- --test-threads=[num]` で設定します。
`cargo test -- --show-output` を使うと合格したテストの出力を表示します。`cargo test [str]` は名前に [str] を含む指定したテストを実行します。`#[ignore]` は、`cargo test` の実行時には無視されるが、`cargo test -- --ignored` では実行されることを示します。

`#[cfg]` は *configuration* の略で、後に続く項目が特定の構成オプションが与えられた場合にのみ含まれるべきであることを示します。例えば `#[cfg(test)]` ブロックは `cargo test` によってのみ含まれます。


## Part 11 関数型言語の機能
クロージャ: 匿名関数
クロージャの定義では、コンパイラは各引数と戻り値に対して1つの具体的な型を推論します。
```rust
let example_closure = |x| x;

let s = example_closure(String::from("hello")); // xの型はStringと推論される
let n = example_closure(5); // Stringを期待するが整数が渡されたのでここでパニック
```

クロージャの本体がまだ不変参照しか必要としていなくても、クロージャ定義の先頭に `move` キーワードを置くことで、`list` がクロージャにムーブされるべきであることを指定する必要があります。新しいスレッドはメインスレッドの残りが終わる前に終了するかもしれませんし、メインスレッドが先に終了するかもしれません。もしメインスレッドが list の所有権を保持したまま新しいスレッドより先に終了し list をドロップすると、スレッド内の不変参照は無効になってしまいます。
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

クロージャのトレイト:
- `FnOnce`: キャプチャした値を本体の外にムーブするクロージャは `FnOnce` のみを実装し、他の `Fn` トレイトは実装しません。一度しか呼び出せないからです。すべてのクロージャは少なくともこのトレイトを実装します。
- `FnMut`: キャプチャした値を本体の外にムーブしないが、キャプチャした値を変更する可能性があるもの。
- `Fn`: キャプチャした値を本体の外にムーブせず、キャプチャした値も変更せず、環境から何もキャプチャしないクロージャ。

## Part 12 Cargo
### 12.1 ビルド
`cargo build`: *dev* プロファイルでビルド
`cargo build --release`: *release* プロファイルでビルド

`opt-level` は Rust がコードに適用する最適化の数を制御し、範囲は0から3です。高いレベル(3)はコードのコンパイルに時間がかかりますが、より高速な成果物が得られます:
```rust
[profile.dev]
opt-level = 0

[profile.release]
opt-level = 3
```

### 12.2 ドキュメントの追加とクレートの公開
`cargo doc` はプロジェクトのドキュメントを生成し(ドキュメンテーションコメントはスラッシュ3つ、`///` を使用します)、`cargo doc --open` は生成された index.html をブラウザで開きます(wsl で開く場合は `wslview` がインストールされていることを確認してください)。

`pub use` を使って項目を再エクスポートすることで、プライベートな構造とは異なる公開構造を作ることができます。

1. [crates.io](https://crates.io) で API トークンを作成し、コマンドラインで `cargo login` を実行してログインします
2. *description, license, license-file, documentation, homepage or repository* などのクレート情報を設定し、`cargo publish` でクレートを公開します
3. cargo は公開済みのバージョンを削除することを許可しません。ただし `cargo yank --vers [x.x.x]` でバージョンを非推奨としてマークできます。yank とは、*Cargo.lock* を持つすべてのプロジェクトが壊れず、将来生成される *Cargo.lock* ファイルは yank されたバージョンを使用しないことを意味します。コマンドに --undo を追加すると、yank を元に戻してプロジェクトが再びそのバージョンに依存できるようにすることもできます。例えば `cargo yank --vers [x.x.x] --undo` のようにします。

### 12.3 ワークスペースの使用
ワークスペースディレクトリに移動し、以下の内容で `Cargo.toml` を作成します:
```rust
[workspace]
resolver = "3"
```
次に `cargo new` を使ってバイナリクレートを作成します。ワークスペースには最上位に1つの target ディレクトリがあり、コンパイルされた成果物がそこに置かれます。

Cargo はワークスペース内のクレートが互いに依存することを前提としていないため、依存関係を明示する必要があります。
```rust
[dependencies]
add_one = { path = "../add_one" }
```

`-p [crate_name]` でワークスペース内のどのパッケージを実行するかを指定します。ワークスペースには最上位に1つの Cargo.lock ファイルしかなく、各クレートのディレクトリに Cargo.lock があるわけではないことに注意してください。これにより、すべてのクレートがすべての依存関係の同じバージョンを使用することが保証されます。

### 12.4 crates.io からのバイナリのインストール
`cargo install` はバイナリ(クレートに src/main.rs ファイルがある場合、またはバイナリとして指定された別のファイルがある場合に作成される実行可能なプログラムであり、単独では実行できないが他のプログラムに含めるのに適したライブラリターゲットとは対照的です)をローカルにインストールします。
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
### 12.5 カスタムコマンドによる cargo の拡張
Cargo は、変更を加えることなく新しいサブコマンドで拡張できるように設計されています。$PATH にあるバイナリが cargo-something という名前であれば、`cargo something` を実行することで Cargo サブコマンドのように実行できます。このようなカスタムコマンドは `cargo --list` を実行したときにも一覧表示されます。cargo install を使って拡張機能をインストールし、組み込みのものと同じように実行できるのです。

## Part 13 スマートポインタ
スマートポインタは `Deref` と `Drop` トレイトを実装しています。
- `Deref`: スマートポインタ構造体のインスタンスが参照のように振る舞うことを可能にします
- `Drop`: スマートポインタのインスタンスがスコープを外れたときに実行されるコードをカスタマイズできます

`std` のスマートポインタの一部:
- `Box<T>`: ヒープに値を割り当てるためのもの
- `Rc<T>`: 複数の所有権を可能にする参照カウント型
- `Ref<T>`/`RefMut<T>`: `RefCell<T>` を通じてアクセスされ、コンパイル時ではなく実行時に借用規則を強制する型

### 13.1 Box<T>
`Box<T>` はスタックではなくヒープにデータを格納することを可能にし、スタックにはポインタのみを格納します。
`Box<T>` は主に以下の状況で使われます:
- コンパイル時にサイズが判明しない型があり、その型の値を正確なサイズを必要とする文脈で使いたい場合: 例えば *再帰型* を *非再帰型* に変える<sup>[1]</sup>
- 大量のデータがあり、所有権を移転したいがその際にデータがコピーされないことを保証したい場合
- 値を所有し、特定の型であることよりも特定のトレイトを実装している型であることだけを気にする場合

### 13.2 Deref/Drop トレイト
Deref トレイトを実装することで、*参照外し演算子* `*` の振る舞いをカスタマイズできます。`*y` と書いたとき、Rust の内部では実際に `*(y.deref())` が実行されていました。

Rust はインスタンスがスコープを外れると自動的に `drop` を呼び出していました。

### 13.3 Rc<T>
Rc: *参照カウント*
値への参照がゼロになれば、参照が無効になることなく値はクリーンアップされます。

`Rc::clone` の実装は、ほとんどの型の `clone` の実装のようにすべてのデータを深くコピーするわけではありません。`Rc::clone` の呼び出しは参照カウントを増やすだけです。

### 13.4 RefCell<T>
RefCell: *内部可変性* により不変の値を変更することを可能にします。
`RefCell<T>` はマルチスレッドコードでは機能しないことに注意してください！`Mutex<T>` は `RefCell<T>` のスレッドセーフ版です。

### 13.5 メモリリーク
`Rc<T>` の値を含む `RefCell<T>` の値や、内部可変性と参照カウントを持つ型の同様のネストした組み合わせがある場合、循環を作らないようにする必要があります。Rust がそれを検出することを頼りにはできません。参照循環を作ることはプログラムの論理的なバグであり、自動テスト、コードレビュー、その他のソフトウェア開発手法を使って最小化すべきものです。
参照循環を避けるためのもう一つの解決策は、強い参照ではなく弱い参照を使うなど、データ構造を再編成することです。弱い参照は所有関係を表さず、そのカウントは `Rc<T>` インスタンスがクリーンアップされるタイミングに影響しません。弱い参照が関与する循環は、関与する値の強い参照カウントが 0 になれば破られるため、参照循環を引き起こしません。
`Weak<T>` が参照する値は既にドロップされている可能性があるため、`Weak<T>` が指す値で何かをするにはその値がまだ存在することを確認する必要があります。これは `Weak<T>` インスタンスの `upgrade` メソッドを呼び出すことで行い、`Option<Rc<T>>` を返します。

参照循環を引き起こさないツリーノードの例:
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

## Part 14 並行性
所有権と型チェックを活用することで、多くの並行性エラーは実行時エラーではなく Rust ではコンパイル時エラーになります。

Rust 標準ライブラリはスレッド実装の 1:1 モデルを使用しており、プログラムは言語スレッドごとに 1 つのオペレーティングシステムスレッドを使用します。

### 14.1 チャネル
`mpsc::channel` 関数(mpsc: *multiple producer, single consumer*、複数生産者・単一消費者)はタプルを返し、その最初の要素は送信側(トランスミッタ)で、2番目の要素は受信側(レシーバ)です。
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

### 14.2 共有状態の並行性
チャネルは単一所有権に似ており、値がチャネルを通じて転送されると、その値に変更があってはならないことになります。
共有メモリの並行性は複数所有権に似ています: 複数のスレッドが同時に同じメモリ位置にアクセスできます。

`Mutex<T>` はスマートポインタです。lock の呼び出しは `MutexGuard` と呼ばれるスマートポインタを返し、これは unwrap の呼び出しで処理した `LockResult` に包まれています。`MutexGuard` スマートポインタは内部データを指すように `Deref` を実装しています。このスマートポインタはまた `Drop` 実装を持ち、`MutexGuard` がスコープを外れたときに自動的にロックを解放します。これは内部スコープの終わりに起こります。
`Mutex<T>` は不変ですが、その内部の値への可変参照を得ることができます。`Mutex<T>` は `Cell` ファミリーと同様に内部可変性を提供します。
```rust
use std::sync::Mutex;

fn main() {
    let m = Mutex::new(5);

    {
        let mut num = m.lock().unwrap();
        *num = 6; // * によって参照外し
    } // 自動的にロックを解放

    println!("m = {m:?}");
}
```

スレッド間で安全に共有することを保証するには `Rc<T>` ではなく `Arc<T>` を使います。
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

### 14.3 拡張可能な並行性
並行性の扱いは言語や標準ライブラリに限定されません。標準ライブラリではなく言語に組み込まれている主要な並行性の概念の中には、`std::marker` トレイトの `Send` と `Sync` があります<sup>[2]</sup>。
- `Send`: `Send` を実装する型の値の所有権がスレッド間で転送できることを示します。完全に `Send` な型で構成される型は自動的に `Send` としてマークされます。
- `Sync`: `Sync` を実装する型が複数のスレッドから参照されても安全であることを示します。完全に `Sync` を実装する型で構成される型も `Sync` を実装します。

## Part 15 非同期プログラミング
`await`: 後置キーワードで、メソッドのチェーンを簡単に作れます。
```rust
let response_text = trpl::get(url).await.text().await;
```

Rust が `async` キーワードでマークされたブロックを見ると、それを `Future` トレイトを実装する一意で匿名のデータ型にコンパイルします。Rust が `async` でマークされた関数を見ると、本体が async ブロックである非 async 関数にコンパイルします。async 関数の戻り値の型は、コンパイラがその async ブロックのために作成する匿名データ型の型です。
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

各 *`await`* ポイントは、制御がランタイムに戻される場所を表します。Rust には目に見えない状態機械があり、コンパイラは隣接する状態間の安全性を保証します。

`Future`: `await` を使うコードを見ると、Rust はそれを内部的に特別な `loop` の中で `poll` を呼び出すコードにコンパイルします。Rust は、その `loop` がこの future の作業を一時停止して他の future の作業を行い、後でこれを再びチェックできるものに制御を渡せることを保証します。
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
自己参照データ型を持つ可能性があるオブジェクトの場合(デフォルトでは、自身への参照を持つオブジェクトはムーブするのが安全ではありません)。
![自己参照データ型をムーブした場合の安全でない結果](https://doc.rust-lang.org/book/img/trpl17-05.svg)

その値へのポインタを `Pin` で包むことで値をピン留めすると、もはやムーブできなくなります。したがって、`Pin<Box<SomeType>>` の場合、ランタイムは実際に(ヒープに格納された)`SomeType` の値をピン留めし、`Box` ポインタをピン留めするのではありません。
![自己参照 future 型を指す `Box` をムーブする。](https://doc.rust-lang.org/book/img/trpl17-07.svg)

`Unpin` はマーカートレイトで、`Send` や `Sync` トレイトに似ています(コンパイラは安全であることを証明できるすべての型に対して自動的に `Unpin` を実装します)。マーカートレイトは、特定のトレイトを実装する型を特定の文脈で使うのが安全であることをコンパイラに伝えるためだけに存在します。`Unpin` は、対象の値を安全にムーブできるかどうかについての保証を維持する必要がないことをコンパイラに通知します。

`Stream`: 時間とともに準備が整う項目のシーケンスを表現するために、これらの機能をまとめた `Stream` トレイトを定義します。
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

`Future`/`Pin`/`Stream` トレイトのより詳細な実装については [A Closer Look at the Traits for Async](https://doc.rust-lang.org/book/ch17-05-traits-for-async.html) を参照してください。


## Part 16 パターンとマッチ
### 16.1 すべてのパターン
1. `match`: `match` 式は *網羅的* である必要があり、`match` 式の値のすべての可能性が考慮されなければなりません。
   ```rust
    match x {
        None => None,
        Some(i) => Some(i + 1),
    }
    ```
2. `if let`: コンパイラは網羅性をチェックしません。
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

### 16.2 反駁可能性
パターンには反駁可能と反駁不能の2つの形式があります。渡されたどの可能な値にもマッチするパターンは反駁不能です。
```rust
let x = 5; // 反駁不能: x は任意の値にマッチできる

let Some(x) = a_value; // 反駁可能: a_value が None ならマッチは失敗する
```
関数の引数、`let` 文、`for` ループは反駁不能なパターンしか受け入れられません。
`if let` と `while let` 式、および `let...else` 文は反駁可能と反駁不能の両方のパターンを受け入れます。

その他のパターン構文については [Pattern Syntax](https://doc.rust-lang.org/book/ch19-03-pattern-syntax.html) を参照してください。

## Part 17 高度な機能
### 17.1 unsafe
`unsafe` は以下の能力を含む超能力を提供します<sup>[3]</sup>:
- 生ポインタを参照外しする
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
- unsafe な関数やメソッドを呼び出す
  ```rust
    unsafe fn dangerous() {}

    unsafe {
        dangerous();
    }
  ```
  unsafe なコードの上に安全な抽象を作る:
  ```rust
    let mut v = vec![1, 2, 3, 4, 5, 6];

    let r = &mut v[..];

    let (a, b) = r.split_at_mut(3);

    assert_eq!(a, &mut [1, 2, 3]);
    assert_eq!(b, &mut [4, 5, 6]);
  ```
  extern 関数を呼び出す:
  ```rust
    unsafe extern "C" {
        safe fn abs(input: i32) -> i32;
    }

    fn main() {
        println!("Absolute value of -3 according to C: {}", abs(-3));
    }
  ```
- 可変な静的変数にアクセスまたは変更する
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
- unsafe なトレイトを実装する
  ```rust
    unsafe trait Foo {
        // methods go here
    }

    unsafe impl Foo for i32 {
        // method implementations go here
    }
  ```
- `union` のフィールドにアクセスする: ユニオンは主に C コードのユニオンとやり取りするために使われます。ユニオンのフィールドへのアクセスは unsafe です。なぜなら Rust はユニオンインスタンスに現在格納されているデータの型を保証できないからです

### 17.2 高度なトレイト
*関連型* は型プレースホルダをトレイトに結びつけ、トレイトのメソッド定義がシグネチャ内でこれらのプレースホルダ型を使えるようにします。

関連型とジェネリクスの違い: 関連型のトレイトは一度しか実装できませんが、ジェネリクスのトレイトは各型に対して実装できます

演算子オーバーロード: Rust は演算子の作成や任意の演算子のオーバーロードを許可しません。ただし、`std::ops` にリストされている演算と対応するトレイトを、演算子に関連するトレイトを実装することでオーバーロードできます。
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

デフォルトのジェネリック型: `Rhs`(right-hand side、右辺)
```rust
trait Add<Rhs=Self> {
    type Output;

    fn add(self, rhs: Rhs) -> Self::Output;
}
```

同じ名前のメソッドを呼び出す場合:
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

`self` 引数を持たないメソッドではない関連関数の場合:
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

ある型が最初のトレイトを実装するために、その型が2番目のトレイトも実装することを要求する: `trait <trait_1>: <trait_2>`
```rust
use std::fmt;

trait OutlinePrint: fmt::Display {
    fn outline_print(&self) {
        // snip
    }
}
```

***newtype パターン***: *孤児ルール* はトレイトまたは型のどちらか、あるいは両方が自分のクレートにローカルである場合にのみ、型にトレイトを実装することを許可します。新しい型に内部型が持つすべてのメソッドを持たせたいなら、Wrapper に `Deref` トレイトを実装して内部型を返すのが解決策になります。
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

### 17.3 高度な型
型エイリアス: 単なるエイリアスで、新しい型ではありません
```rust
type Kilometers = i32;

let x: i32 = 5;
let y: Kilometers = 5;

println!("x + y = {}", x + y);
```

*never 型*: `!`、値を持ちません。`let ... match` のアームのように(同じ型を返さなければならないのでコンパイラは値の型を知ることができます):
```rust
let guess: u32 = match guess.trim().parse() {
    Ok(num) => num,
    Err(_) => continue, // continue は ! 値を持つので、Rust は guess が u32 型だと知る
};

impl<T> Option<T> {
    pub fn unwrap(self) -> T {
        match self {
            Some(val) => val,
            None => panic!("called `Option::unwrap()` on a `None` value"), // panic! も ! 値を持つので、Rust は val が T 型だと知る
        }
    }
}

loop {
    print!("and ever "); // ループは決して終わらないので、! が式の値になる
}
```

*動的サイズ型* のルールは、動的サイズ型の値は常に何らかのポインタの背後に置かなければならないというものです。

### 17.4 高度な関数とクロージャ
関数ポインタ: 新しい関数ではなく通常の関数を関数に渡す
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

クロージャを返す: `returns_closure` と `returns_initialized_closure` はどちらも `impl Fn(i32) -> i32` を返しますが、同じ型として扱うことはできません。`impl Trait` を返すたびに Rust は一意の不透明型を作成します。
```rust
fn returns_closure() -> impl Fn(i32) -> i32 {
    |x| x + 1
}

fn returns_initialized_closure(init: i32) -> impl Fn(i32) -> i32 {
    move |x| x + init
}
```

### 17.5 マクロ
マクロと関数の違い:
| 側面 | マクロ | 関数 |
| :-     | :-    | :-       |
| 定義    | `macro_rules!`/`proc_macro` | `fn` |
| 呼び出し   | `!` サフィックス | function_name() |
| 展開 | コンパイル時に展開 | 実行時に展開 |
| 引数  | 可変数の引数 | 固定数の引数 |
| 型チェック | なし | あり |
| 実行時コスト | なし | あり |
| コードの再利用性 | 高い再利用性 | 限定的な再利用性 |
| 保守とデバッグ | 難しい | 簡単 |

共通点:
1. マクロと関数はどちらもロジックをカプセル化し、コードの重複を減らすために使えます
2. マクロと関数はどちらもコンパイル前に定義する必要があります(マクロは