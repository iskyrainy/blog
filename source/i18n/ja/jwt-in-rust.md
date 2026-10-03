---
title: RustでのJWT
category: Tech
tag: Rust
date: 2025-06-27T00:47:04+08:00
---


# RustでのJWT
## 1 JWT
### 1.1 JWTの構造
**JSON Web Token**(JWT): 情報を運ぶ認証トークンのインターネット標準<sup>[1]</sup>。

JWTの構造は3つの部分からなり、各部分は `.` で連結され、最終的に次のようになる:
```
eyJhbGciOiJIbWFjU0hBMjU2IiwidHlwIjoiSldUIn0.
eyJpZCI6InRlc3QiLCJyb2xlIjoxLCJ0aW1lc3RhbXAiOjE3NTA5NTEyMDc0NjR9.
oqEllCbicf7g8x0cH2TowmyEL7IBL9qkxB3UJ9o4wrQ
```
- Header: 署名の生成に使用されるアルゴリズムを識別する。ヘッダーはbase64urlで文字列にエンコードされる。
  ```json
    {
        "alg": "HS256",
        "typ": "JWT"
    }
  ```
- Payload: サーバーによって設定された、**機密性のない**情報(機密情報を保存しないでください!!!)であるクレームのセットを含む。ペイロードはbase64urlで文字列にエンコードされる。
  ```json
    {
        "id": "a1n12ASc34",
        "role": 1,
        "timestamp": 1750953796000
    }
  ```
- Signature: トークンを安全に検証する。署名は、ヘッダーとペイロードをBase64urlエンコーディング<sup>[2]</sup>でエンコードし、ピリオド区切りで2つを連結して計算される。暗号アルゴリズムはヘッダーで指定される。
  ```
  // calculated by hs256
    HMAC_SHA256(
        secret,
        base64urlEncoding(header) + '.' + base64urlEncoding(payload)
    )
  ```

### 1.2 なぜJWTが必要なのか?
ご存知の通り、単一サーバーではセッションやローカルメモリにトークンを保存することでユーザーを識別できる。この解決策では、トークンの状態をローカルに保存するために多くのサーバーリソースを消費し、最も重要なのは、分散サーバー間でセッションやトークンを簡単に共有できないことである。
そこでJWTは別の解決策を提供する: クライアントに識別情報を保存する
- コストが低い;
- 分散サーバー間で簡単に共有できる;

### 1.3 JWTの欠点
JWTリプレイ: JWTはユーザークライアントに保存されるため、サーバーがJWTを無効化することは難しい。一度JWTが発行されると、サーバーが追加のロジックを実装しない限り、有効期限が切れるまで有効である。
この問題の解決は難しく、JWTの状態をサーバーに保存すると、JWTを使用する当初のビジョンに反する。

推奨: 
- JWTに短く妥当な有効期間を設定する

JWTハイジャック: JWT自体に認証情報が含まれている。一度漏洩すると、誰でもそのトークンのすべての権限を取得できる。

推奨: 
- JWTに短く妥当な有効期間を設定する
- JWTのハイジャックをより困難にするため、JWTの伝送に `https` や非対称暗号化を使用する
- 重要な操作には、二次検証を実行するか、検証コードなどの補助的な検証方法を使用する

## Rustでの簡単な実装
hs256を使用したJWTの簡単な実装:
```rust
use std::{fmt::Display, time::{SystemTime, UNIX_EPOCH}};
use base64::Engine;
use serde::{Deserialize, Serialize};
use hmac::{Hmac, Mac};
use sha2::Sha256;

pub struct Token;

impl Token {
    const SECRET: &'static str = "your SECRET";

    pub fn new(id: String, role: usize) -> String {
        let header_str = format!("{}", Header::new());
        let payload_str = format!("{}", Payload::new(id, role));
        let signature = Self::sign(format!("{}.{}", header_str, payload_str));
        format!("{}.{}.{}", header_str, payload_str, signature)
    }

    fn sign(message: String) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(Self::SECRET.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(message.as_bytes());
        let result = mac.finalize();
        let signature_bytes = result.into_bytes();
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(signature_bytes)
    }

    fn verify(token: &str) -> Result<Payload, String> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err("Invalid token format".to_string());
        }
        let header = parts[0];
        let payload = parts[1];
        let signature = parts[2];

        let expected_signature = Self::sign(format!("{}.{}", header, payload));
        if expected_signature != signature {
            return Err("Invalid signature".to_string());
        }

        Self::parse(payload)
    }

    fn parse(payload_str: &str) -> Result<Payload, String> {
        let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(payload_str)
            .map_err(|_| "Failed to decode payload".to_string())?;
        serde_json::from_slice(&decoded).map_err(|_| "Failed to parse payload".to_string())
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub(super) struct Payload {
    id: String,
    role: usize,
    timestamp: u64
}

impl Payload {
    fn new(id: String, role: usize) -> Payload {
        Payload { 
            id: id, 
            role: role, 
            timestamp: Self::now_timestamp()
        }
    }

    pub(super) fn now_timestamp() -> u64 {
        let now = SystemTime::now();
        let since_epoch = now.duration_since(UNIX_EPOCH)
            .expect("system clock being adjusted either forwards or backwards");
        since_epoch.as_secs() * 1000 + since_epoch.subsec_millis() as u64
    }
}

impl Display for Payload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let json = match serde_json::to_string(self) {
            Ok(j) => j,
            Err(_) => return Err(std::fmt::Error),
        };
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json.as_bytes());
        write!(f, "{}", encoded)
    }
}

#[derive(Serialize, Deserialize, Clone)]
struct Header{
    alg: &'static str,
    typ: &'static str
}

impl Header {
    fn new() -> Header {
        Header { alg: "HmacSHA256", typ: "JWT" }
    }
}

impl Display for Header {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let json = match serde_json::to_string(self) {
            Ok(j) => j,
            Err(_) => return Err(std::fmt::Error),
        };
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json.as_bytes());
        write!(f, "{}", encoded)
    }
}
```

[1]: 最新版は [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) を参照
[2]: 詳細は [Base64url](https://www.rfc-editor.org/rfc/rfc4648) を参照