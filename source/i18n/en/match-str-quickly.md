---
title: 快速字符串匹配
category: Tech
tag: Rust
date: 2026-03-21T00:10:24+08:00
---


## 第 1 部分 查找字符串的位置
最近，我在 *leetcode* 上看到一个非常基础的问题。[这个问题](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/description/) 给定两个 `str`，需要找到 `needle` 在 `haystack` 中第一次出现的位置。听起来非常简单！最直接的方法就是逐个字符进行匹配。这里可以很快给出第一个答案。
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

但这样真的可以吗？

查找子串的位置是一个非常重要的问题，它被广泛应用于 *search engine*（搜索引擎）等领域。使用第一个答案，其时间复杂度为 *O(n * m)*，会让用户不得不等待更长时间才能得到响应，这是不可接受的。

## 第 2 部分 KMP
Knuth–Morris–Pratt 算法（*KMP*）是一种高效的字符串匹配算法，由 *Donald Knuth*、*Vaughan Pratt* 和 *James H. Morris* 于 1977 年提出。它通过在模式串预处理阶段构建部分匹配表，在主串中在线性时间内完成子串搜索，避免了冗余比较。

KMP 算法对模式串进行预处理，计算每个位置的最长前缀-后缀匹配长度（即部分匹配表）。在匹配过程中，当发生字符不匹配时，算法利用该表跳转到已知的匹配位置，而不是简单地回溯到文本中的下一个字符，从而避免了冗余比较。

下面给出一个 KMP 的完整实现：
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

时间复杂度：*O(n + m)*

## 第 3 部分 双向字符串匹配算法
与 `naive_find` 相比，`kmp_find` 将算法时间复杂度从 *O(n * M)* 降低到 *O(n + m)*。这是一个相当显著的优化。

但这样真的可以吗？

**双向字符串匹配算法**（也称为 Crochemore–Perrin 算法）是一种高效的确定性字符串匹配方法，由 *Maxime Crochemore* 和 *Dominique Perrin* 于 1991 年提出。该算法可以在最坏情况下在线性时间内找到文本中所有模式匹配，代表了字符串搜索理论中的一项重要成就。

双向算法结合了前缀函数和字符串周期性分析的思想。它通过计算最大前缀-后缀边界（关键分解）将模式串分为两部分，并根据其最小周期在文本中进行双向滑动匹配。该算法利用字典序比较机制来减少冗余匹配，从而保证线性复杂度。

关键步骤：
1. 计算模式串的关键分解点，确保得到的两个部分满足特定的周期性条件。
2. 确定模式的最小周期。
3. 按周期在文本中移动，分别验证左右两部分的匹配。

这种分治匹配方法避免了冗余比较。

下面是一个双向算法的简单实现：
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

时间复杂度：最坏情况下为 *O(n)*

> 更有趣的是，双向算法可以轻松实现 `find` 和 `rfind`。而且双向算法对缓存友好，并且具有最佳的 SIMD 兼容性。

链接：
- [KMP](https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm)
- [双向字符串匹配算法](https://en.wikipedia.org/wiki/Two-way_string-matching_algorithm)