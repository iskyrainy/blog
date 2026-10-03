---
title: Rust入門 1
category: Tech
tag: Rust
date: 2025-05-19T00:37:17+08:00
---


> 大学で初めてプログラミングに触れ、非GC言語（C/C++）を学んだ時を除けば、これまで手動メモリ管理を必要としない言語（Java/Go/Kotlinなど）を主に扱ってきた。そのため、以前から新しい非GC言語であるRustを試してみたいと思っていた。*AccessRust*ブログシリーズは、Rustを学ぶ中で（主に[The Rust Programming Language](https://doc.rust-lang.org/book/title-page.html)を読みながら）注意すべき点を記録するものである。🦀

# AccessRust-1

## Part 1 Rustのインストール

ここではWSL(Ubuntu)でRustをオンラインインストールする方法を示す：

1. aptの更新
   ```bash
    sudo apt upgrade
    sudo apt update
   ```

2. Rustのインストール
   ```bash
    sudo apt install gcc
    gcc -v
    # または希望するバージョンをインストール、例：rust-1.80-all など
    sudo apt install rust-all
   ```

3. ツールのインストール
   ```bash
    # 少し時間がかかる場合がある
    rustup default stable
   ```

4. 確認
   ```bash
    rustc -V
    cargo --version
    # cargoのテスト
    cargo new hello_world
    cd hello_world
    cargo run
   ```

## Part 2 基本概念
`let`：不変変数を定義する。例：`let x = 0;`
`mut`：可変変数を定義する。例：`let mut y = 1;`
`const`：定数を宣言する。`mut`と併用できない。例：`const THREE_HOURS_IN_SECONDS: u32 = 60 * 60 * 3;`
Rustでは同じ名前の変数を再定義できる。
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

データ型：
- スカラー型：整数、浮動小数点数、ブール値、文字
- 複合型：タプル、配列
  

整数：
| 長さ | 符号付き | 符号なし |
| :-: | :-: | :-: |
| 8ビット   | `i8`     | `u8`       |
| 16ビット  | `i16`    | `u16`      |
| 32ビット  | `i32`    | `u32`      |
| 64ビット  | `i64`    | `u64`      |
| 128ビット | `i128`   | `u128`     |
| arch    | `isize`  | `usize`    |

16進数：`0xff`、8進数：`0o77`、2進数：`0b1111_0000`、バイト（`u8`のみ）：`b'A'`
オーバーフローは`debug`モードではpanicエラーを引き起こすが、`release`モードでは「ラップアラウンド」する（例えば`u8`変数で257から1になる）。
浮動小数点数：`f32`/`f64`
ブール値：`bool`（`true`/`false`）
文字：`char`
タプル：例：`let tup: (i32, f64, u8) = (500, 6.4, 1);`
配列：例：`let a: [i32; 5] = [1, 2, 3, 4, 5];`

## Part 3 所有権

  スタックに格納されるすべてのデータは、既知の固定サイズでなければならない。コンパイル時にサイズが不明なデータや変更される可能性のあるサイズのデータは、代わりにヒープに格納する必要がある<sup>[1]</sup>。
所有権のルール：
- Rustの各値には*オーナー*がいる。
- 同時にオーナーは1つだけである。
- オーナーがスコープを*外れる*と、値はドロップされる。

```rust
    {
        let s = String::from("hello"); // sはこの時点から有効

        // sを使った処理

    }                                  // このスコープは終了し、sはもはや有効ではない
                                       // スコープを外れると、Rustは自動的に`drop`関数を呼び出してsのメモリを解放する
```

浅いコピーではなく**ムーブ**。
ヒープに格納されたデータについて、スコープを*外れた*後に`drop`が2回呼ばれることによるメモリ破壊を考慮し、Rustは浅いコピーをムーブに置き換える。そして**ムーブ**は非常に安価な操作である。

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

Rustには`Copy`トレイトと`Drop`トレイトがある。ある型が`Copy`トレイトを実装している場合、その変数はスタックに格納され、**ムーブ**されない。その型、またはその一部が`Drop`トレイトを実装している場合、Rustはその型が`Copy`トレイトを実装することを許可しない。

関数に関する所有権：
```rust
fn main() {
    let s = String::from("Hello, world!");
    take_ownership(s);

    println!("{}", s); // この行はコンパイルエラーを引き起こす

    let x = 5;
    make_copy(x);
    println!("{}", x); // この行はi32がCopy型であるため動作する
}

fn take_ownership(s: String) {
    println!("{}", s);
}

fn make_copy(x: i32) {
    println!("{}", x);
}
```

> 面倒な所有権管理を避けるため、Rustは所有権を移転せずに値を使用する機能を提供している。これを*参照*と呼ぶ。

Rustは`&`を使って変数を参照する参照を作成する。`&`参照はデフォルトで不変であり、所有権を渡したり返したりしない。`mut`で可変参照を作成できるが、*データ競合*を避けるため、各変数に対して同時に1つの可変参照のみが許可される。

Rustでは、同じ値に対して不変参照がある間は可変参照を持つことができない。

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

参照のルール：
- 任意の時点で、1つの可変参照か、任意の数の不変参照のいずれかを持つことができる。
- 参照は常に有効でなければならない。
  

## Part 4 構造体

インスタンス全体が可変でなければならないことに注意。Rustでは特定のフィールドだけを可変としてマークすることは許可されていない。
既存のオブジェクトから新しい構造体オブジェクトを構築し、古いオブジェクトの`Drop`トレイトを持つフィールドの一部を新しいオブジェクトにムーブすると、古いオブジェクトは無効になる。

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
        ..user1 // user1は無効
    };

    let user3 = User {
        username: String::from("example_user"),
        email: String::from("aa"),
        ..user2 // user2は有効
    }
}

