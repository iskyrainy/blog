---
title: Things Behind One Access 1
category: Tech
tag: Linux
date: 2026-01-21T23:45:52+08:00
---


## Part 1 Start With Type URL
> With user's typing, the browser will performes dozens of parsing and processing steps.

When user type a URL into browser's address bar and press enter, it trigger a series of extremely complex and highly optimized processes. Starting with entering characters, the browser has to do much more than "one network request". 

How does the browser understand the content entered by the user and parse it into a legitimate request target?

### 1.1 Process the input
Modern browsers (Chrome, Firefox etc.) all employ a multi-process architecture, the purpose of which includes:
- Stability: a crash on a single page will not cause the entire browser to crash
- Security: process isolation
- Performance: parallel processing

Processes included by browsers:
| process                      | function                            |
| ----------------------- | ----------------------------- |
| Browser Process(main browser process) |     Interface, tab management, URL parsing, network policy, security policy|
| Network Process   | DNS, Socket, Cache Management, Cookie, Proxy, etc. |
| Renderer Process  | Execute JS, render DOM, CSS, layout, paint |
| GPU Process             | Graphics acceleration, rendering         |
| Utility Processes       | Perform audio decoding, video decoding, and sandbox tasks             |

The **main browser process** will process user's input, decode typing whether "navigation" or "search", check cache/history, finally start the request by network process.

