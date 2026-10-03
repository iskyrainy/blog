---
title: 如何访问真实世界
category: Tech
tag: Linux
date: 2026-02-27T00:08:49+08:00
---


## 第一部分 你所知道的集群防火墙
方先生是一个超级集群的管理员。他声称要保护集群中的节点，抵御外部恶意攻击。因此，方先生建造了一堵巨大且*虚假*的**防火墙**，阻断了集群内外部的直接通信。

长期以来，大多数服务都可以在集群内提供（无论质量如何），但总有一些需求必须与集群外的其他集群进行通信。俗话说，“知己知彼，百战不殆”。只有深入理解防火墙是如何构建的，我们才能更好地突破它。

## 第二部分 你会如何建造它？
如果你是集群的管理员，你会如何建造这堵墙？

### 2.1 IP 封锁
如果你能控制集群的所有路由器，最直接的方法就是封锁黑名单中的任何 IP。当路由器检测到数据包的目标 IP 在黑名单中时，路由器会丢弃该数据包或将数据包转发到不存在的地方。

这种方法的核心在于需要维护一个庞大的黑名单。
- 针对特定服务器的单个 IP
- 针对整个机房的 IP 段封锁，例如某些廉价 VPS 提供商

### 2.2 DNS 污染
由于 DNS 查询（UDP 绑定端口 53）默认不加密且无连接，这为拦截提供了极大的便利。

这是一种非常有效且经济的方法。DNS 是现代网络的基石；几乎所有服务都配置了域名，需要 DNS 解析才能正确访问其服务。当集群内的用户尝试使用 DNS 解析一个“非法”服务的域名时，集群 DNS 服务器只需返回一个错误的解析结果，例如 127.0.0.1。这样，用户的“非法”请求甚至都不会离开网卡。

当然，这种方法也相对容易被“处理”。用户只需手动修改本地的 hosts 文件，添加正确的域名和对应的 IP 地址，并将本地 hosts 文件设置为优先用于 DNS 解析即可。

### 2.3 关键字过滤与 TCP RST 重置
即使 IP 没有被封锁，如果用户请求数据包中包含特定的“敏感字符”，*管理员*就会采取行动。

这是针对非加密流量（如 HTTP）或半加密流量（TLS 握手阶段等）的精确打击。管理员在提取数据包并匹配预设的“敏感”词库时，会向通信双方（用户的电脑和服务器）发送伪造消息。**RST** 数据包强制中断当前的 TCP 连接。结果总是像那样——网页加载到一半突然显示*“连接已被重置”*。

### 2.4 深度包检测
如果无法根据目标域名和 IP 地址实现拦截，就需要更深入的数据分析来判断是否拦截。尽管现在大多数通信都使用 TLS 加密，深度包检测（DPI）仍然可以穿透数据包进行识别和拦截。

大多数 DPI 检测针对 `L3` 和 `L7`，包括源/目标 IP 和请求负载。完整的 DPI 流程如下：
1. 提取：DPI 引擎捕获该数据包，识别端口并调用相应的解析模块。比如 `80` 端口，就调用 `HTTP` 解析模块。DPI 也可以通过*指纹识别*来检测，即协议特有的字节序列和长度分布
2. 重组：如果搜索词很长并被分成多个数据包，DPI 会在内存中*重新组装它们*（TCP 重组），以确保关键字不会因为分包而逃过检测
3. 匹配：DPI 扫描负载以检测*秘密关键字*，这些是预设的过滤规则
4. 执行：丢弃数据包或发送 `TCP RST` 数据包进行拦截

这就是为什么现代隧道协议（如 `VLESS`/`REALITY`）努力消除任何已知特征，并将所有握手过程伪装成完美无瑕的 HTTPS 流量——目标是让 DPI 引擎相信这只是一个发往合规网站的正常数据包。

### 2.5 流量统计分析
这是目前最难应对的动态方法。此时，分析和检测不再依赖静态的域名/IP/关键字，而是关注整个流量段的行为特征。

但如何分析流量呢？最明显的一个方面是所有加密流量都表现出高随机性。如果一个 IP 持续输出高熵随机数据且不具有典型的 HTTPS 指纹，就会被标记。
同样，连接时间和数据包大小也能揭示特征：
- 代理流量通常是持久的长连接
- 视频流、网页浏览和加密隧道的包长度特征完全不同

