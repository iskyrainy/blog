---
title: 一次访问背后的那些事 1
category: Tech
tag: Linux
date: 2026-01-21T23:45:52+08:00
---


## 第一部分 从输入 URL 开始
> 随着用户的输入，浏览器会执行数十个解析和处理步骤。

当用户在浏览器地址栏中输入 URL 并按下回车时，会触发一系列极其复杂且高度优化的流程。从输入字符开始，浏览器要做的事情远不止“一次网络请求”。

浏览器是如何理解用户输入的内容，并将其解析为一个合法的请求目标的？

### 1.1 处理输入
现代浏览器（Chrome、Firefox 等）都采用多进程架构，其目的包括：
- 稳定性：单个页面崩溃不会导致整个浏览器崩溃
- 安全性：进程隔离
- 性能：并行处理

浏览器包含的进程：
| 进程                      | 功能                            |
| ----------------------- | ----------------------------- |
| 浏览器进程（主浏览器进程） |     界面、标签页管理、URL 解析、网络策略、安全策略|
| 网络进程   | DNS、Socket、缓存管理、Cookie、代理等 |
| 渲染进程  | 执行 JS、渲染 DOM、CSS、布局、绘制 |
| GPU 进程             | 图形加速、渲染         |
| 工具进程       | 执行音频解码、视频解码以及沙箱任务             |

**主浏览器进程**会处理用户的输入，解码所输入的内容是“导航”还是“搜索”，检查缓存/历史记录，最终通过网络进程发起请求。

