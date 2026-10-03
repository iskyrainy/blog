---
title: 문자열 빠르게 매칭하기
category: Tech
tag: Rust
date: 2026-03-21T00:10:24+08:00
---


## Part 1 문자열의 위치 찾기
최근에 *leetcode*에서 아주 기초적인 문제를 보았다. [이 문제](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/description/)는 두 개의 `str`을 주고 `haystack`에서 `needle`이 처음 나타나는 위치를 찾는 것이다. 아주 간단하게 들린다! 가장 직관적인 방법은 모든 문자를 하나씩 매칭하는 것이다. 여기서 첫 번째 답을 아주 빠르게 낼 수 있다.
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

하지만 이걸로 충분할까?

부분 문자열의 인덱스를 찾는 것은 매우 중요한 문제이고, *검색 엔진* 등에서 널리 사용된다. *O(n * m)* 시간 복잡도를 가지는 첫 번째 답을 사용하면 사용자가 응답을 받기까지 더 오래 기다려야 하므로 받아들일 수 없다.

## Part 2 KMP
Knuth–Morris–Pratt 알고리즘(*KMP*)은 1977년 *Donald Knuth*, *Vaughan Pratt*, *James H. Morris*가 제안한 효율적인 문자열 매칭 알고리즘이다. 패턴 문자열 전처리 단계에서 부분 매칭 테이블을 구성하여 중복 비교를 피함으로써, 본문 문자열 내에서 부분 문자열 검색을 선형 시간에 수행한다.

KMP 알고리즘은 패턴 문자열을 전처리하여 각 위치에서의 최장 접두사-접미사 매칭 길이(즉, 부분 매칭 테이블)를 계산한다. 매칭 과정에서 문자 불일치가 발생하면, 이 테이블을 사용하여 이미 매칭된 것으로 알려진 위치로 점프하며, 텍스트의 다음 문자로 단순히 되돌아가지 않으므로 중복 비교를 피한다.

다음은 KMP의 구현이다:
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

시간 복잡도: *O(n + m)*

## Part 3 투웨이 문자열 매칭 알고리즘
`naive_find`와 비교하면, `kmp_find`는 알고리즘 시간 복잡도를 *O(n * m)*에서 *O(n + m)*로 개선한다. 상당히 중요한 최적화이다.

하지만 이걸로 충분할까?

**투웨이 문자열 매칭 알고리즘**(Crochemore–Perrin 알고리즘이라고도 함)은 1991년 *Maxime Crochemore*와 *Dominique Perrin*이 제안한 효율적인 결정적 문자열 매칭 방법이다. 이 알고리즘은 최악의 경우에도 선형 시간에 텍스트에서 모든 패턴 매칭을 찾을 수 있으며, 문자열 검색 이론에서 중요한 성과이다.

투웨이 알고리즘은 접두사 함수와 문자열 주기성 분석의 아이디어를 결합한다. 최대 접두사-접미사 경계(임계 분해)를 계산하여 패턴 문자열을 두 부분으로 나누고, 최소 주기를 기반으로 텍스트에서 양방향 슬라이딩 매칭을 수행한다. 이 알고리즘은 사전식 비교 메커니즘을 활용하여 중복 매칭을 줄이므로 선형 복잡도를 보장한다.

주요 단계:
1. 패턴 문자열의 핵심 분해 지점을 계산하여, 결과로 나온 두 부분이 특정 주기성 조건을 만족하도록 한다.
2. 패턴의 최소 주기를 결정한다.
3. 텍스트를 주기적으로 이동하며, 각각 왼쪽과 오른쪽으로 매칭을 검증한다.

이 분할 정복 매칭 방법은 중복 비교를 피한다.

다음은 투웨이의 간단한 구현이다:
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

시간 복잡도: 최악의 경우 *O(n)*

> 더 흥미로운 점은, 투웨이는 `find`와 `rfind`를 쉽게 구현할 수 있다. 그리고 투웨이는 캐시 친화적이며 SIMD 호환성이 가장 좋다.

링크:
- [KMP](https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm)
- [투웨이 문자열 매칭 알고리즘](https://en.wikipedia.org/wiki/Two-way_string-matching_algorithm)