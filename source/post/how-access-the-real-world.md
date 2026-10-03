---
title: How Access The Real World
category: Tech
tag: Linux
date: 2026-02-27T00:08:49+08:00
---


## Part 1 You Know The Cluster Firewall
Mr. Fang is the administrator of a super cluster. He claims to protect the nodes in the cluster and defend against external malicious attacks. Therefore, Mr. Fang created a huge and *fake* **firewall** to block direct communication within and outside the cluster.

For a long time, most services can be provided within the cluster (regardless of the quality), but there are always some requirements that must be communicated with other clusters outside the cluster. As the saying goes, "Know yourself so you can beat yourself". Only by deeply understanding how the firewall is constructed can we better overcome it.

## Part 2 How Will You Build It?
If you are the administrator of this cluster, how will you build the wall?

### 2.1 IP blocking
If you can control all routers of the cluster, the most straightforward way is block any IPs which in you blacklist. When the router detects that the destination IP of the data packet is in the blacklist, routers will drop the data packet or turn packet to somewhere do not exist.

The core of this method is the need to maintain a massive blacklist.
- signle IP for specific servers
- IP segment blocking for the entire computer room, such as some cheap VPS providers

### 2.2 DNS pollution
Since DNS queries (UDP bind port 53) are unencrypted and connectionless by default, this provides great convenience for interception.

This is a very effective and economical method. DNS is the cornerstone of modern networks; almost all services are equipped with domain names and require DNS resolution to access their services correctly. When a user within the cluster attempts to resolve the domain name of an "illegal" service using DNS, the cluster DNS server only needs to return an incorrect resolution result, such as 127.0.0.1. In this way, the user's "illegal" request doesn't even leave the network card.

Of course, this method is also relatively easy to "handle." Users simply need to manually modify their local hosts file, adding the correct domain name and corresponding IP address, and setting the local hosts file to be used for DNS resolution first.

### 2.3 Keyword filtering and TCP RST reset
Even if the IP is not blocked, if user request packet contains specific “sensitive characters”, *admin* will take action.

This is a precise strike against non-encrypted traffic (like HTTP) or semi-encrypted traffic (the TLS handshake phase etc.). Admin will send forged messages to both sides of the communication (user's computer and the server) when extract the data packet and matches the preset "sensitive" thesaurus. **RST** packet forces the current TCP connection to be interrupted. It always be like that *"Connection has been reset"* is suddenly displayed halfway through the web page loading.

### 2.4 Deep packet inspection
If interception cannot be achieved based on the destination domain name and IP address, then more in-depth data analysis is needed to determine whether to intercept. Even though most communications are now encrypted with TLS, Deep packet inspection (DPI) can penetrate the data packets to identify and intercept them.

Most of DPI detections are aim to `L3` and `L7`, include source/destination IPs and request payload. Whole DPI process flow as:
1. Extraction:  The DPI engine captures this package and recognizes that the port and call the corresponding parsing module. As `80`, so it calls the `HTTP` parsing module. And DPI also can detect by *fingerprint recognition*, which is the protocol's unique byte sequence and length distribution
2. Reorganization: If the search term is very long and divided into multiple packages, DPI will *reassemble them in memory* (TCP Reassembly) to ensure that the keywords will not escape detection due to subcontracting
3. Matching: DPI scan payload to detect *secret keywords* which are the preset filtering rules
4. Action: Throw away packets or send a `TCP RST` packet to interception

This is why modern tunneling protocols (like `VLESS`/`REALITY`) strive to eliminate any known signatures and disguise all handshake processes as perfect, flawless HTTPS traffic—the goal being to make the DPI engine believe that this is just a normal data packet sent to a compliant website.

### 2.5 Flow statistics analysis
This is currently the most difficult dynamic method to handle. At this point, the analysis and detection no longer rely on static domain names/IPs/keywords, but focus on the behavioral characteristics of the entire traffic segment.

But how analysis the traffic? One of the most obvious aspect is all encrypted traffic exhibits high randomness. An IP will be flagged if it consistently outputs high-entropy random data and does not have a typical HTTPS fingerprint.
Similarly, features can also be revealed by connection times and packets size:
- proxy traffic is typically persistent long-lived connections
- the packet length characteristics of video streaming, web browsing, and encrypted tunnels are completely different

When a user's data behavior exceeds a certain threshold in the rating system, then will be blocked.

## Part 3 How To Dig A Tunnel?
In the current ecosystem of network circumvention technology, `V2Ray`, `Xray`, and `sing-box` are the three most core and mature frameworks.
- `V2Ray`: Introducing the concepts of *multiple-input multiple-output* and *complex routing*. It pioneered the `VMess` encryption protocol, and its *routing engine* supports traffic distribution based on multiple dimensions such as domain name, IP address, and geographic location. Added *transport layer obfuscation*, supporting multiple underlying transport methods such as `WebSocket`, `mKCP`, `HTTP/2`, and `QUIC`.
- `XRay`: An enhanced version forked from `V2Ray` and is currently the most popular choice in the community. It holds a more radical approach to `XTLS` integration.
  - `VMess`: abandoning the redundant encryption and verification in `VMess` and delegating these tasks to the underlying TLS layer, CPU overhead is significantly reduced.
  - `XTLS Vision/Reality`: using methods such as padding, the length fingerprinting of TLS traffic can be resisted; "*stealing*" the certificate characteristics of legitimate websites, making the proxy traffic identical in characteristics to `HTTPS` traffic from major companies.
- `sing-box`: Written in Go, but has undergone extensive and in-depth optimization in memory management and concurrency performance.
  - `all protocols supports`: in addition to `VLESS`, `VMess`, and `Trojan`, it natively supports `Hysteria2` (one type of modified `QUIC`), `TUIC`, and `WireGuard`.
  - `kernel integration`: take an excellent `TUN/TProxy` implementation. It can take over all system traffic, achieving transparent proxying without any blind spots.
  - `rule-set`: support for pre-compiled rule sets.

|                     | `V2Ray` | `Xray` | `sing-box` |
| :-:                 | :-:     | :-:    | :-:        |
| routing performance | mid     | high   | best       |
| concealment         | high    | best   | best       |
| transparent proxy   | mid     | high   | best       |

Here deployment will be carried out using the most advanced and highly covert `VLESS + XTLS + REALITY` solution currently available.
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

This has a template of `config.json`, replace `inbounds.settings.clients.id` by `uuid` and replace `inbounds.streamSettings.realitySettings.privateKey` by `x25519 private key`:
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

- `dest`: It is recommended to choose a large, reputable overseas website that supports `TLS 1.3` and `H2` and is physically located close to your VPS.
- `shortIds`: Hexadecimal characters up to 16 (0-9, a-f).

Start server:
```bash
/usr/local/bin/xray/xray run -config /usr/local/etc/xray/config.json

# expose port, this config.json server with 443
ufw allow 443/tcp
iptables -I INPUT -s 0.0.0.0/0 -p tcp --dport=443 -j ACCEPT
```

Then you can connect server in client, like `v2rayN` etc.
Add a VMess server:
- addr: VPS IP
- port: Xray port(here is 443)
- user id: [uuid]
- protocol: tcp
- flow: xtls-rprx-vision
- TLS: reality
- SNI: [domain]
- PublicKey: [public key]
- ShortId: [shortId]

Now you have dig a tunnel to connect the real world!

Links:
- Here also recommand build server by the ["one-step" scripts](https://233boy.com/).