Firstly, when a user types something on the keyboard, the [`UrlBarController`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html##the-controller) will build/update an [`UrlbarQueryContext`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#the-urlbarquerycontext), then `UrlBarController` dispatch querycontent to each [`UrlbarProvider`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#urlbarprovider)s -- that a provider is specialized into searching and returning results from different information sources.

Secondly, `UrlbarProvider`s offer candidates (including search suggestions and URLs based on history/bookmarks). For Firefox, the most important heuristics in the order that Firefox runs through them are:
1. An omnibox extension keyword?
2. A bookmark keyword?
3. A domain name or URL that should be autofilled?
4. A valid URL?
5. Ultimately fall back to performing a search using the default engine.

> The judgment rule is not fixed, but is determined by a combination of browser history, statistics, intelligent association, and suggestion APIs provided by search engines.

Finally, the user presses Enter (or selects a suggestion) and the browser determines the navigation behavior. In this step, the browser passes the "raw string entered by the user" to several internal functions(such as [`looksLikeUrl`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#60), [`looksLikeorigin`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#162)) to determine the final URL:
- URL-like: the browser will use [`getFixupURIInfo`](https://searchfox.org/firefox-main/source/docshell/base/URIFixup.sys.mjs#264) to correct (e.g., automatically add) http://(correct scheme spelling, etc.), and then navigate to the corrected URL.
- other: treat the input as search keywords and use the *Search Service* (based on the current search engine) to construct a search URL.

*Process workflow*:
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


### 1.2 URL parsing
Once the input is confirmed as a URL, the browser will strictly according to the **WHATWG URL Standard**<sup>[1]</sup> parse the URL.
The basic structure of a URL is as follows<sup>[2]</sup>:
```bash
scheme://userinfo@host:port/path?query#fragment
# scheme: https(default), http, ftp, ws, wss, file, data, blob etc.
```

Then browser will do:
1. host check: for those Unicode host, because DNS does not support Unicode, so the browser must convert it to punycode via *IDNA2008 Standard* and *Punycode algorithm*.
  ```bash
  谷歌.com -> xn--flw351e.com
  ```
2. path check: browser will automatically fix URLs, includes merge redundant slashes, analysis `.` and `..`, fix illegal characters
  ```bash
  https://example.com/foo//bar/../baz -> https://example.com/foo/baz
  ```
3. url character encoding: turn URL into UTF-8
  ```bash
  https://example.com/你好 -> https://example.com/%E4%BD%A0%E5%A5%BD
  ```

### 1.3 Browser security policy
Browsers will reject some illegal content during the URL parsing stage.
1. JavaScript URL: Modern browsers have strict limitations and cannot execute commands directly in the address bar.
2. reject some document protocols: With `file://` avigation to arbitrary local paths is not allowed for security reasons.

### 1.4 Final result after URL parsing
Finally, the browser hands over a fully standardized URL to the network process, ready to proceed:
- DNS lookup
- TCP handshake
- TLS handshake
- HTTP request sending

These will be discussed in subsequent chapters.

## Part 2 In-depth Analysis of The Entire DNS Process
Browser handles user typing and generates the standard request. Most of all those requests are built by domain rather IP, so browser has to turn domain to IP for the real connect action, which the relation resolving is called *DNS resolution*.

Many people consider DNS as "a system that resolves domain names into IP addresses"—but it is far more that. Think about some scenes:
- One domain correspond to multiple IPv4/IPv6 records
- DNS has recursive, iterative, and multi-level caching features, and OS also has internal configuration files such as hosts, nsswitch, and resolv.conf
- Browsers also have built-in DNS caching
- Mechanisms such as DoH/DoT (Encrypted DNS), EDNS, and DNSSEC
- ISPs may hijack, poison, and redirect DNS
- CDNs use intelligent DNS to return different IPs
...

> No kiding, DNS is one of the most underestimated, yet most critical, underlying infrastructures in the entire Internet. See the most funny picture:
![The True World](https://i.postimg.cc/QNy0yzmd/The-Ture-World.jpg)

### 2.1 Resolution order
"Resolution Order" refers to the priority chain followed by an operating system or application when attempting to resolve a domain name into an IP address. The resolution order may vary slightly between different operating systems, runtimes, and network libraries, but the general process is usually as follows:
1. **Hosts file**
2. **DNS caching (local cache, browser cache, application cache)**
3. **System resolver**
4. **Local DNS server (e.g., 127.0.0.1:53 via systemd-resolved / dnsmasq)**
5. **ISP DNS or custom DNS (e.g., 8.8.8.8, 1.1.1.1, company intranet DNS)**
6. **Recursive resolver (resolver → root → TLD → authoritative)**

For Linux, it usage /etc/nsswitch.confControlling the parsing order:
```bash
hosts: files dns myhostname
```

which meaning:
| order | method  | desc            |
| -- | ---------- | --------------- |
| 1  | files      | `/etc/hosts`    |
| 2  | dns        | dns lookup      |
| 3  | myhostname | special entry provided by systemd   |


### 2.2 DNS cache
The DNS cache (also known as DNS resolver cache) is a temporary DNS storage on a device that contains DNS records of already visited domain names (A records for IPv4 addresses, AAAA records for IPv6, etc.). It keeps those records, depending on their time-to-live (TTL).

DNS caching exists in a multi-tiered structure, from high to low:
1. **Operating System DNS Cache**: Windows offers dns-cache and show detail by `ipconfig /displaydns`; In MacOS open the terminal application and enter the following command `sudo killall -INFO mDNSResponder`; Linux has no OS-level DNS caching, but it can be using by `systemd-resolved`/`dnsmasq`
2. **Application-layer DNS Cache**: Some applications will embed dns cache; like modern browsers (Chrome/Firefox/Edge) maintain their own DNS cache internally

*TTL* is what dictates how long your records stay cached. Shorter TTLs can cause heavier loads on an authoritative nameserver, but can be useful when changing the address of critical services like Web servers or MX records, and therefore are often lowered by the DNS administrator prior to a service being moved, in order to minimize disruptions.
![TTL](https://www.cloudns.net/images/wiki/What-is-TTL.png)

### 2.3 System resolver
A DNS Resolver is the crucial first step in translating human-friendly domain names into machine-readable IP addresses, acting as a middleman between your device and the DNS servers to find the correct IP, often by caching results for speed. It handles the complex lookup process, querying root, TLD, and authoritative name servers, then delivers the IP back to your browser, making internet navigation possible.

`glibc` and `systemd-resolved` can act as normal resolver work on Linux. 

### 2.4 CDN/GeoDNS
Physical distance affects access response speed, while centralized access puts enormous pressure on servers. Content Delivery Networks (CDNs) and GeoDNS can provide a better experience while **balancing** server performance load.

CDN and GeoDNS technology make domain name resolution geo-intelligent and accelerated by proximity.

CDN improve performance by:
- Anycast IP : The same IP broadcasts at multiple POP sites, enabling users to access it nearby
- Cache: Edge Cache -> Regional Cache -> Origin Server
- Dynamic router opt: service providers avoid network congestion through intelligent routing.

GeoDNS returns different IP addresses based on the geographical location of the client initiating the DNS request, thereby redirecting user traffic to the nearest or most suitable server.

> The authoritative DNS of most CDNs is GeoDNS itself, so that the client naturally gets the best edge node IP.

### 2.5 DNS attack, DNSSEC, DoT, DoH
DNS is an extremely important foundation in modern network systems. Attacks on DNS can severely impact the normal operation of the network.

A DNS attack exploits vulnerabilities in the DNS to disrupt services, redirect users to malicious sites (phishing/malware), steal data, or launch DDoS attacks, by manipulating the translation of domain names to IP addresses. Common types include DNS Amplification (using open resolvers to flood targets with responses) and Cache Poisoning (corrupting DNS cache records), often using techniques like spoofing to hide the source.

Some DNS attacks:
- DNS Spoofing/Cache poisoning: attacker injects a forged record into the resolver, pointing the domain name to the wrong IP
- DNS Hijacking: Operators or attackers modify or hijack DNS queries to get users to the wrong website
- DDoS

DNS is both so important and so vulnerable; how can we defend against DNS attacks?

1. Domain Name System Security Extension (DNSSEC)<sup>[3]</sup> is a security protocol used to protect the DNS from spoofing and tampering. It verifies the authenticity and integrity of data by adding digital signatures to DNS records, ensuring that users access legitimate websites and are not redirected to malicious sites. 
2. DNS over TLS (DoT) is a modern protocol that encrypts DNS queries, wrapping them in a secure TLS tunnel (like HTTPS) over port 853.
3. DNS over HTTPS (DoH) encrypts DNS queries using the HTTPS protocol, making them look like regular web traffic, which enhances privacy and security by preventing snooping and tampering from ISPs or attackers.

## Links
[1]: The URL Pattern Standard gives a generic pattern syntax for matching URLs, and extracting the parts from them. See more about [URL Standard](https://url.spec.whatwg.org/)
[2]: HSTS: [HTTP Strict-Transport-Security](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security), the browser will force the use of HTTPS.
[3]: See [How DNSSEC Works](https://www.cloudflare.com/zh-cn/learning/dns/dnssec/how-dnssec-works/) to know how DNSSEC works.
