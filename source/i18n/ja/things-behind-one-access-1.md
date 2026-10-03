---
title: 1つのアクセスの裏側 1
category: Tech
tag: Linux
date: 2026-01-21T23:45:52+08:00
---


## Part 1 タイプされたURLから始まる
> ユーザーのタイピングに伴い、ブラウザは数十の解析と処理ステップを実行する。

ユーザーがブラウザのアドレスバーにURLを入力してEnterを押すと、一連の極めて複雑で高度に最適化されたプロセスが引き起こされる。文字の入力から始まり、ブラウザは「単なる1回のネットワークリクエスト」よりもはるかに多くのことを行わなければならない。

ブラウザはユーザーが入力した内容をどのように理解し、それを正当なリクエストターゲットへと解析するのか？

### 1.1 入力の処理
現代のブラウザ（Chrome、Firefoxなど）はすべてマルチプロセスアーキテクチャを採用しており、その目的には以下が含まれる：
- 安定性：単一ページのクラッシュがブラウザ全体のクラッシュを引き起こさない
- セキュリティ：プロセスの分離
- パフォーマンス：並列処理

ブラウザが含むプロセス：
| プロセス                      | 機能                            |
| ----------------------- | ----------------------------- |
| Browser Process（メインブラウザプロセス） |     インターフェース、タブ管理、URL解析、ネットワークポリシー、セキュリティポリシー|
| Network Process   | DNS、Socket、キャッシュ管理、Cookie、Proxyなど |
| Renderer Process  | JSの実行、DOMのレンダリング、CSS、レイアウト、ペイント |
| GPU Process             | グラフィックスアクセラレーション、レンダリング         |
| Utility Processes       | オーディオデコード、ビデオデコード、サンドボックスタスクの実行             |

**メインブラウザプロセス**はユーザーの入力処理を行い、タイプされた内容が「ナビゲーション」か「検索」かをデコードし、キャッシュ/履歴をチェックし、最終的にネットワークプロセスによるリクエストを開始する。

