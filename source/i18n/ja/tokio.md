---
title: Tokio
category: Tech
tag: Rust
date: 2025-08-28T00:33:49+08:00
---


# Tokio - Rust 最高の非同期ランタイム
## Part 1 非同期 vs 同期
同期プログラミングと非同期プログラミングとは何でしょうか？
同期の考え方は人間にとって最も自然な思考方法です。次のシナリオを考えてみましょう。あなたはお腹が空いて食べ物を買いに行きたいと思い、レストランに入って食べ物を求めて列に並びます。そして自分の番が来るまで列で待ち、それから食事の代金を支払います。
イベントの順序:
1. お腹が空いたと感じる
2. 列で数分待つ 😥
3. 食事の代金を支払う
4. 食事が準備できたら食べ始める！

同期プログラミングでは、すべてのイベントが順番に発生し、現在の操作が完了するまで次の操作をブロックします。`sync` は人間の思考方法に非常に合致しており、書くのもデバッグするのも簡単です。しかし時にはコードの**実行速度を低下させる**こともあります。

しかし非同期の世界ではまったく異なります。イベントの順序を見てみましょう:
1. お腹が空いたと感じる
2. 列に並ぶ必要はなく、QR コードをスキャンしてテーブル番号を入力してオンラインで注文する 😊
3. ウェイターが食事を準備して届ける前に、他のことをすることができる
4. 食事が準備できたら食べ始める！

これが同期と非同期の最大の違いでしょうか？
- 同期: **常に注意を払う（ブロッキング待機またはポーリング）** ブロックされたタスク
- 非同期: ブロックされたタスクの完了通知を受け取り、待機期間中に**他の非ブロッキングタスクを実行する**必要がある

以下は同期 vs 非同期の明確な比較表です:
| 観点                     | **同期**                                                                      | **非同期**                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **定義**            | タスクは次々に実行され、それぞれが次の開始前に完了する必要がある。       | タスクは他のタスクの完了を待たずに開始して継続できる。                                               |
| **実行フロー**        | ブロッキング: 1 つのタスクが完了するまで他のタスクの実行をブロックする。              | 非ブロッキング: タスクは独立して、または並行して実行できる。                                                      |
| **待機**               | 呼び出し側は操作が完了するまで待ってから次に進む。                           | 呼び出し側は待たず、他の作業を進めることができる。                                                            |
| **パフォーマンス**           | I/O やネットワーク遅延があるシナリオでは、待機中に CPU がアイドル状態になるため遅い。       | I/O バウンドの操作では高速で効率的。待機中に CPU が他のタスクを処理できるため。                 |
| **複雑さ**            | 書く・理解する・デバッグするのが簡単。                                              | コールバック、Promise、async/await の処理により複雑になる。                                                |
| **ユースケース**             | 小規模なプログラム、順次実行が必要なタスク、CPU バウンドの操作に適している。 | ネットワーキング、ファイル I/O、データベースクエリ、ユーザーインターフェイス、高並行システムに適している。                  |
| **例（プログラミング）** | 関数は完了後に直接結果を返す。                                   | 関数は *promise*、*future* を返すか、コールバック/イベントを使用して後で結果を配信する場合がある。                      |
| **例え**               | レジで列に並ぶ。前の人が終わるまで待つ。   | クリーニング店に服を預ける。作業中は離れて他のことをし、後で受け取る。 |

## Part 2 Rust std における非同期
Rust は*非同期プログラミング*の標準サポートを提供しています: Rust の Future、Stream、`async` および `await` 構文です。Rust における非同期プログラミングの鍵となる要素は future と `async/await` キーワードです<sup>[1]</sup>。

キーワード:
- `async`: ブロックと関数に適用し、中断および再開が可能であることを指定する
- `await`: async ブロック/関数内で、await を使用して *future* を *待つ*（準備完了になるのを待つ）