struct User{
    active: bool,
    username: String,
    email: String,
    sign_in_count: u64,
}
```

Rustは*タプル構造体*と*ユニットライク構造体*をサポートしている。
```rust
struct Color(i32, i32, i32);
struct Point(i32, i32, i32);
struct AlwaysEqual; // ユニットライク構造体

fn main() {
    let black = Color(0, 0, 0);
    let origin = Point(0, 0, 0);
    let subject = AlwaysEqual;
}
```

構造体のフィールドはライフタイムフィールドであり、`username: &str`のようにすることはできない。

`impl`ブロック内で定義されたすべての関数は関連関数と呼ばれる。

## Part 5 列挙型とパターンマッチング

`Option<T>`を持っている場合にのみ、値が存在しない可能性を心配する必要があり、コンパイラは値を使用する前にそのケースを処理することを保証する。

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

**`match`のアームのパターンはすべての可能性をカバーしなければならない。**

`other`は具体的に列挙されていないすべての値をリストする。
`_`は任意の値にマッチし、その値にバインドしない。
`if let`は`match`の糖衣構文：

```rust
let mut count = 0;
if let Some(i) = index {
    println!("{}", i);
} else {
    count += 1;
}

// 以下と同じ
let mut count = 0;
match index {
    Some(i) => println!("{}", i),
    _ => count += 1,
}
```

`let else`はメイン本体のスコープ変数を作る：

```rust
fn add_one(index: Option<i32>) -> Option<i32> {
    let Some(i) = index else {
        return None;
    }
    Some(i + 1); // iは有効
}
```

## Part 6 アクセス制御
- *パッケージ*：ソフトウェアプロジェクトパッケージ。`src`、`Config.toml`、`Config.lock`などを含む。
- *クレート*：独立してコンパイル可能な単位。実行ファイル（src/main.rs）またはライブラリ（src/lib.rs）にコンパイルされる。
- *モジュール*：機能関連のコードをまとめて整理し、modで名前を付ける。1つのファイルに複数のmodを含めることができ、mod同士をネストすることもできる。`src/main.rs`と`src/lib.rs`はクレートルートである。

`pub`：モジュールとアイテムのアクセスを制御する。
```rust
mod front_of_house {
    pub mod hosting {
        fn add_to_waitlist() {}
    }
}
```

`super`：OSのファイルシステムにおける`..`と同じ。
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

`self`：OSのファイルシステムにおける`.`と同じ。
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

`use`：モジュールをインポートする。
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

**可視性の制限**：
- `pub`：可視性に制限なし
- `pub(crate)`：現在のクレート内で可視
- `pub(self)`：現在のモジュール内で可視
- `pub(super)`：親モジュール内で可視
- `pub(in <path>)`：<path>内で可視

Rustでは、すべてのアイテム（関数、メソッド、構造体、列挙型、モジュール、定数）はデフォルトで親モジュールに対してプライベートである。
モジュールの`pub`キーワードは、祖先モジュールのコードがそれを参照できるようにするだけで、内部のコードにアクセスできるようにするものではない。

## Part 7 一般的なコレクション
- `Vec`：リスト。
  ```rust
    // Vec::new()でVecを作成
    let v: Vec<i32> = Vec::new();

    // マクロvec!でVecを作成
    let v = vec![1, 2, 3];

    // 可変Vecを作成
    let mut v = Vec::new();
    v.push(5);

    // Vecから値を読み取る：インデックスまたはget()
    let v = vec![1, 2, 3, 4, 5];
    let third: &i32 = &v[2];
    println!("The third element is {third}");
    let third: Option<&i32> = v.get(2);
    match third {
        Some(third) => println!("The third element is {third}"),
        None => println!("There is no third element."),
    }

    // Vecの反復
    let mut v = vec![100, 32, 57];
    for i in &mut v {
        *i += 50;
    }
  ```
- `String`：文字列。
  ```rust
    // StringはUTF-8エンコード
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

    // Stringの反復
    for c in "Зд".chars() {
        println!("{c}");
    }
    // З д

    for b in "Зд".bytes() {
        println!("{b}");
    }
    // 208 151 208 180
  ```
- `HashMap`：マップ。
  ```rust
    // 
    use std::collections::HashMap;
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert(String::from("Blue"), 10);

    // 上書き
    scores.insert(String::from("Blue"), 20);

    // 存在しない場合に追加
    scores.entry(String::from("Blue")).or_insert(50);

    // 古い値で値を更新
    *scores.entry(String::from("Blue")).or_insert(50) += 50;
  ```

Rustは同じスコープで可変参照と不変参照を持つことを許可しない。ベクタの最初の要素への不変参照を保持しながら、末尾に要素を追加しようとすると、関数の後半でその要素を参照しようとしてもこのプログラムは動作しない。
ベクタは値をメモリ上で隣り合うように配置するため、ベクタの末尾に新しい要素を追加すると、ベクタが現在格納されている場所にすべての要素を隣り合って配置するための十分なスペースがない場合、新しいメモリを割り当てて古い要素を新しいスペースにコピーする必要があるかもしれない。
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

*Stringはインデックスをサポートしない*：StringはUTF-8エンコードされているため、文字列のバイトへのインデックスは必ずしも有効なUnicodeスカラー値に対応しない。**範囲を使った文字列スライスの作成には注意が必要である。そうするとプログラムがクラッシュする可能性がある。**

## Part 8 エラーハンドリング
実際にpanicを引き起こす方法は2つある：コードがpanicを引き起こすようなアクションを取る（配列の末尾を超えてアクセスするなど）か、明示的に`panic!`マクロを呼び出すかである。`RUST_BACKTRACE=1`でスタック情報を表示する。例：`RUST_BACKTRACE=1 cargo run`。

エラー時のPanicのショートカット：
```rust
use std::fs::File;

