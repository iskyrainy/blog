---
title: 高速な文字列マッチング
category: Tech
tag: Rust
date: 2026-03-21T00:10:24+08:00
---


## Part 1 文字列の位置を探す
最近、*leetcode* で非常に基本的な問題を見かけました。[この問題](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/description/)は2つの`str`が与えられ、`haystack`内で`needle`が最初に現れる位置を見つける必要があります。とても簡単に聞こえますね！最も素直な方法は、1文字ずつ照合することです。これで最初の答えはすぐに得られます。
```rust
pub fn naive_find(haystack: &str, needle: &str) -> Option<usize> {
    let h = haystack.as_bytes();
    let n = needle.as_bytes();

    if n.is_empty() {
        return Some(0);
    }
    if n.len() > h.len() {
        return None;
    }

    for i in 0..=h.len() - n.len() {
        let mut j = 0;
        while j < n.len() && h[i + j] == n[j] {
            j += 1;
        }
        if j == n.len() {
            return Some(i);
        }
    }
    None
}
```

しかし、これで本当に大丈夫でしょうか？

部分文字列のインデックスを見つけることは非常に重要な問題であり、*検索エンジン*などで広く使われています。最初の答えである*O(n * m)*の時間計算量を使うと、ユーザーは応答を得るまでにより長く待たなければならず、受け入れられません。

## Part 2 KMP
Knuth–Morris–Prattアルゴリズム（*KMP*）は、1977年に*Donald Knuth*、*Vaughan Pratt*、*James H. Morris*によって提案された効率的な文字列マッチングアルゴリズムです。パターン文字列の前処理段階で部分マッチングテーブルを構築することで、冗長な比較を避け、本文中の部分文字列探索を線形時間で実現します。

KMPアルゴリズムはパターン文字列を前処理して、各位置における最長の接頭辞-接尾辞の一致長（つまり部分マッチングテーブル）を計算します。マッチング過程で文字の不一致が発生した場合、アルゴリズムはこのテーブルを使って既知の一致位置にジャンプし、テキスト内の次の文字に単純にバックトラックすることなく、冗長な比較を避けます。

以下にKMPの完全な実装を示します：
```rust
fn build_lps(pattern: &[u8]) -> Vec<usize> {
    let mut lps = vec![0; pattern.len()];
    let mut len = 0;
    let mut i = 1;

    while i < pattern.len() {
        if pattern[i] == pattern[len] {
            len += 1;
            lps[i] = len;
            i += 1;
        } else if len != 0 {
            len = lps[len - 1];
        } else {
            lps[i] = 0;
            i += 1;
        }
    }

    lps
}

pub fn kmp_find(haystack: &str, needle: &str) -> Option<usize> {
    let h = haystack.as_bytes();
    let n = needle.as_bytes();

    if n.is_empty() {
        return Some(0);
    }

    let lps = build_lps(n);

    let (mut i, mut j) = (0, 0);

    while i < h.len() {
        if h[i] == n[j] {
            i += 1;
            j += 1;
        }

        if j == n.len() {
            return Some(i - j);
        } else if i < h.len() && h[i] != n[j] {
            if j != 0 {
                j = lps[j - 1];
            } else {
                i += 1;
            }
        }
    }

    None
}
```

時間計算量：*O(n + m)*

## Part 3 双方向文字列マッチングアルゴリズム
`naive_find`と比較して、`kmp_find`はアルゴリズムの時間計算量を*O(n * M)*から*O(n + m)*に改善しました。これは非常に大きな最適化です。

しかし、これで本当に大丈夫でしょうか？

**双方向文字列マッチングアルゴリズム**（Crochemore–Perrinアルゴリズムとしても知られる）は、1991年に*Maxime Crochemore*と*Dominique Perrin*によって提案された効率的な決定論的文字列マッチング手法です。このアルゴリズムは、最悪の場合でも線形時間でテキスト内のすべてのパターンマッチを見つけることができ、文字列検索理論における重要な成果を表しています。

双方向アルゴリズムは、接頭辞関数と文字列周期性解析のアイデアを組み合わせています。最大の接頭辞-接尾辞境界（臨界分解）を計算することでパターン文字列を2つの部分に分割し、その最小周期に基づいてテキスト内で双方向のスライドマッチングを行います。アルゴリズムは辞書式比較メカニズムを利用して冗長なマッチングを削減し、それによって線形計算量を保証します。

主要なステップ：
1. パターン文字列の重要な分解点を計算し、得られた2つの部分が特定の周期性条件を満たすことを保証する。
2. パターンの最小周期を決定する。
3. テキスト内を周期的に移動し、左と右でそれぞれ一致を検証する。

この分割統治的なマッチング手法は冗長な比較を避けます。

以下に双方向アルゴリズムの簡単な実装を示します：
```rust
fn max_suffix(arr: &[u8], reversed: bool) -> (usize, usize) {
    let mut i = 0;
    let mut j = 1;
    let mut k = 0;
    let mut p = 1;

    while j + k < arr.len() {
        let a = arr[i + k];
        let b = arr[j + k];

        if a == b {
            if k + 1 == p {
                j += p;
                k = 0;
            } else {
                k += 1;
            }
        } else if (a < b) ^ reversed {
            j += k + 1;
            k = 0;
            p = j - i;
        } else {
            i = j;
            j = i + 1;
            k = 0;
            p = 1;
        }
    }

    (i, p)
}

fn critical_factorization(needle: &[u8]) -> (usize, usize) {
    let (i1, p1) = max_suffix(needle, false);
    let (i2, p2) = max_suffix(needle, true);

    if i1 > i2 {
        (i1, p1)
    } else {
        (i2, p2)
    }
}

pub fn twoway_find(haystack: &str, needle: &str) -> Option<usize> {
    let h = haystack.as_bytes();
    let n = needle.as_bytes();

    let m = n.len();
    let len = h.len();

    if m == 0 {
        return Some(0);
    }
    if m > len {
        return None;
    }

    let (crit_pos, period) = critical_factorization(n);

    let mut memory = 0;
    let mut pos = 0;

    while pos <= len - m {
        // 1. match right part
        let mut j = crit_pos.max(memory);

        while j < m && n[j] == h[pos + j] {
            j += 1;
        }

        if j < m {
            pos += j - crit_pos + 1;
            memory = 0;
            continue;
        }

        // 2. match left part
        let mut k = crit_pos;

        while k > memory && n[k - 1] == h[pos + k - 1] {
            k -= 1;
        }

        if k <= memory {
            return Some(pos);
        }

        pos += period;
        memory = m - period;
    }

    None
}
```

時間計算量：最悪の場合*O(n)*

> さらに興味深いことに、双方向アルゴリズムは`find`と`rfind`を簡単に実装できます。また、双方向アルゴリズムはキャッシュフレンドリーで、SIMDとの互換性も最も優れています。

リンク：
- [KMP](https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm)
- [双方向文字列マッチングアルゴリズム](https://en.wikipedia.org/wiki/Two-way_string-matching_algorithm)