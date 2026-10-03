---
title: 하나의 접속 뒤에 숨겨진 것들 1
category: Tech
tag: Linux
date: 2026-01-21T23:45:52+08:00
---


## Part 1 타입 URL로 시작하기
> 사용자가 타이핑을 하면, 브라우저는 수십 가지의 파싱과 처리 단계를 수행한다.

사용자가 브라우저의 주소 표시줄에 URL을 입력하고 엔터를 누르면, 일련의 극도로 복잡하고 고도로 최적화된 프로세스가 시작된다. 문자를 입력하는 것부터 시작해서, 브라우저는 단순히 "하나의 네트워크 요청"보다 훨씬 많은 일을 해야 한다.

브라우저는 사용자가 입력한 내용을 어떻게 이해하고, 이를 합법적인 요청 대상으로 파싱할까?

### 1.1 입력 처리
현대 브라우저(Chrome, Firefox 등)는 모두 멀티 프로세스 아키텍처를 채택하고 있으며, 그 목적은 다음과 같다:
- 안정성: 단일 페이지의 충돌이 전체 브라우저의 충돌을 일으키지 않음
- 보안: 프로세스 격리
- 성능: 병렬 처리

브라우저에 포함된 프로세스:
| 프로세스                      | 기능                            |
| ----------------------- | ----------------------------- |
| Browser Process(메인 브라우저 프로세스) |     인터페이스, 탭 관리, URL 파싱, 네트워크 정책, 보안 정책|
| Network Process   | DNS, Socket, 캐시 관리, Cookie, Proxy 등 |
| Renderer Process  | JS 실행, DOM 렌더링, CSS, 레이아웃, 페인트 |
| GPU Process             | 그래픽 가속, 렌더링         |
| Utility Processes       | 오디오 디코딩, 비디오 디코딩, 샌드박스 작업 수행             |

**메인 브라우저 프로세스**는 사용자의 입력을 처리하고, 입력된 내용이 "탐색"인지 "검색"인지 판단하며, 캐시/히스토리를 확인한 후, 최종적으로 네트워크 프로세스를 통해 요청을 시작한다.

