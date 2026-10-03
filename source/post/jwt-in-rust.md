---
title: JWT In Rust
category: Tech
tag: Rust
date: 2025-06-27T00:47:04+08:00
---


# JWT In Rust
## 1 JWT
### 1.1 JWT struct
**JSON Web Token**(JWT): Internet standard<sup>[1]</sup> for authentication token that carries information.

JWT structure has three parts, each part connected with `.`, finally as:
```
eyJhbGciOiJIbWFjU0hBMjU2IiwidHlwIjoiSldUIn0.
eyJpZCI6InRlc3QiLCJyb2xlIjoxLCJ0aW1lc3RhbXAiOjE3NTA5NTEyMDc0NjR9.
oqEllCbicf7g8x0cH2TowmyEL7IBL9qkxB3UJ9o4wrQ
```
- Header: Identifies which algorithm is used to generate the signature. The header is base64url encoded into a string.
  ```json
    {
        "alg": "HS256",
        "typ": "JWT"
    }
  ```
- Payload: Contains a set of claims which are **insensitive** information(don't store any sensitive information!!!) set by server. The payload is base64url encoded into a string.
  ```json
    {
        "id": "a1n12ASc34",
        "role": 1,
        "timestamp": 1750953796000
    }
  ```
- Signture: Securely validates the token. Signture is calculated by encoding the header and payload using Base64url encoding<sup>[2]</sup> and concatenating the two together with a period separator. The cryptographic algorithm specified in the header.
  ```
  // calculated by hs256
    HMAC_SHA256(
        secret,
        base64urlEncoding(header) + '.' + base64urlEncoding(payload)
    )
  ```

### 1.2 Why need JWT?
As we know, we can distinguish users by session or store token in local memory in a single server. For this solution, there cost lots of server resource to locally store token status, and the most important is, it can not easily share sessions or tokens between distributed servers.
So JWT offer an other soultion: store identity information in clients
- less cost;
- easily shared between distributed servers;

### 1.3 Flaws of JWT
JWT replay: Because JWT is stored on the user client, it is difficult for the server to invalidate JWT. Once a JWT is issued, it is valid until it expires, unless the server deploys additional logic.
This problem is difficult to solve. If the state of JWT is stored on the server, it goes against the original vision of using JWT.

recommend: 
- set a short and reasonable validity period for JWT

JWT Hijacking: JWT itself contains authentication information. Once leaked, anyone can obtain all permissions of the token.

recommend: 
- set a short and reasonable validity period for JWT
- make it more difficult to hijack JWT, use `https` or asymmetric encryption for JWT transmission
- for important operations, perform secondary verification or use auxiliary verification methods such as verification codes

## Rust simple implementation
Simple implementation of JWT using hs256:
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

[1]: Last version see [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)
[2]: See more [Base64url](https://www.rfc-editor.org/rfc/rfc4648)
