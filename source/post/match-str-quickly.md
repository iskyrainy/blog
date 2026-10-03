---
title: Match Str Quickly
category: Tech
tag: Rust
date: 2026-03-21T00:10:24+08:00
---


## Part 1 Find the Pos of Str
Recently, I see a very base problem in *leetcode*. [This problem](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/description/) gives two `str` and need find the first pos of `needle` in `haystack`. Sounds very simple! The most straightest way is matching every char one by one. Here can very quickly give the first answer.
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

But does it is OK? 

Find the substr's indexes is a very important problem, it is widely used in *search engine* etc. Use the first answer which is a *O(n * m)* time complexity, will make users have to wait more time to get response, it's unacceptable.

## Part 2 KMP
The Knuth–Morris–Pratt algorithm (*KMP*) is an efficient string matching algorithm proposed by *Donald Knuth*, *Vaughan Pratt*, and *James H. Morris* in 1977. It achieves substring searching within the main string in linear time by constructing a partial matching table during the pattern string preprocessing stage, avoiding redundant comparisons.

The KMP algorithm preprocesses the pattern string to calculate the longest prefix-suffix matching length (i.e., a partial matching table) for each position. During the matching process, when a character mismatch occurs, the algorithm uses this table to jump to a known matching position, rather than simply backtracking to the next character in the text, thus avoiding redundant comparisons.

Here give a completion of KMP:
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

Time complexity: *O(n + m)*

## Part 3 Two-Way String Match Algorithm
Compare to `naive_find`, `kmp_find` improve algorithm time complexity from *O(n * M)* down to *O(n + m)*. It's quite a significant optimization.

But does it is OK?

**The Two-way string matching algorithm** (also known as the Crochemore–Perrin algorithm) is an efficient deterministic string matching method proposed by *Maxime Crochemore* and *Dominique Perrin* in 1991. This algorithm can find all pattern matches in a text in linear time in the worst case, representing a significant achievement in string search theory.

Two-way algorithm combines the ideas of prefix functions and string periodicity analysis. It divides the pattern string into two parts by calculating the maximum prefix-suffix boundary (critical factorization) and performs bidirectional sliding matching in the text based on its minimum period. The algorithm utilizes a lexicographical comparison mechanism to reduce redundant matching, thus ensuring linear complexity.

Key steps:
1. Calculate the key decomposition points of the pattern string, ensuring that the two resulting parts satisfy a specific periodicity condition.
2. Determine the minimum period of the pattern.
3. Move periodically through the text, verifying matches to the left and right respectively.

This divide-and-conquer matching method avoids redundant comparisons.

Here is a simple implementation of Two-way:
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

Time complexity: *O(n)* in the worst

> More interesting, Two-way can easily implement `find` and `rfind`. And Two-way is also cache-friendly and has the best SIMD compatibility.

Links:
- [KMP](https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm)
- [Two-way string-matching algorithm](https://en.wikipedia.org/wiki/Two-way_string-matching_algorithm)