// 元のコード
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

エラー時のpanicを処理したくない場合、エラーを呼び出し元に伝播させる。`?`はエラーを伝播させるためのショートカットであり、`?`が使用される値と互換性のある戻り値の型を持つ関数でのみ使用できる。そして`?`は`Option`でも同様に動作する。
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

// ショートカット `?`
fn read_username_from_file() -> Result<String, io::Error> {
    let mut username = String::new();
    File::open("hello.txt")?.read_to_string(&mut username)?;
    Ok(username)
}
```

いつ`panic`すべきか？
1. テスト時にpanicする
2. コンパイラよりも多くの情報を提供できる場合にpanicする

Panicのガイドライン：
- 悪い状態とは、ユーザーが間違った形式でデータを入力するなど、時折発生する可能性のあるものではなく、予期しないものである。
- この時点以降のコードは、各ステップで問題をチェックするのではなく、この悪い状態にないことに依存する必要がある。
- 使用する型でこの情報をエンコードする良い方法がない。

## Part 9 ジェネリック型、トレイト、ライフタイム
*ジェネリック型*：ジェネリック型を使用しても、具体的な型を使用した場合よりもプログラムの実行が遅くなることはない。Rustはコンパイル時に、使用される具体的な型にジェネリック型を変換する。
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

`trait`：Java/Goの`interface`のようないくつかの側面を持ち、トレイトはデフォルト実装を持つことができるが、ある型にトレイトを実装する際にトレイトのすべての`fn`をオーバーライドする必要はない。
同じメソッドのオーバーライド実装からデフォルト実装を呼び出すことはできないことに注意。
トレイトをパラメータとして使用する場合、そのパラメータは指定されたトレイトを実装する任意の型を受け入れる。
トレイトまたは型のいずれか、あるいは両方がクレートに対してローカルである場合にのみ、型にトレイトを実装できる。
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

// デフォルトトレイト
pub trait Summary {
    fn summarize(&self) -> String {
        String::from("(Read more...)")
    }
}
impl Summary for NewsArticle {}

// トレイトをパラメータとして
pub fn notify(item: &impl Summary) {
    println!("Breaking news! {}", item.summarize());
}

// トレイト境界構文
// `pub fn notify(item1: &impl Summary, item2: &impl Summary) {}`と同じ
pub fn notify<T: Summary>(item1: &T, item2: &T) {}

// 複数のトレイトの境界
fn some_function<T: Display + Clone, U: Clone + Debug>(t: &T, u: &U) -> i32 {}
// `where`を使用
fn some_function<T, U>(t: &T, u: &U) -> i32
where
    T: Display + Clone,
    U: Clone + Debug,
{}

// トレイトを実装する戻り値の型
fn returns_summarizable() -> impl Summary {}
```