首先，当用户在键盘上输入内容时，[`UrlBarController`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html##the-controller) 会构建/更新一个 [`UrlbarQueryContext`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#the-urlbarquerycontext)，然后 `UrlBarController` 将查询内容分发给各个 [`UrlbarProvider`](https://firefox-source-docs.mozilla.org/browser/urlbar/overview.html#urlbarprovider)——每个 provider 专门负责从不同的信息源中搜索并返回结果。

其次，`UrlbarProvider` 会提供候选项（包括搜索建议以及基于历史记录/书签的 URL）。对于 Firefox，按照其运行顺序，最重要的启发式规则如下：
1. 是否为 omnibox 扩展关键字？
2. 是否为书签关键字？
3. 是否为应自动填充的域名或 URL？
4. 是否为有效的 URL？
5. 最终回退到使用默认引擎执行搜索。

> 判断规则并非固定不变，而是由浏览器的历史记录、统计信息、智能关联以及搜索引擎提供的建议 API 共同决定。

最后，用户按下回车（或选择某条建议），浏览器便确定导航行为。在这一步中，浏览器会将“用户输入的原始字符串”传递给若干内部函数（例如 [`looksLikeUrl`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#60)、[`looksLikeorigin`](https://searchfox.org/firefox-main/source/toolkit/modules/UrlUtils.sys.mjs#162)）以确定最终的 URL：
- 类似 URL：浏览器将使用 [`getFixupURIInfo`](https://searchfox.org/firefox-main/source/docshell/base/URIFixup.sys.mjs#264) 进行修正（例如，自动添加 http://、修正 scheme 拼写等），然后导航到修正后的 URL。
- 其他：将输入视为搜索关键字，并使用*搜索服务*（基于当前搜索引擎）构造一个搜索 URL。

*处理流程*：
```bash
用户输入
  ↓
去除空白 / 规范化
  ↓
是否包含协议？ ---- 是 → 有效 URL → 加载 URL
  ↓
URL 语法是否有效？ ---- 是 → DNS 查询 → 加载 URL
  ↓
是否类似域名？ ---- 是 → 尝试域名 → 若 DNS 失败 → 搜索
  ↓
否则 → 搜索查询
```


### 1.2 URL 解析
一旦确认输入是一个 URL，浏览器就会严格依据 **WHATWG URL 标准**<sup>[1]</sup> 解析该 URL。
URL 的基本结构如下<sup>[2]</sup>：
```bash
scheme://userinfo@host:port/path?query#fragment
# scheme: https(默认)、http、ftp、ws、wss、file、data、blob 等
```

接下来浏览器会执行：
1. 主机检查：对于那些 Unicode 主机，由于 DNS 不支持 Unicode，因此浏览器必须通过 *IDNA2008 标准*和 *Punycode 算法*将其转换为 punycode。
  ```bash
  谷歌.com -> xn--flw351e.com
  ```
2. 路径检查：浏览器会自动修正 URL，包括合并多余斜杠、解析 `.` 和 `..`、修正非法字符
  ```bash
  https://example.com/foo//bar/../baz -> https://example.com/foo/baz
  ```
3. URL 字符编码：将 URL 转换为 UTF-8
  ```bash
  https://example.com/你好 -> https://example.com/%E4%BD%A0%E5%A5%BD
  ```

### 1.3 浏览器安全策略
浏览器会在 URL 解析阶段拒绝某些非法内容。
1. JavaScript URL：现代浏览器有严格的限制，无法直接在地址栏中执行命令。
2. 拒绝某些文档协议：出于安全原因，不允许使用 `file://` 导航到任意本地路径。

### 1.4 URL 解析后的最终结果
最后，浏览器将一个完全标准化的 URL 交给网络进程，准备继续执行：
- DNS 查询
- TCP 握手
- TLS 握手
- HTTP 请求发送

这些将在后续章节中讨论。

## 第二部分 深入剖析整个 DNS 过程
浏览器处理用户的输入并生成标准请求。这些请求中的大多数都是基于域名而非 IP 构建的，因此浏览器必须将域名转换为 IP 才能进行真正的连接操作，这种关系解析被称为 *DNS 解析*。

许多人认为 DNS 只是“一个将域名解析为 IP 地址的系统”——但它远不止于此。想想这些场景：
- 一个域名对应多条 IPv4/IPv6 记录
- DNS 具有递归、迭代和多级缓存特性，操作系统内部也有 hosts、nsswitch、resolv.conf 等配置文件
- 浏览器也有内置的 DNS 缓存
- 存在 DoH/DoT（加密 DNS）、EDNS、DNSSEC 等机制
- ISP 可能会劫持、投毒和重定向 DNS
- CDN 使用智能 DNS 返回不同的 IP
……

> 没开玩笑，DNS 是整个互联网中最被低估、却又最关键的基础设施之一。看这张最有趣的图：
![真实世界](https://i.postimg.cc/QNy0yzmd/The-Ture-World.jpg)

### 2.1 解析顺序
“解析顺序”是指操作系统或应用程序在尝试将域名解析为 IP 地址时所遵循的优先级链。不同操作系统、运行时和网络库之间的解析顺序可能略有差异，但一般流程通常如下：
1. **Hosts 文件**
2. **DNS 缓存（本地缓存、浏览器缓存、应用缓存）**
3. **系统解析器**
4. **本地 DNS 服务器（例如通过 systemd-resolved / dnsmasq 的 127.0.0.1:53）**
5. **ISP DNS 或自定义 DNS（例如 8.8.8.8、1.1.1.1、公司内网 DNS）**
6. **递归解析器（resolver → root → TLD → authoritative）**

对于 Linux 而言，它使用 /etc/nsswitch.conf 控制解析顺序：
```bash
hosts: files dns myhostname
```

其含义为：
| 顺序 | 方法  | 说明            |
| -- | ---------- | --------------- |
| 1  | files      | `/etc/hosts`    |
| 2  | dns        | dns 查询      |
| 3  | myhostname | systemd 提供的特殊条目   |


### 2.2 DNS 缓存
DNS 缓存（又称 DNS 解析器缓存）是设备上的临时 DNS 存储，其中包含已访问域名的 DNS 记录（IPv4 地址的 A 记录、IPv6 的 AAAA 记录等）。它会根据记录的生存时间（TTL）保留这些记录。

DNS 缓存以多层结构存在，从高到低为：
1. **操作系统 DNS 缓存**：Windows 提供 dns-cache，并可通过 `ipconfig /displaydns` 显示详情；在 MacOS 中打开终端应用程序并输入以下命令 `sudo killall -INFO mDNSResponder`；Linux 没有操作系统级别的 DNS 缓存，但可以通过 `systemd-resolved`/`dnsmasq` 来使用
2. **应用层 DNS 缓存**：一些应用程序会内嵌 DNS 缓存；例如现代浏览器（Chrome/Firefox/Edge）在内部维护自己的 DNS 缓存

*TTL* 决定了记录缓存多久。较短的 TTL 会给权威域名服务器带来更重的负载，但在更改 Web 服务器或 MX 记录等关键服务的地址时可能很有用，因此 DNS 管理员通常会在服务迁移之前降低 TTL，以尽量减少中断。
![TTL](https://www.cloudns.net/images/wiki/What-is-TTL.png)

### 2.3 系统解析器
DNS 解析器是将人类友好的域名转换为机器可读 IP 地址的关键第一步，它充当设备与 DNS 服务器之间的中间人，以找到正确的 IP，通常通过缓存结果来提高速度。它处理复杂的查询过程，查询根、TLD 和权威域名服务器，然后将 IP 返回给浏览器，从而使互联网导航成为可能。

在 Linux 上，`glibc` 和 `systemd-resolved` 可以作为普通的解析器工作。

### 2.4 CDN/GeoDNS
物理距离会影响访问响应速度，而集中式访问会给服务器带来巨大压力。内容分发网络（CDN）和 GeoDNS 可以在提供更好体验的同时**平衡**服务器性能负载。

CDN 和 GeoDNS 技术通过就近访问使域名解析具备地理位置智能并实现加速。

CDN 通过以下方式提升性能：
- Anycast IP：同一 IP 在多个 POP 站点广播，使用户能够就近访问
- 缓存：边缘缓存 -> 区域缓存 -> 源站服务器
- 动态路由优化：服务提供商通过智能路由避开网络拥塞。

GeoDNS 根据发起 DNS 请求的客户端的地理位置返回不同的 IP 地址，从而将用户流量重定向到最近或最合适的服务器。

> 大多数 CDN 的权威 DNS 本身就是 GeoDNS，因此客户端自然能获得最佳的边缘节点 IP。

### 2.5 DNS 攻击、DNSSEC、DoT、DoH
DNS 是现代网络系统中极其重要的基础。对 DNS 的攻击可能严重影响网络的正常运行。

DNS 攻击利用 DNS 中的漏洞，通过操纵域名到 IP 地址的转换来破坏服务、将用户重定向到恶意网站（钓鱼/恶意软件）、窃取数据或发起 DDoS 攻击。常见类型包括 DNS 放大攻击（利用开放解析器向目标发送大量响应）和缓存投毒（破坏 DNS 缓存记录），通常使用欺骗等技术来隐藏来源。

一些 DNS 攻击：
- DNS 欺骗/缓存投毒：攻击者向解析器注入伪造记录，将域名指向错误的 IP
- DNS 劫持：运营商或攻击者修改或劫持 DNS 查询，将用户引导到错误的网站
- DDoS

DNS 既如此重要又如此脆弱；我们该如何防御 DNS 攻击？

1. 域名系统安全扩展（DNSSEC）<sup>[3]</sup> 是一种用于保护 DNS 免受欺骗和篡改的安全协议。它通过向 DNS 记录添加数字签名来验证数据的真实性和完整性，确保用户访问合法的网站，而不会被重定向到恶意站点。
2. DNS over TLS（DoT）是一种现代协议，它对 DNS 查询进行加密，将其包装在端口 853 上的安全 TLS 隧道（类似 HTTPS）中。
3. DNS over HTTPS（DoH）使用 HTTPS 协议对 DNS 查询进行加密，使其看起来像普通的 Web 流量，通过防止 ISP 或攻击者的窥探和篡改来增强隐私和安全性。

## 链接
[1]: URL Pattern 标准为匹配 URL 并从中提取各部分提供了一个通用模式语法。更多内容参见 [URL 标准](https://url.spec.whatwg.org/)
[2]: HSTS：[HTTP Strict-Transport-Security](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)，浏览器将强制使用 HTTPS。
[3]: 参见 [DNSSEC 工作原理](https://www.cloudflare.com/zh-cn/learning/dns/dnssec/how-dnssec-works/) 了解 DNSSEC 的工作方式。