먼저, 사용자가 키보드로 무언가를 입력하면 [`UrlBarController`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html##the-controller)가 [`UrlbarQueryContext`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#the-urlbarquerycontext)를 생성/업데이트하고, 그런 다음 `UrlBarController`가 querycontent를 각 [`UrlbarProvider`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#urlbarprovider)에 디스패치한다 -- 즉, 각 provider는 서로 다른 정보 소스에서 결과를 검색하고 반환하는 데 특화되어 있다.

다음으로, `UrlbarProvider`들이 후보(검색 제안 및 히스토리/북마크 기반 URL 포함)를 제공한다. Firefox의 경우, Firefox가 순서대로 실행하는 가장 중요한 휴리스틱은 다음과 같다:
1. 옴니박스 확장 키워드인가?
2. 북마크 키워드인가?
3. 자동 완성되어야 하는 도메인 이름 또는 URL인가?
4. 유효한 URL인가?
5. 최종적으로 기본 엔진을 사용한 검색 수행으로 폴백한다.

> 판단 규칙은 고정되어 있지 않으며, 브라우저 히스토리, 통계, 지능형 연관, 검색 엔진이 제공하는 제안 API의 조합에 의해 결정된다.

마지막으로, 사용자가 Enter를 누르면(또는 제안을 선택하면) 브라우저가 탐색 동작을 결정한다. 이 단계에서 브라우저는 "사용자가 입력한 원시 문자열"을 여러 내부 함수(예: [`looksLikeUrl`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#60), [`looksLikeorigin`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#162))에 전달하여 최종 URL을 결정한다:
- URL 형태인 경우: 브라우저는 [`getFixupURIInfo`](https://searchfox.org/firefox-main/source/docshell/base/URIFixup.sys.mjs#264)를 사용하여 수정하고(예: http:// 자동 추가, 올바른 스킴 철자 수정 등), 수정된 URL로 탐색한다.
- 그 외의 경우: 입력을 검색 키워드로 취급하고 *Search Service*(현재 검색 엔진 기반)를 사용하여 검색 URL을 구성한다.

*프로세스 워크플로우*:
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


### 1.2 URL 파싱
입력이 URL로 확인되면, 브라우저는 **WHATWG URL Standard**<sup>[1]</sup>에 따라 엄격하게 URL을 파싱한다.
URL의 기본 구조는 다음과 같다<sup>[2]</sup>:
```bash
scheme://userinfo@host:port/path?query#fragment
# scheme: https(default), http, ftp, ws, wss, file, data, blob etc.
```

그런 다음 브라우저는 다음을 수행한다:
1. 호스트 검사: 유니코드 호스트의 경우, DNS가 유니코드를 지원하지 않기 때문에 브라우저는 *IDNA2008 Standard*와 *Punycode 알고리즘*을 통해 punycode로 변환해야 한다.
  ```bash
  谷歌.com -> xn--flw351e.com
  ```
2. 경로 검사: 브라우저는 중복 슬래시 병합, `.`과 `..` 분석, 불법 문자 수정 등을 포함하여 URL을 자동으로 수정한다.
  ```bash
  https://example.com/foo//bar/../baz -> https://example.com/foo/baz
  ```
3. URL 문자 인코딩: URL을 UTF-8로 변환한다
  ```bash
  https://example.com/你好 -> https://example.com/%E4%BD%A0%E5%A5%BD
  ```

### 1.3 브라우저 보안 정책
브라우저는 URL 파싱 단계에서 일부 불법 콘텐츠를 거부한다.
1. JavaScript URL: 현대 브라우저는 엄격한 제한을 두어 주소 표시줄에서 직접 명령을 실행할 수 없다.
2. 일부 문서 프로토콜 거부: 보안상의 이유로 `file://`을 통한 임의의 로컬 경로 탐색이 허용되지 않는다.

### 1.4 URL 파싱 후 최종 결과
마지막으로, 브라우저는 완전히 표준화된 URL을 네트워크 프로세스에 넘겨주고, 다음을 진행할 준비를 한다:
- DNS 조회
- TCP 핸드셰이크
- TLS 핸드셰이크
- HTTP 요청 전송

이들은 후속 챕터에서 다룰 것이다.

## Part 2 전체 DNS 프로세스 심층 분석
브라우저는 사용자의 타이핑을 처리하고 표준 요청을 생성한다. 그 모든 요청의 대부분은 IP가 아닌 도메인으로 구성되기 때문에, 브라우저는 실제 연결 동작을 위해 도메인을 IP로 변환해야 하며, 이 관계를 해석하는 것을 *DNS 해석*이라고 한다.

많은 사람들이 DNS를 "도메인 이름을 IP 주소로 해석하는 시스템"이라고 생각한다—하지만 그것보다 훨씬 더 많은 것이다. 몇 가지 장면을 생각해 보자:
- 하나의 도메인이 여러 IPv4/IPv6 레코드에 대응
- DNS는 재귀, 반복, 다단계 캐싱 기능을 가지며, OS에도 hosts, nsswitch, resolv.conf 같은 내부 설정 파일이 존재
- 브라우저에도 내장 DNS 캐싱이 존재
- DoH/DoT(암호화 DNS), EDNS, DNSSEC 같은 메커니즘
- ISP가 DNS를 하이재킹, 포이즈닝, 리다이렉트할 수 있음
- CDN이 지능형 DNS를 사용하여 서로 다른 IP를 반환
...

> 농담이 아니다, DNS는 전체 인터넷에서 가장 과소평가되면서도 가장 중요한 기반 인프라 중 하나이다. 가장 재미있는 그림을 보라:
![The True World](https://i.postimg.cc/QNy0yzmd/The-Ture-World.jpg)

### 2.1 해석 순서
"해석 순서"란 운영 체제나 애플리케이션이 도메인 이름을 IP 주소로 해석하려고 시도할 때 따르는 우선순위 체인을 의미한다. 해석 순서는 운영 체제, 런타임, 네트워크 라이브러리에 따라 조금씩 다를 수 있지만, 일반적인 과정은 보통 다음과 같다:
1. **Hosts 파일**
2. **DNS 캐싱(로컬 캐시, 브라우저 캐시, 애플리케이션 캐시)**
3. **시스템 리졸버**
4. **로컬 DNS 서버(예: systemd-resolved / dnsmasq를 통한 127.0.0.1:53)**
5. **ISP DNS 또는 사용자 지정 DNS(예: 8.8.8.8, 1.1.1.1, 회사 인트라넷 DNS)**
6. **재귀 리졸버(resolver → root → TLD → authoritative)**

Linux의 경우 /etc/nsswitch.conf를 사용하여 파싱 순서를 제어한다:
```bash
hosts: files dns myhostname
```

이는 다음을 의미한다:
| 순서 | 방법  | 설명            |
| -- | ---------- | --------------- |
| 1  | files      | `/etc/hosts`    |
| 2  | dns        | dns 조회      |
| 3  | myhostname | systemd가 제공하는 특수 항목   |


### 2.2 DNS 캐시
DNS 캐시(DNS 리졸버 캐시라고도 함)는 이미 방문한 도메인 이름의 DNS 레코드(IPv4 주소용 A 레코드, IPv6용 AAAA 레코드 등)를 포함하는 장치의 임시 DNS 저장소이다. 이는 해당 레코드를 TTL(time-to-live)에 따라 유지한다.

DNS 캐싱은 높은 것부터 낮은 것까지 다계층 구조로 존재한다:
1. **운영 체제 DNS 캐시**: Windows는 dns-cache를 제공하고 `ipconfig /displaydns`로 세부 정보를 표시한다; MacOS에서는 터미널 애플리케이션을 열고 다음 명령을 입력한다 `sudo killall -INFO mDNSResponder`; Linux에는 OS 수준 DNS 캐싱이 없지만, `systemd-resolved`/`dnsmasq`를 통해 사용할 수 있다
2. **애플리케이션 계층 DNS 캐시**: 일부 애플리케이션은 DNS 캐시를 내장한다; 현대 브라우저(Chrome/Firefox/Edge)는 내부적으로 자체 DNS 캐시를 유지한다

*TTL*은 레코드가 캐시에 얼마나 오래 유지되는지를 결정한다. 더 짧은 TTL은 authoritative 네임서버에 더 큰 부하를 일으킬 수 있지만, 웹 서버나 MX 레코드 같은 중요한 서비스의 주소를 변경할 때 유용할 수 있으며, 따라서 서비스 이전 전에 DNS 관리자가 중단을 최소화하기 위해 종종 낮춘다.
![TTL](https://www.cloudns.net/images/wiki/What-is-TTL.png)

### 2.3 시스템 리졸버
DNS 리졸버는 사람이 읽기 쉬운 도메인 이름을 기계가 읽을 수 있는 IP 주소로 변환하는 중요한 첫 단계로, 장치와 DNS 서버 사이의 중개자 역할을 하여 올바른 IP를 찾으며, 종종 속도를 위해 결과를 캐싱한다. 복잡한 조회 과정을 처리하고, root, TLD, authoritative 네임서버에 쿼리한 후 IP를 브라우저에 반환하여 인터넷 탐색을 가능하게 한다.

`glibc`와 `systemd-resolved`는 Linux에서 일반 리졸버로 작동할 수 있다.

### 2.4 CDN/GeoDNS
물리적 거리는 접속 응답 속도에 영향을 미치고, 중앙 집중식 접속은 서버에 막대한 압력을 준다. CDN(Content Delivery Network)과 GeoDNS는 **서버 성능 부하를 분산**하면서 더 나은 경험을 제공할 수 있다.

CDN과 GeoDNS 기술은 도메인 이름 해석을 지리적으로 지능적이고 근접성에 의해 가속화되도록 만든다.

CDN은 다음을 통해 성능을 향상시킨다:
- Anycast IP: 동일한 IP가 여러 POP 사이트에서 브로드캐스트되어 사용자가 근처에서 접속할 수 있게 함
- 캐시: Edge Cache -> Regional Cache -> Origin Server
- 동적 라우터 최적화: 서비스 제공자가 지능형 라우팅을 통해 네트워크 혼잡을 회피

GeoDNS는 DNS 요청을 시작하는 클라이언트의 지리적 위치에 따라 서로 다른 IP 주소를 반환하여, 사용자 트래픽을 가장 가까운 또는 가장 적합한 서버로 리다이렉트한다.

> 대부분의 CDN의 authoritative DNS는 GeoDNS 자체이므로, 클라이언트는 자연스럽게 최적의 엣지 노드 IP를 얻는다.

### 2.5 DNS 공격, DNSSEC, DoT, DoH
DNS는 현대 네트워크 시스템에서 극히 중요한 기반이다. DNS에 대한 공격은 네트워크의 정상 작동에 심각한 영향을 미칠 수 있다.

DNS 공격은 도메인 이름에서 IP 주소로의 변환을 조작하여 서비스를 방해하고, 사용자를 악성 사이트(피싱/멀웨어)로 리다이렉트하고, 데이터를 탈취하거나 DDoS 공격을 시작하기 위해 DNS의 취약점을 악용한다. 일반적인 유형으로는 DNS Amplification(오픈 리졸버를 사용하여 대상에 응답을 플러딩)과 Cache Poisoning(DNS 캐시 레코드 손상)이 있으며, 종종 스푸핑과 같은 기술을 사용하여 출처를 숨긴다.

일부 DNS 공격:
- DNS Spoofing/Cache poisoning: 공격자가 리졸버에 위조된 레코드를 주입하여 도메인 이름을 잘못된 IP로 지정
- DNS Hijacking: 운영자나 공격자가 DNS 쿼리를 수정하거나 하이재킹하여 사용자를 잘못된 웹사이트로 유도
- DDoS

DNS는 너무나 중요하면서도 너무나 취약하다; DNS 공격을 어떻게 방어할 수 있을까?

1. Domain Name System Security Extension(DNSSEC)<sup>[3]</sup>은 스푸핑과 변조로부터 DNS를 보호하는 데 사용되는 보안 프로토콜이다. DNS 레코드에 디지털 서명을 추가하여 데이터의 진위와 무결성을 검증함으로써, 사용자가 합법적인 웹사이트에 접속하고 악성 사이트로 리다이렉트되지 않도록 보장한다.
2. DNS over TLS(DoT)는 DNS 쿼리를 암호화하여 포트 853을 통해 보안 TLS 터널(HTTPS처럼)로 감싸는 현대적인 프로토콜이다.
3. DNS over HTTPS(DoH)는 HTTPS 프로토콜을 사용하여 DNS 쿼리를 암호화하여 일반 웹 트래픽처럼 보이게 하며, ISP나 공격자의 스누핑과 변조를 방지하여 프라이버시와 보안을 강화한다.

## Links
[1]: The URL Pattern Standard gives a generic pattern syntax for matching URLs, and extracting the parts from them. See more about [URL Standard](https://url.spec.whatwg.org/)
[2]: HSTS: [HTTP Strict-Transport-Security](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security), the browser will force the use of HTTPS.
[3]: See [How DNSSEC Works](https://www.cloudflare.com/zh-cn/learning/dns/dnssec/how-dnssec-works/) to know how DNSSEC works.