まず、ユーザーがキーボードで何かをタイプすると、[`UrlBarController`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html##the-controller)が[`UrlbarQueryContext`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#the-urlbarquerycontext)を構築/更新し、次に`UrlBarController`がクエリ内容を各[`UrlbarProvider`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#urlbarprovider)にディスパッチする -- プロバイダーとは、異なる情報ソースから検索して結果を返すことに特化したものである。

次に、`UrlbarProvider`が候補（検索候補や履歴/ブックマークに基づくURLを含む）を提供する。Firefoxの場合、Firefoxが順に実行する最も重要なヒューリスティックは以下の通りである：
1. Omnibox拡張機能のキーワードか？
2. ブックマークキーワードか？
3. 自動補完されるべきドメイン名またはURLか？
4. 有効なURLか？
5. 最終的にデフォルトエンジンを使用した検索の実行にフォールバックする。

> 判定ルールは固定ではなく、ブラウザの履歴、統計、インテリジェントな関連付け、および検索エンジンが提供するサジェストAPIの組み合わせによって決定される。

最後に、ユーザーがEnterを押す（または候補を選択する）と、ブラウザはナビゲーション動作を決定する。このステップで、ブラウザは「ユーザーが入力した生の文字列」をいくつかの内部関数（例えば[`looksLikeUrl`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#60)、[`looksLikeorigin`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#162)）に渡して最終的なURLを決定する：
- URLらしい場合：ブラウザは[`getFixupURIInfo`](https://searchfox.org/firefox-main/source/docshell/base/URIFixup.sys.mjs#264)を使用して修正し（例：http://を自動的に追加、スキームのスペルミスを修正など）、修正されたURLにナビゲートする。
- その他：入力を検索キーワードとして扱い、*Search Service*（現在の検索エンジンに基づく）を使用して検索URLを構築する。

*処理ワークフロー*：
```bash
User Input
  ↓
Trim / Normalization
  ↓
Protocol Present? ---- YES → Valid URL → Load URL
  ↓
URL Syntax Valid? ---- YES → DNS Query → Load URL
  ↓
Is it domain-like? ---- YES → Try domain → If DNS fail → Search
  ↓
Otherwise → Search Query
```


### 1.2 URL解析
入力がURLとして確認されると、ブラウザは**WHATWG URL Standard**<sup>[1]</sup>に厳密に従ってURLを解析する。
URLの基本構造は以下の通りである<sup>[2]</sup>：
```bash
scheme://userinfo@host:port/path?query#fragment
# scheme: https(default), http, ftp, ws, wss, file, data, blob etc.
```

次にブラウザは以下を行う：
1. ホストチェック：Unicodeホストの場合、DNSはUnicodeをサポートしていないため、ブラウザは*IDNA2008 Standard*と*Punycodeアルゴリズム*を介してそれをpunycodeに変換しなければならない。
  ```bash
  谷歌.com -> xn--flw351e.com
  ```
2. パスチェック：ブラウザはURLを自動的に修正する。これには冗長なスラッシュのマージ、`.`と`..`の解析、不正な文字の修正が含まれる。
  ```bash
  https://example.com/foo//bar/../baz -> https://example.com/foo/baz
  ```
3. URL文字エンコーディング：URLをUTF-8に変換する。
  ```bash
  https://example.com/你好 -> https://example.com/%E4%BD%A0%E5%A5%BD
  ```

### 1.3 ブラウザのセキュリティポリシー
ブラウザはURL解析段階で一部の不正なコンテンツを拒否する。
1. JavaScript URL：現代のブラウザには厳格な制限があり、アドレスバーで直接コマンドを実行することはできない。
2. 一部のドキュメントプロトコルの拒否：セキュリティ上の理由から、`file://`による任意のローカルパスへのナビゲーションは許可されていない。

### 1.4 URL解析後の最終結果
最終的に、ブラウザは完全に標準化されたURLをネットワークプロセスに引き渡し、以下を進める準備が整う：
- DNSルックアップ
- TCPハンドシェイク
- TLSハンドシェイク
- HTTPリクエストの送信

これらについては後続の章で論じる。

## Part 2 DNSプロセス全体の深掘り分析
ブラウザはユーザーのタイピングを処理し、標準的なリクエストを生成する。それらのリクエストのほとんどはIPではなくドメインによって構築されるため、ブラウザは実際の接続動作のためにドメインをIPに変換しなければならない。この関係の解決は*DNS解決*と呼ばれる。

多くの人はDNSを「ドメイン名をIPアドレスに解決するシステム」と考えている -- しかしそれははるかに多くのものである。いくつかの場面を考えてみよう：
- 1つのドメインが複数のIPv4/IPv6レコードに対応する
- DNSには再帰、反復、多段キャッシュの機能があり、OSにもhosts、nsswitch、resolv.confといった内部設定ファイルがある
- ブラウザにも組み込みのDNSキャッシュがある
- DoH/DoT（暗号化DNS）、EDNS、DNSSECといったメカニズム
- ISPがDNSをハイジャック、ポイズニング、リダイレクトする可能性がある
- CDNがインテリジェントDNSを使用して異なるIPを返す
...

> 冗談ではなく、DNSはインターネット全体において最も過小評価されているが、最も重要な基盤インフラの1つである。最も面白い画像を見てほしい：
![The True World](https://i.postimg.cc/QNy0yzmd/The-Ture-World.jpg)

### 2.1 解決順序
「解決順序」とは、オペレーティングシステムやアプリケーションがドメイン名をIPアドレスに解決しようとする際に従う優先順位チェーンを指す。解決順序は、異なるオペレーティングシステム、ランタイム、ネットワークライブラリ間で若干異なる場合があるが、一般的なプロセスは通常以下の通りである：
1. **Hostsファイル**
2. **DNSキャッシュ（ローカルキャッシュ、ブラウザキャッシュ、アプリケーションキャッシュ）**
3. **システムリゾルバ**
4. **ローカルDNSサーバー（例：systemd-resolved / dnsmasq経由の127.0.0.1:53）**
5. **ISP DNSまたはカスタムDNS（例：8.8.8.8、1.1.1.1、社内イントラネットDNS）**
6. **再帰リゾルバ（リゾルバ → ルート → TLD → 権威）**

Linuxの場合、/etc/nsswitch.confを使用して解析順序を制御する：
```bash
hosts: files dns myhostname
```

その意味は：
| 順序 | 方法  | 説明            |
| -- | ---------- | --------------- |
| 1  | files      | `/etc/hosts`    |
| 2  | dns        | dns lookup      |
| 3  | myhostname | systemdが提供する特別なエントリ   |


### 2.2 DNSキャッシュ
DNSキャッシュ（DNSリゾルバキャッシュとも呼ばれる）は、デバイス上の一時的なDNSストレージであり、すでに訪問したドメイン名のDNSレコード（IPv4アドレスのAレコード、IPv6のAAAAレコードなど）を含む。これらのレコードはtime-to-live（TTL）に応じて保持される。

DNSキャッシュは多層構造で存在し、上位から下位へ：
1. **オペレーティングシステムのDNSキャッシュ**：Windowsはdns-cacheを提供し、`ipconfig /displaydns`で詳細を表示する。MacOSではターミナルアプリケーションを開き、次のコマンド`sudo killall -INFO mDNSResponder`を入力する。LinuxにはOSレベルのDNSキャッシュはないが、`systemd-resolved`/`dnsmasq`を使用して行うことができる
2. **アプリケーション層のDNSキャッシュ**：一部のアプリケーションはDNSキャッシュを組み込む。現代のブラウザ（Chrome/Firefox/Edge）は内部的に独自のDNSキャッシュを維持している

*TTL*はレコードがキャッシュに留まる期間を決定する。短いTTLは権威ネームサーバーに重い負荷を引き起こす可能性があるが、WebサーバーやMXレコードのような重要なサービスのアドレスを変更する際に有用であり、したがってサービスの移行前にDNS管理者によってしばしば短くされ、中断を最小限に抑える。
![TTL](https://www.cloudns.net/images/wiki/What-is-TTL.png)

### 2.3 システムリゾルバ
DNSリゾルバは、人間に優しいドメイン名を機械可読なIPアドレスに変換する上で重要な最初のステップであり、デバイスとDNSサーバーの間の仲介者として機能し、正しいIPを見つける。多くの場合、結果をキャッシュして速度を向上させる。複雑なルックアッププロセスを処理し、ルート、TLD、権威ネームサーバーに問い合わせ、IPをブラウザに返すことで、インターネットナビゲーションを可能にする。

`glibc`と`systemd-resolved`はLinux上で通常のリゾルバとして動作することができる。

### 2.4 CDN/GeoDNS
物理的な距離はアクセス応答速度に影響し、集中アクセスはサーバーに莫大な負荷をかける。Content Delivery Networks（CDN）とGeoDNSは、サーバーパフォーマンスの負荷を**分散**しながら、より良い体験を提供することができる。

CDNとGeoDNS技術は、ドメイン名解決を地理的にインテリジェントにし、近接性によって高速化する。

CDNは以下によってパフォーマンスを向上させる：
- Anycast IP：同じIPが複数のPOPサイトでブロードキャストされ、ユーザーが近くでアクセスできるようにする
- キャッシュ：Edge Cache -> Regional Cache -> Origin Server
- 動的ルーター最適化：サービスプロバイダーはインテリジェントルーティングを通じてネットワーク輻輳を回避する。

GeoDNSは、DNSリクエストを開始するクライアントの地理的位置に基づいて異なるIPアドレスを返し、それによってユーザートラフィックを最も近い、または最も適切なサーバーにリダイレクトする。

> ほとんどのCDNの権威DNSはGeoDNS自体であるため、クライアントは自然に最良のエッジノードIPを取得する。

### 2.5 DNS攻撃、DNSSEC、DoT、DoH
DNSは現代のネットワークシステムにおいて極めて重要な基盤である。DNSへの攻撃はネットワークの正常な動作に深刻な影響を与える可能性がある。

DNS攻撃は、DNSの脆弱性を悪用して、ドメイン名からIPアドレスへの変換を操作することで、サービスを妨害し、ユーザーを悪意のあるサイト（フィッシング/マルウェア）にリダイレクトし、データを盗み、またはDDoS攻撃を仕掛ける。一般的な種類には、DNS Amplification（オープンリゾルバを使用してターゲットに応答を殺到させる）やCache Poisoning（DNSキャッシュレコードを破壊する）があり、しばしばなりすましなどの手法を用いて送信元を隠す。

いくつかのDNS攻撃：
- DNS Spoofing/Cache poisoning：攻撃者が偽造レコードをリゾルバに注入し、ドメイン名を誤ったIPにポイントする
- DNS Hijacking：運用者または攻撃者がDNSクエリを変更またはハイジャックし、ユーザーを誤ったWebサイトに誘導する
- DDoS

DNSは非常に重要であると同時に非常に脆弱である。DNS攻撃からどのように防御すればよいのか？

1. Domain Name System Security Extension（DNSSEC）<sup>[3]</sup>は、DNSをスプーフィングや改ざんから保護するために使用されるセキュリティプロトコルである。DNSレコードにデジタル署名を追加することでデータの真正性と完全性を検証し、ユーザーが正当なWebサイトにアクセスし、悪意のあるサイトにリダイレクトされないことを保証する。
2. DNS over TLS（DoT）は、DNSクエリを暗号化する現代のプロトコルであり、ポート853上の安全なTLSトンネル（HTTPSのように）でそれらを包み込む。
3. DNS over HTTPS（DoH）は、HTTPSプロトコルを使用してDNSクエリを暗号化し、それらを通常のWebトラフィックのように見せかけ、ISPや攻撃者からの覗き見や改ざんを防ぐことでプライバシーとセキュリティを強化する。

## リンク
[1]: The URL Pattern Standard gives a generic pattern syntax for matching URLs, and extracting the parts from them. See more about [URL Standard](https://url.spec.whatwg.org/)
[2]: HSTS: [HTTP Strict-Transport-Security](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security), the browser will force the use of HTTPS.
[3]: See [How DNSSEC Works](https://www.cloudflare.com/zh-cn/learning/dns/dnssec/how-dnssec-works/) to know how DNSSEC works.