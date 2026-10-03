---
title: Rust 中的 JWT
category: Tech
tag: Rust
date: 2025-06-27T00:47:04+08:00
---


# Rust 中的 JWT
## 1 JWT
### 1.1 JWT 结构
**JSON Web Token**（JWT）：一种用于携带信息的认证令牌的互联网标准<sup>[1]</sup>。

JWT 结构由三部分组成，各部分之间用 `.` 连接，最终形式如下：
```
eyJhbGciOiJIbWFjU0hBMjU2IiwidHlwIjoiSldUIn0.
eyJpZCI6InRlc3QiLCJyb2xlIjoxLCJ0aW1lc3RhbXAiOjE3NTA5NTEyMDc0NjR9.
oqEllCbicf7g8x0cH2TowmyEL7IBL9qkxB3UJ9o4wrQ
```
- Header（头部）：标识用于生成签名的算法。头部会被 base64url 编码为字符串。
  ```json
    {
        "alg": "HS256",
        "typ": "JWT"
    }
  ```
- Payload（载荷）：包含一组由服务器设置的**非敏感**信息声明（不要存储任何敏感信息！！！）。载荷会被 base64url 编码为字符串。
  ```json
    {
        "id": "a1n12ASc34",
        "role": 1,
        "timestamp": 1750953796000
    }
  ```
- Signature（签名）：安全地验证令牌。签名通过使用 Base64url 编码<sup>[2]</sup>对头部和载荷进行编码，并将两者用句点分隔符连接后计算得出。使用头部中指定的加密算法。
  ```
  // 由 hs256 计算
    HMAC_SHA256(
        secret,
        base64urlEncoding(header) + '.' + base64urlEncoding(payload)
    )
  ```

### 1.2 为什么需要 JWT？
正如我们所知，在单台服务器中，我们可以通过 session 来区分用户，或者在本地内存中存储 token。对于这种方案，在本地存储 token 状态会消耗大量服务器资源，而且最重要的是，它无法轻松地在分布式服务器之间共享 session 或 token。
因此 JWT 提供了另一种方案：将身份信息存储在客户端
- 成本更低；
- 易于在分布式服务器之间共享；

### 1.3 JWT 的缺陷
JWT 重放：由于 JWT 存储在用户客户端上，服务器很难使 JWT 失效。一旦 JWT 被签发，在它过期之前都是有效的，除非服务器部署额外的逻辑。
这个问题很难解决。如果将 JWT 的状态存储在服务器上，就违背了使用 JWT 的初衷。

建议：
- 为 JWT 设置一个较短且合理的有效期

JWT 劫持：JWT 本身包含认证信息。一旦泄露，任何人都可以获得该令牌的所有权限。

建议：
- 为 JWT 设置一个较短且合理的有效期
- 增加劫持 JWT 的难度，使用 `https` 或非对称加密进行 JWT 传输
- 对于重要操作，执行二次验证或使用验证码等辅助验证方式

## Rust 简单实现
使用 hs256 的 JWT 简单实现：
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

[1]: 最新版本参见 [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)
[2]: 更多内容参见 [Base64url](https://www.rfc-editor.org/rfc/rfc4648)