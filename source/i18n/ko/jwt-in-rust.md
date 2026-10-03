---
title: Rust에서의 JWT
category: Tech
tag: Rust
date: 2025-06-27T00:47:04+08:00
---


# Rust에서의 JWT
## 1 JWT
### 1.1 JWT 구조
**JSON Web Token**(JWT): 정보를 담는 인증 토큰을 위한 인터넷 표준<sup>[1]</sup>이다.

JWT 구조는 세 부분으로 나뉘며, 각 부분은 `.`로 연결되고, 최종적으로 다음과 같다:
```
eyJhbGciOiJIbWFjU0hBMjU2IiwidHlwIjoiSldUIn0.
eyJpZCI6InRlc3QiLCJyb2xlIjoxLCJ0aW1lc3RhbXAiOjE3NTA5NTEyMDc0NjR9.
oqEllCbicf7g8x0cH2TowmyEL7IBL9qkxB3UJ9o4wrQ
```
- 헤더(Header): 서명을 생성하는 데 사용되는 알고리즘을 식별한다. 헤더는 base64url로 인코딩되어 문자열이 된다.
  ```json
    {
        "alg": "HS256",
        "typ": "JWT"
    }
  ```
- 페이로드(Payload): 서버가 설정한 **민감하지 않은** 정보(민감한 정보는 절대 저장하지 말 것!!!)인 클레임 집합을 포함한다. 페이로드는 base64url로 인코딩되어 문자열이 된다.
  ```json
    {
        "id": "a1n12ASc34",
        "role": 1,
        "timestamp": 1750953796000
    }
  ```
- 서명(Signature): 토큰을 안전하게 검증한다. 서명은 헤더와 페이로드를 Base64url 인코딩<sup>[2]</sup>하여 마침표 구분자로 연결한 후, 헤더에 지정된 암호화 알고리즘으로 계산된다.
  ```
  // calculated by hs256
    HMAC_SHA256(
        secret,
        base64urlEncoding(header) + '.' + base64urlEncoding(payload)
    )
  ```

### 1.2 JWT가 필요한 이유
알다시피, 단일 서버에서는 세션으로 사용자를 구분하거나 로컬 메모리에 토큰을 저장할 수 있다. 이 해결책은 토큰 상태를 로컬에 저장하기 위해 많은 서버 자원이 소모되며, 가장 중요한 것은 분산 서버 간에 세션 또는 토큰을 쉽게 공유할 수 없다는 점이다.
그래서 JWT는 또 다른 해결책을 제시한다: 신원 정보를 클라이언트에 저장하는 것이다.
- 비용이 적게 든다;
- 분산 서버 간에 쉽게 공유된다;

### 1.3 JWT의 결점
JWT 재사용: JWT는 사용자 클라이언트에 저장되므로, 서버가 JWT를 무효화하기 어렵다. 일단 JWT가 발급되면, 서버가 추가 로직을 배포하지 않는 한 만료될 때까지 유효하다.
이 문제는 해결하기 어렵다. JWT의 상태를 서버에 저장하면, JWT를 사용하는 원래 비전에 어긋나기 때문이다.

권장사항:
- JWT에 짧고 합리적인 유효 기간을 설정하라

JWT 탈취: JWT 자체에 인증 정보가 포함되어 있다. 일단 유출되면, 누구나 해당 토큰의 모든 권한을 얻을 수 있다.

권장사항:
- JWT에 짧고 합리적인 유효 기간을 설정하라
- JWT를 탈취하기 더 어렵게 만들어라, JWT 전송에 `https` 또는 비대칭 암호화를 사용하라
- 중요한 작업의 경우, 2차 검증을 수행하거나 인증 코드와 같은 보조 검증 방법을 사용하라

## Rust 간단 구현
hs256을 사용한 JWT의 간단 구현:
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

[1]: 최신 버전은 [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)를 참고
[2]: 자세한 내용은 [Base64url](https://www.rfc-editor.org/rfc/rfc4648)를 참고