メソッドを条件的に実装するためのトレイト境界： 
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

// Pair<T>は、内部型Tが比較を可能にするPartialOrdトレイトと、出力を可能にするDisplayトレイトを実装している場合にのみ、cmp_displayメソッドを実装する
impl<T: Display + PartialOrd> Pair<T> {
    fn cmp_display(&self) {
        if self.x >= self.y {
            println!("The largest member is x = {}", self.x);
        } else {
            println!("The largest member is y = {}", self.y);
        }
    }
}

// 別のトレイトを実装する任意の型に対して条件的にトレイトを実装する
impl<T: Display> ToString for T {
    // --snip--
}
```

Rustコンパイラには*借用チェッカー*があり、スコープを比較してすべての借用が有効かどうかを判断する。
コンパイル時に、Rustは2つのライフタイムのサイズを比較し、rは'aのライフタイムを持つが、'bのライフタイムを持つメモリを参照していることを確認する。'bは'aより短いため、プログラムは拒否される。参照の対象が参照と同じだけ生きていないからである。
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

ライフタイム注釈の構文：ライフタイム注釈は、参照がどのくらい生きるかを変更するものではない。むしろ、ライフタイムに影響を与えることなく、複数の参照のライフタイム間の関係を記述するものである。
```rust
&i32        // 参照
&'a i32     // 明示的なライフタイムを持つ参照
&'a mut i32 // 明示的なライフタイムを持つ可変参照

fn main() {
    let string1 = String::from("abcd");
    let string2 = "xyz";

    let result = longest(string1.as_str(), string2);
    println!("The longest string is {result}");
}

fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// 構造体定義におけるライフタイム注釈
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
`longest`に具体的な参照を渡すと、ジェネリックライフタイム`'a`は、`x`と`y`のライフタイムのうち小さい方に等しい具体的なライフタイムを取得する。

**ライフタイム注釈の省略規則**：
1. コンパイラは参照である各パラメータにライフタイムパラメータを割り当てる
2. 入力ライフタイムパラメータがちょうど1つの場合、そのライフタイムがすべての出力ライフタイムパラメータに割り当てられる
3. 複数の入力ライフタイムパラメータがあるが、これがメソッドであるためそのうちの1つが&selfまたは&mut selfである場合、selfのライフタイムがすべての出力ライフタイムパラメータに割り当てられる

静的ライフタイム：`'static`。影響を受ける参照がプログラムの全期間にわたって生きることができることを示す。

[1]: 詳細は[The Stack and the Heap](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html#the-stack-and-the-heap)を参照