コアトレイト:
- `Future`: [Part 1](#part-1-非同期-vs-同期)で述べたように、オンラインで注文した後、ウェイターは選んだテーブル番号に対応するテーブルに食べ物を置きます。テーブル番号のように、*future* は現在は**準備できていないかもしれない**が、将来のある時点で**準備完了になる**値です。Rust は `Future` トレイトを構成要素として提供し、異なる非同期操作を異なるデータ構造で実装できるが共通のインターフェイスを持つようにします。
  ```rust
    pub trait Future {
        /// The type of value produced on completion.
        type Output;

        /// Attempts to resolve the future to a final value, registering
        /// the current task for wakeup if the value is not yet available.
        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
    }
  ```
- `Poll<T>`: `Ready(T)` または `Pending` を持つ enum。
  ```rust
    pub enum Poll<T> {
        /// Represents that a value is immediately ready.
        Ready(T),

        /// Represents that a value is not ready yet.
        ///
        /// When a function returns `Pending`, the function *must* also
        /// ensure that the current task is scheduled to be awoken when
        /// progress can be made.
        Pending,
    }
  ```
- `Context` + `Waker`: タスクが準備完了したときにタスクを起こすメカニズム。

標準ライブラリはエグゼキュータを提供していませんが、非同期ランタイムや非同期 I/O を実装するためのすべての基盤を提供しています。今日に至るまで、`tokio` は Rust エコシステムで最高かつ最も広く使用されている非同期ランタイムです。

## Part 3 tokio 非同期ランタイム
`tokio`<sup>[2]</sup> は Rust プログラミング言語用の非同期ランタイムです。非同期コードを効率的に実行するために必要なインフラストラクチャを提供し、高性能で並行なアプリケーション、特にネットワーキングの開発を可能にします。

> `tokio` は std と同じモジュールを提供しますが、非同期実装を使用しています。

### 3.1 runtime
非同期アプリケーションにはランタイムサポートが必要です。特に、以下のランタイムサービスが必要です:
- **I/O イベントループ**（ドライバと呼ばれる）。I/O リソースを駆動し、I/O イベントをそれに依存するタスクにディスパッチする。
- **スケジューラ**。これらの I/O リソースを使用するタスクを実行する。
- **タイマー**。設定された期間後に実行する作業をスケジュールする。

Tokio のランタイムはすべての機能を単一の型として提供します: **[Runtime](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html)**。

> 作成

```rust
use tokio::net::{TcpListener, TcpStream};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::runtime::Runtime;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create the runtime
    let rt  = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");

    // Spawn the root task
    rt.block_on(async {
        let listener = TcpListener::bind("127.0.0.1:8080").await?;

        loop {
            let (mut socket, _) = listener.accept().await?;

            tokio::spawn(async move {
                // read or write by socket
                handle_socket(socket);
            });
        }
    })
}

fn handle_socket(mut socket: TcpStream) {
  // ...
}
```

ランタイムのエントリポイントは [`block_on()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.block_on) です。`block_on()` で実行される future はワーカーとしては実行されません（TcpListener ループのように）。ここで提供される `block_on()` の future からの他のすべての future はワーカーとしてスポーンされます。

Tokio は **マルチスレッドスケジューラ** と **カレントスレッドスケジューラ** を提供します。マルチスレッドスケジューラは *スレッドプール* 上で future を実行し、ワークスティーリング戦略を使用し、デフォルトでは利用可能な各 CPU コアに対してワーカースレッドを 1 つ起動します。カレントスレッドスケジューラは *シングルスレッド* の future エグゼキュータを提供します。すべてのタスクは現在のスレッドで作成および実行されます。
```rust
use tokio::runtime;

// Multi-Thread Scheduler
let rt = runtime::Runtime::new()?;

// Current-Thread Scheduler
let rt = runtime::Builder::new_current_thread()
    .build()?;
```

そして Tokio はマクロでランタイムを作成するより簡単な方法を提供しています。[macro](#38-macro) を参照してください。

> スケジュール

*タスク* は軽量で非ブロッキングな実行単位です。タスクは OS スレッドに似ていますが、OS スケジューラによって管理されるのではなく、Tokio ランタイムによって管理されます<sup>[3]</sup>。

タスクの主な特徴:
1. **軽量**: 多数のタスクの作成、実行、切り替え、破棄は、特に OS スレッドと比較して非常に安価です
2. **協調的**: タスクが yield すると、Tokio ランタイムは次のタスクの実行に切り替えます
3. **非ブロッキング**: Tokio は非同期コンテキストでブロッキング操作を実行するための API を提供します

ランタイムはタスクのコレクションが空になるまでスケジュールされたタスク（`poll` を呼び出すことで）を維持し、その後スリープします。Tokio のランタイムは *タスクの飢餓* を防ぐために以下の公平性保証を提供します: タスクの総数が無制限に増加せず、どのタスクもスレッドをブロックしない場合、タスクが公平にスケジュールされることが保証されます。以下の 2 つの仮定の下で:
- ある数 `MAX_TASKS` が存在し、任意の特定の時点でランタイム上のタスクの総数が `MAX_TASKS` を超えない
- ある数 `MAX_SCHEDULE` が存在し、ランタイム上でスポーンされた任意のタスクで `poll` を呼び出すと `MAX_SCHEDULE` 時間単位以内に戻る

`MAX_TASKS` と `MAX_SCHEDULE` は任意の数にでき、ランタイムのユーザーがそれらを選択できます。`MAX_TASKS` と `MAX_SCHEDULE` に基づいて、tokio のランタイム内部は `MAX_DELAY` を保持し、タスクが起こされると `MAX_DELAY` 時間単位以内にランタイムによってスケジュールされます。

しかし tokio はランタイムがすべてのタスクに対して等しく公平であることを保証しません。タスクに関して、tokio はすべてのタスクが同じスケジュール回数を得ることを保証しませんが、すべてのタスクはいずれスケジュールされます。

ランタイムは IO リソースとタイマーも管理します。ランタイムは定期的に準備完了した IO リソースやタイマーがあるかどうかをチェックし、関連するタスクを起こしてスケジュールされるようにします。これらのチェックは**タスクのスケジュール間**に定期的に実行されます。Tokio は IO またはタイマーイベントでタスクをある最大時間単位以内に起こすことを保証します。

- **カレントスレッドランタイムのロジック**:
  1. **タスクキュー**
     * 2 つの FIFO キュー：**local**、**global**
     * スケジューリングルール：
       * ローカルキューから次にスケジュールするタスクを選ぶことを優先する
       * ローカルキューが空であるか、ローカルキューからタスクを選んだのが **31**（`global_queue_interval`、デフォルト `31`）回連続した場合 → グローバルキューからタスクを選ぶ
  2. **IO/スケジューラチェック**
     * スケジュール可能な**タスクがない**とき、または **61**（`event_interval`、デフォルト `61`）個のタスクを連続してスケジュールしたとき → 新しい IO またはタイマーイベントをチェックする
  3. **タスク起床ルール**
     * ランタイム上で実行中のタスク内から起こされたタスク → **ローカルキュー**に追加
     * 外部から起こされたタスク → **グローバルキュー**に追加

  ```sql
  ┌──────────────────────────────┐
  │         Tokio Current        │
  │     Thread Runtime Logic     │
  └──────────────────────────────┘

            ┌───────────────┐
            │ Two Queues    │
            │ Local / Global│
            └───────┬───────┘
                    │
        ┌───────────┴───────────────────────────┐
        │                                       │
  Local Queue Priority                    Global Queue
  - Preferred                             - Picked if local empty
  - If chosen 31 times → switch           - Or after 31 local picks
  (`global_queue_interval`)              

        ┌──────────────────────────────────────┘
        │
        ▼
  ┌───────────────┐
  │ Task Scheduled│
  └───────┬───────┘
          │
          ▼
    ┌───────────────┐
    │ Event Check?  │
    └───────┬───────┘
            │
    ┌───────┴───────────────────────────┐
    │ No tasks ready                    │
    │ Or scheduled 61 tasks in a row    │
    │ (`event_interval`)                │
    └───────────────────────────────────┘

  ┌───────────────────────────────────────┐
  │         Task Wakeup Handling          │
  ├───────────────────────────────────────┤
  │ - Woken inside runtime → Local Queue  │
  │ - Woken outside runtime → Global Queue│
  └───────────────────────────────────────┘

  ⚠️ Note: LIFO slot optimization not used
  ```
- **マルチスレッドランタイムのロジック**:
  1. **ワーカーとキュー**
     * 固定数のワーカースレッド（起動時に作成）。
     * 各ワーカーは以下を持つ:
       * **ローカルキュー**（最大 256 タスク）。
         * 超過した場合 → タスクの半分が**グローバルキュー**に移動。
       * **LIFO スロット**（特別な最適化）。
     * 共有の**グローバルキュー**。
  2. **タスクスケジューリング優先度**
     * **ローカルキュー**を優先する。
     * ローカルが空の場合、またはローカルから `global_queue_interval` 回選んだ後は**グローバルキュー**を使用する。
     * デフォルトの `global_queue_interval` は動的に計算される（グローバルキューチェック間で約 10ms）。
  3. **ワークスティーリング**
     * ローカルとグローバルキューの両方が空の場合 → 他のワーカーのローカルキューからタスクの半分を盗む。
  4. **イベントチェック**
     * 以下の場合に IO/タイマーをチェックする:
       * 準備完了のタスクがない、または
       * 61 個のタスクを連続してスケジュールした（`event_interval` は設定可能）。
  5. **LIFO スロット最適化**
     * あるタスクが別のタスクを起こした場合 → **LIFO スロット**に配置する（キューの代わりに）。
     * LIFO が既に満杯の場合 → 追い出されたタスクはローカルキューに行く。
     * タスクを終了したとき → LIFO から即座にスケジュールする（利用可能な場合）。
     * LIFO が使用されるとき、協調予算はリセットされない。
     * LIFO が 3 回連続して使用された場合 → 非 LIFO タスクが実行されるまで一時的に無効化される。
     * 無効化できる（`disable_lifo_slot`）。
     * **注意**: LIFO はスレッドごとであり、他のスレッドに盗まれることはない。
  6. **非ワーカースレッドからのタスク起床**
     * 起こされたタスクは**グローバルキュー**に配置される。

  ```sql
  ┌──────────────────────────────┐
  │  Tokio Multi-thread Runtime  │
  └──────────────────────────────┘

  Workers
   ├─ Each worker has:
   │   ├─ Local Queue (max 256 tasks)
   │   │    └─ Overflow → half moved to Global Queue
   │   └─ LIFO Slot (special fast scheduling slot)
   └─ Shared Global Queue

  Task Scheduling
   ├─ Prefer Local Queue
   ├─ Use Global Queue if:
   │    - Local empty, OR
   │    - After global_queue_interval local picks
   └─ global_queue_interval ≈ 10ms heuristic if unset

  Work Stealing
   └─ If Local & Global empty → steal half from another worker’s Local Queue

  Event Checking
   └─ Triggered when:
       - No tasks ready, OR
       - 61 tasks scheduled in a row
       (event_interval configurable)

  LIFO Slot
   ├─ Wakeup → goes to LIFO slot
   ├─ If slot occupied → old task → Local Queue
   ├─ After scheduling task → run LIFO task immediately
   ├─ Coop budget not reset on LIFO
   ├─ If used 3 times in a row → temporarily disabled
   └─ Not stealable, can disable via setting

  Task Wakeup from Non-worker
   └─ Task placed in Global Queue
  ```

> シャットダウン

`drop()` を呼び出すか、[`shutdown_background()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_background) または [`shutdown_timeout()`](https://docs.rs/tokio/latest/tokio/runtime/struct.Runtime.html#method.shutdown_timeout) を呼び出すことでランタイムをシャットダウンできます。
- `shutdown_background()`: スポーンされた作業が停止するのを待たずにランタイムをシャットダウンします。
- `shutdown_timeout()`: スポーンされたすべての作業が停止するのを最大で指定期間待ってランタイムをシャットダウンします。

ランタイムがドロップされると、それにバインドされた未完了の I/O リソースは機能しなくなります。それらに対して任意のメソッドを呼び出すとエラーになります。

`Runtime::spawn` によってスポーンされたタスクは完了まで実行されることは*保証*されておらず、`Runtime::spawn_blocking` によってスポーンされたタスクは戻るまで実行し続けます。

> 共有

- `Arc<Runtime>` を使用: ランタイムのシャットダウンを防ぎ、**1 つだけ**強いカウント参照が残ったときにランタイムをシャットダウンする
- [`Handle`](https://docs.rs/tokio/latest/tokio/runtime/struct.Handle.html) を使用: ランタイムのシャットダウンを防がない
- `Runtime::enter` または `Handle::enter` でランタイムコンテキストに入る: スレッドローカル変数を使用して現在のランタイムを保存し、`tokio::spawn` などの任意のメソッドはそのコンテキスト内のランタイムを使用する

### 3.2 fs
Tokio はブロッキングファイル操作を使用してファイルシステムを扱うための非同期ユーティリティメソッドを実装しており、ファイルへの読み書きやディレクトリの操作を含みます。Tokio はすべてのプラットフォームで常に `spawn_blocking` を使用します<sup>[4]</sup>。

`tokio::fs::read()` の詳細を見てみましょう:
```rust
/// This is an async version of [`std::fs::read`].
pub async fn read(path: impl AsRef<Path>) -> io::Result<Vec<u8>> {
    let path = path.as_ref().to_owned();
    asyncify(move || std::fs::read(path)).await
}
```
実際、`tokio::fs::read()` は `std::fs::read()` の非同期版です。内部関数 `asyncify` は `spawn_blocking` によって機能します:
```rust
pub(crate) async fn asyncify<F, T>(f: F) -> io::Result<T>
where
    F: FnOnce() -> io::Result<T> + Send + 'static,
    T: Send + 'static,
{
    match spawn_blocking(f).await {
        Ok(res) => res,
        Err(_) => Err(io::Error::new(
            io::ErrorKind::Other,
            "background task failed",
        )),
    }
}
```

`spawn_blocking` は深刻なパフォーマンスへの影響があります。操作をできるだけ少ない `spawn_blocking` 呼び出しにバッチ処理することを推奨します。
- **`String/Vec<u8>` に書き込む**:
  ```rust
  // recommend
  let mut contents = String::new();

  contents.push_str("First line.\n");
  contents.push_str("Second line.\n");
  contents.push_str("Third line.\n");

  tokio::fs::write("my_file.txt", contents.as_bytes()).await?;

  // not recommend
  tokio::fs::write("my_file.txt", "First line.\n".as_bytes()).await?;
  tokio::fs::write("my_file.txt", "Second line.\n".as_bytes()).await?;
  tokio::fs::write("my_file.txt", "Third line.\n".as_bytes()).await?;
  ```
- **`BufReader/BufWriter` を使用する**: `BufReader/BufWriter` は多数の小さな読み取りまたは書き込みを少数の大きなものにバッファリングすることをサポートします。`File::set_max_buf_size` を呼び出すことで、Tokio の `File` が単一の `spawn_blocking` 呼び出しで読み書きする最大バイト数を制御します。デフォルトは `2MB` です。
  ```rust
  use tokio::fs::File;
  use tokio::io::{AsyncWriteExt, BufWriter};

  let mut file = BufWriter::new(File::create("my_file.txt").await?);

  file.write_all(b"First line.\n").await?;
  file.write_all(b"Second line.\n").await?;
  file.write_all(b"Third line.\n").await?;

  // Due to the BufWriter, the actual write and spawn_blocking
  // call happens when you flush.
  file.flush().await?;
  ```
- **`spawn_blocking` 内で手動で `std::fs` を使用する**:
  ```rust
  use std::fs::File;
  use std::io::{self, Write};
  use tokio::task::spawn_blocking;

  spawn_blocking(move || {
      let mut file = File::create("my_file.txt")?;

      file.write_all(b"First line.\n")?;
      file.write_all(b"Second line.\n")?;
      file.write_all(b"Third line.\n")?;

      // Unlike Tokio's file, the std::fs file does
      // not need flush.

      io::Result::Ok(())
  }).await.unwrap()?;
  ```

### 3.3 io
Tokio は `std::io::Read/Write` をモデルにした独自のトレイト（`tokio::io` 内）を提供しますが、非同期です:
```rust
pub trait AsyncRead {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>
    ) -> Poll<io::Result<()>>;
}

pub trait AsyncWrite {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>>;

    fn poll_flush(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>>;

    fn poll_shutdown(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<io::Result<()>>;
}
```

標準ライブラリで `Read` と `Write` を実装するほとんどの型は、`AsyncRead` と `AsyncWrite` を実装する tokio の非同期の同等物を持っています。例えば `File` や `TcpStream` です。

上記のすべての関数は `Poll` を返します:
- **`Poll::Ready(Ok(...))`** → 操作が完了した
- **`Poll::Pending`** → まだ準備できていない。ランタイムは後でタスクを起こす必要がある

> ランタイムはこれらの関数をどのように呼び出すのか？

ランタイム自体は `poll_read/poll_write` を直接呼び出すことはありません。代わりに:
1. 高レベルの非同期関数（`AsyncReadExt/AsyncWriteExt` 内のこれらの関数は、それぞれ AsyncRead と AsyncWrite を実装するすべての値に対して自動的に実装されます。例えば `AsyncReadExt::read`）を呼び出す
    ```rust
    use tokio::fs::File;
    use tokio::io::{self, AsyncReadExt};

    #[tokio::main]
    async fn main() -> io::Result<()> {
        let mut f = File::open("foo.txt").await?;
        let mut buffer = [0; 10];

        // read up to 10 bytes
        let n = f.read(&mut buffer[..]).await?;

        println!("The bytes: {:?}", &buffer[..n]);
        Ok(())
    }
    ```
2. その非同期関数は `Future` を構築し、それがポーリングされると:
   - 基になる I/O オブジェクト（`TcpStream` など）で `poll_read/poll_write` を呼び出す
   - `Poll::Pending` を返す場合、future はタスクの `Waker` をリアクタに**登録**する
3. Tokio のリアクタ（`epoll/kqueue/IOCP` に基づく）はファイル記述子の準備完了を監視する
   - OS が「ソケット読み取り可能」または「書き込み可能」を通知すると、Tokio は `Waker::wake()` を呼び出す
   - これにより `poll_read/poll_write` でブロックされていたタスクが起こされる
4. エグゼキュータ（`tokio::runtime`）はその後 Future を再ポーリングし、今度は `poll_read/poll_write` 呼び出しが成功する

`f.read(&mut buffer[..]).await?` のフロー:
1. `read()`: `Future` である `Read` オブジェクトを返し、その `poll` は `poll_read` をラップする:
    ```rust
    pub(crate) fn read<'a, R>(reader: &'a mut R, buf: &'a mut [u8]) -> Read<'a, R>
    where
        R: AsyncRead + Unpin + ?Sized,
    {
        Read {
            reader,
            buf,
            _pin: PhantomPinned,
        }
    }

    pub struct Read<'a, R: ?Sized> {
        reader: &'a mut R,
        buf: &'a mut [u8],
        // Make this future `!Unpin` for compatibility with async trait methods.
        #[pin]
        _pin: PhantomPinned,
    }

    impl<R> Future for Read<'_, R>
    where
        R: AsyncRead + Unpin + ?Sized,
    {
        type Output = io::Result<usize>;

        fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<usize>> {
            let me = self.project();
            let mut buf = ReadBuf::new(me.buf);
            // inner call poll_read()
            ready!(Pin::new(me.reader).poll_read(cx, &mut buf))?;
            Poll::Ready(Ok(buf.filled().len()))
        }
    }
    ```
2. ランタイムがその Future（`Read`）をポーリングする
   - `File::poll_read` を呼び出す
   - データが利用可能でない場合、`Poll::Pending` を返す
   - Future は現在のタスクの `Waker` をリアクタ（`mio`<sup>[5]</sup>）に登録する
3. リアクタは `fd` の読み取り可能シグナルイベントを待つ
4. ランタイムがタスクを起こし、Future を再度ポーリングする
5. 今度は poll_read() が成功し、`Poll::Ready` を返す

バイトベースのインターフェイスは扱いにくく非効率になる可能性があるため、tokio は `std::io::BufRead` トレイトの非同期版である `AsyncBufRead`、および非同期の `BufReader` と `BufWriter` 構造体を提供します。
```rust
use tokio::io::{self, BufReader, AsyncBufReadExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let f = File::open("foo.txt").await?;
    let mut reader = BufReader::new(f);
    let mut buffer = String::new();

    // read a line into buffer
    reader.read_line(&mut buffer).await?;

    println!("{}", buffer);
    Ok(())
}
```
```rust
use tokio::io::{self, BufWriter, AsyncWriteExt};
use tokio::fs::File;

#[tokio::main]
async fn main() -> io::Result<()> {
    let f = File::create("foo.txt").await?;
    {
        let mut writer = BufWriter::new(f);

        // Write a byte to the buffer.
        writer.write(&[42u8]).await?;

        // Flush the buffer before it goes out of scope.
        writer.flush().await?;

    } // Unless flushed or shut down, the contents of the buffer is discarded on drop.

    Ok(())
}
```

### 3.4 net
Tokio は `std` に似た TCP/UDP/Unix ネットワーキング型を含み、ネットワーキングプロトコルを実装するために使用できます。`tokio::net` は `mio` に基づいています。

> TCP

`tokio::net::TcpListener` は TCP ソケットサーバーを抽象化し、接続を待ち受けます。
```rust
pub struct TcpListener {
    io: PollEvented<mio::net::TcpListener>,
}
```

アドレスをバインドして接続を受け入れます:
```rust
use tokio::net::TcpListener;

use std::io;

async fn process_socket<T>(socket: T) {
    // do work with socket here
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;

    loop {
        let (socket, _) = listener.accept().await?;
        process_socket(socket).await;
    }
}
```
`tokio::net::TcpStream` はローカルとリモートのソケット間のストリームを抽象化します。`tokio::net::TcpStream` は `AsyncRead` と `AsyncWrite` トレイトも実装します。
```rust
use tokio::net::TcpStream;
use tokio::io::AsyncWriteExt;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Connect to a peer
    let mut stream = TcpStream::connect("127.0.0.1:8080").await?;

    // Write some data.
    stream.write_all(b"hello world!").await?;

    Ok(())
}
```

> UDP

`tokio::net::UdpSocket` は UDP ソケットを抽象化します。tokio では UdpSocket を使用する主に 2 つの方法があります:
- **1 対多**: ポートを `bind` し、`send_to` と `recv_from` を使用して多くの異なるアドレスと通信する
- **1 対 1**: `connect` して単一のアドレスに関連付け、`send` と `recv` 