当用户的数据行为在评分系统中超过一定阈值时，就会被封锁。

## 第三部分 如何挖一条隧道？
在当前网络翻墙技术的生态中，`V2Ray`、`Xray` 和 `sing-box` 是三个最核心且成熟的框架。
- `V2Ray`：引入了*多入多出*和*复杂路由*的概念。它开创了 `VMess` 加密协议，其*路由引擎*支持基于域名、IP 地址和地理位置等多个维度的流量分发。新增了*传输层混淆*，支持 `WebSocket`、`mKCP`、`HTTP/2` 和 `QUIC` 等多种底层传输方式。
- `XRay`：从 `V2Ray` 分叉而来的增强版本，目前是社区中最流行的选择。它对 `XTLS` 集成采取了更激进的方式。
  - `VMess`：放弃 `VMess` 中冗余的加密和验证，将这些任务委托给底层 TLS 层，CPU 开销显著降低。
  - `XTLS Vision/Reality`：通过填充等方法，可以对抗 TLS 流量的长度指纹识别；"*窃取*"合法网站的证书特征，使代理流量在特征上与大型公司的 `HTTPS` 流量完全相同。
- `sing-box`：用 Go 编写，但在内存管理和并发性能方面进行了广泛而深入的优化。
  - `全协议支持`：除了 `VLESS`、`VMess` 和 `Trojan`，还原生支持 `Hysteria2`（一种改良的 `QUIC`）、`TUIC` 和 `WireGuard`。
  - `内核集成`：采用优秀的 `TUN/TProxy` 实现。它可以接管所有系统流量，实现无死角的透明代理。
  - `rule-set`：支持预编译规则集。

|                     | `V2Ray` | `Xray` | `sing-box` |
| :-:                 | :-:     | :-:    | :-:        |
| 路由性能             | 中      | 高     | 最佳       |
| 隐蔽性               | 高      | 最佳   | 最佳       |
| 透明代理             | 中      | 高     | 最佳       |

这里将使用目前最先进且高度隐蔽的 `VLESS + XTLS + REALITY` 方案进行部署。
```bash
# base environment
# Debian 12
# 1. install tools
apt update && apt upgrade -y
apt install curl wget unzip chrony -y

# ensure time sync
systemctl enable --now chrony

# disable firewall
systemctl disable firewalld

# 2. download bin files
mkdir -p /usr/local/bin/xray
mkdir -p /usr/local/etc/xray
wget https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip
unzip Xray-linux-64.zip -d /usr/local/bin/xray
chmod +x /usr/local/bin/xray/xray

# 3. gen uuid and secret key
/usr/local/bin/xray/xray uuid
/usr/local/bin/xray/xray x25519
```

这里有一个 `config.json` 模板，将 `inbounds.settings.clients.id` 替换为 `uuid`，将 `inbounds.streamSettings.realitySettings.privateKey` 替换为 `x25519 私钥`：
```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "port": 443, 
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "here put your uuid", 
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "www.lovelive-anime.jp:443", 
          "xver": 0,
          "serverNames": [
            "www.lovelive-anime.jp"
          ],
          "privateKey": "here put your private secret key", 
          "shortIds": [
            "0123456789abcdef" 
          ]
        }
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    }
  ]
}
```

- `dest`：建议选择一个大型、知名、支持 `TLS 1.3` 和 `H2` 且物理位置靠近你 VPS 的海外网站。
- `shortIds`：最多 16 个十六进制字符（0-9，a-f）。

启动服务器：
```bash
/usr/local/bin/xray/xray run -config /usr/local/etc/xray/config.json

# expose port, this config.json server with 443
ufw allow 443/tcp
iptables -I INPUT -s 0.0.0.0/0 -p tcp --dport=443 -j ACCEPT
```

然后你可以在客户端连接服务器，例如 `v2rayN` 等。
添加一个 VMess 服务器：
- 地址：VPS IP
- 端口：Xray 端口（这里是 443）
- 用户 ID：[uuid]
- 协议：tcp
- 流控：xtls-rprx-vision
- TLS：reality
- SNI：[域名]
- 公钥：[公钥]
- ShortId：[shortId]

现在你已经挖好了一条通往真实世界的隧道！

链接：
- 这里也推荐使用[“一键”脚本](https://233boy.com/)来搭建服务器。