---
title: 현실 세계에 접속하는 방법
category: Tech
tag: Linux
date: 2026-02-27T00:08:49+08:00
---


## 파트 1 당신은 클러스터 방화벽을 알고 있다
팡 씨는 슈퍼 클러스터의 관리자이다. 그는 클러스터 내의 노드를 보호하고 외부의 악의적인 공격을 방어한다고 주장한다. 따라서 팡 씨는 거대하고 *가짜* **방화벽**을 만들어 클러스터 내부와 외부의 직접적인 통신을 차단했다.

오랫동안 대부분의 서비스는 클러스터 내에서 제공될 수 있었지만(품질과는 별개로), 클러스터 외부의 다른 클러스터와 반드시 통신해야 하는 요구 사항이 항상 존재한다. "적을 알고 나를 알면 백전백승"이라는 말처럼, 방화벽이 어떻게 구축되는지 깊이 이해해야만 그것을 더 잘 극복할 수 있다.

## 파트 2 어떻게 구축하시겠습니까?
당신이 이 클러스터의 관리자라면, 벽을 어떻게 구축하시겠습니까?

### 2.1 IP 차단
클러스터의 모든 라우터를 제어할 수 있다면, 가장 직접적인 방법은 블랙리스트에 있는 모든 IP를 차단하는 것이다. 라우터가 데이터 패킷의 목적지 IP가 블랙리스트에 있음을 감지하면, 라우터는 데이터 패킷을 버리거나 존재하지 않는 곳으로 보낸다.

이 방법의 핵심은 방대한 블랙리스트를 유지 관리해야 한다는 것이다.
- 특정 서버를 위한 단일 IP
- 일부 저렴한 VPS 제공업체와 같은 전체 전산실에 대한 IP 대역 차단

### 2.2 DNS 오염
DNS 쿼리(UDP 바인드 포트 53)는 기본적으로 암호화되지 않고 비연결성이기 때문에, 이는 가로채기에 큰 편의를 제공한다.

이것은 매우 효과적이고 경제적인 방법이다. DNS는 현대 네트워크의 초석이며, 거의 모든 서비스에 도메인 이름이 있고 서비스를 올바르게 이용하려면 DNS 확인이 필요하다. 클러스터 내의 사용자가 DNS를 사용하여 "불법" 서비스의 도메인 이름을 확인하려고 시도할 때, 클러스터 DNS 서버는 127.0.0.1과 같은 잘못된 확인 결과를 반환하기만 하면 된다. 이렇게 하면 사용자의 "불법" 요청은 네트워크 카드조차 떠나지 않는다.

물론 이 방법도 비교적 쉽게 "처리"할 수 있다. 사용자는 로컬 hosts 파일을 수동으로 수정하여 올바른 도메인 이름과 해당 IP 주소를 추가하고, DNS 확인 시 로컬 hosts 파일을 우선적으로 사용하도록 설정하기만 하면 된다.

### 2.3 키워드 필터링 및 TCP RST 리셋
IP가 차단되지 않았더라도, 사용자 요청 패킷에 특정 "민감한 문자"가 포함되어 있으면 *관리자*가 조치를 취한다.

이것은 비암호화 트래픽(예: HTTP) 또는 반암호화 트래픽(TLS 핸드셰이크 단계 등)에 대한 정밀 타격이다. 관리자는 데이터 패킷을 추출하여 미리 설정된 "민감한" 단어 사전과 일치하면 통신 양측(사용자 컴퓨터와 서버)에 위조된 메시지를 보낸다. **RST** 패킷은 현재 TCP 연결을 강제로 중단시킨다. 웹 페이지 로딩 도중 갑자기 *"연결이 재설정되었습니다"* 가 표시되는 것은 항상 이런 식이다.

### 2.4 심층 패킷 검사
목적지 도메인 이름과 IP 주소를 기반으로 가로채기를 할 수 없다면, 가로챌지 여부를 결정하기 위해 더 심층적인 데이터 분석이 필요하다. 대부분의 통신이 현재 TLS로 암호화되어 있음에도 불구하고, 심층 패킷 검사(DPI)는 데이터 패킷을 관통하여 식별하고 가로챌 수 있다.

대부분의 DPI 검사는 `L3`와 `L7`을 대상으로 하며, 출발지/목적지 IP와 요청 페이로드를 포함한다. 전체 DPI 처리 흐름은 다음과 같다:
1. 추출: DPI 엔진이 이 패키지를 캡처하고 포트를 인식하여 해당 파싱 모듈을 호출한다. `80`이므로 `HTTP` 파싱 모듈을 호출한다. 그리고 DPI는 *지문 인식*으로도 감지할 수 있는데, 이는 프로토콜 고유의 바이트 시퀀스와 길이 분포이다
2. 재조립: 검색어가 매우 길어 여러 패키지로 분할된 경우, DPI는 *메모리에서 재조립*(TCP Reassembly)하여 키워드가 분할로 인해 탐지를 회피하지 않도록 보장한다
3. 매칭: DPI는 페이로드를 스캔하여 미리 설정된 필터링 규칙인 *비밀 키워드*를 탐지한다
4. 조치: 패킷을 버리거나 `TCP RST` 패킷을 보내 가로챈다

이것이 현대 터널링 프로토콜(예: `VLESS`/`REALITY`)이 알려진 시그니처를 제거하고 모든 핸드셰이크 과정을 완벽하고 흠잡을 데 없는 HTTPS 트래픽으로 위장하려고 노력하는 이유이다—목표는 DPI 엔진이 이것이 합법적인 웹사이트로 전송되는 평범한 데이터 패킷이라고 믿게 만드는 것이다.

### 2.5 흐름 통계 분석
이것은 현재 처리하기 가장 어려운 동적 방법이다. 이 시점에서 분석과 탐지는 더 이상 정적인 도메인 이름/IP/키워드에 의존하지 않고, 전체 트래픽 세그먼트의 행동 특성에 초점을 맞춘다.

그런데 트래픽을 어떻게 분석할까? 가장 명백한 측면 중 하나는 모든 암호화 트래픽이 높은 무작위성을 보인다는 것이다. IP가 지속적으로 높은 엔트로피의 무작위 데이터를 출력하고 일반적인 HTTPS 지문이 없다면 플래그가 지정된다.
마찬가지로 연결 시간과 패킷 크기로도 특징이 드러날 수 있다:
- 프록시 트래픽은 일반적으로 지속적인 장기 연결이다
- 비디오 스트리밍, 웹 브라우징, 암호화 터널의 패킷 길이 특성은 완전히 다르다

사용자의 데이터 행동이 평점 시스템에서 특정 임계값을 초과하면 차단된다.

## 파트 3 터널을 어떻게 파는가?
현재 네트워크 우회 기술 생태계에서 `V2Ray`, `Xray`, `sing-box`는 가장 핵심적이고 성숙한 세 가지 프레임워크이다.
- `V2Ray`: *다중 입력 다중 출력*과 *복잡한 라우팅* 개념을 도입했다. `VMess` 암호화 프로토콜을 개척했으며, *라우팅 엔진*은 도메인 이름, IP 주소, 지리적 위치 등 여러 차원에 기반한 트래픽 분배를 지원한다. *전송 계층 난독화*를 추가하여 `WebSocket`, `mKCP`, `HTTP/2`, `QUIC` 등 여러 하위 전송 방식을 지원한다.
- `XRay`: `V2Ray`에서 포크된 강화 버전으로 현재 커뮤니티에서 가장 인기 있는 선택이다. `XTLS` 통합에 더 급진적인 접근 방식을 취한다.
  - `VMess`: `VMess`의 중복된 암호화와 검증을 포기하고 이러한 작업을 하위 TLS 계층에 위임하여 CPU 오버헤드가 크게 감소한다.
  - `XTLS Vision/Reality`: 패딩 등의 방법을 사용하여 TLS 트래픽의 길이 지문에 저항할 수 있다; 합법적인 웹사이트의 인증서 특성을 "*훔쳐*" 프록시 트래픽을 주요 기업의 `HTTPS` 트래픽과 특성이 동일하게 만든다.
- `sing-box`: Go로 작성되었지만 메모리 관리와 동시성 성능에서 광범위하고 심층적인 최적화를 거쳤다.
  - `all protocols supports`: `VLESS`, `VMess`, `Trojan` 외에도 `Hysteria2`(`QUIC`의 변형 중 하나), `TUIC`, `WireGuard`를 기본적으로 지원한다.
  - `kernel integration`: 뛰어난 `TUN/TProxy` 구현을 채택한다. 모든 시스템 트래픽을 장악하여 사각지대 없이 투명 프록시를 달성할 수 있다.
  - `rule-set`: 사전 컴파일된 규칙 세트를 지원한다.

|                     | `V2Ray` | `Xray` | `sing-box` |
| :-:                 | :-:     | :-:    | :-:        |
| 라우팅 성능          | 중간     | 높음    | 최고        |
| 은폐성              | 높음     | 최고    | 최고        |
| 투명 프록시          | 중간     | 높음    | 최고        |

여기서는 현재 사용 가능한 가장 진보되고 은폐성이 높은 `VLESS + XTLS + REALITY` 솔루션을 사용하여 배포를 진행한다.
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

다음은 `config.json` 템플릿이며, `inbounds.settings.clients.id`를 `uuid`로 바꾸고 `inbounds.streamSettings.realitySettings.privateKey`를 `x25519 private key`로 바꾼다:
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

- `dest`: `TLS 1.3`과 `H2`를 지원하고 물리적으로 VPS와 가까운 위치에 있는, 규모가 크고 평판이 좋은 해외 웹사이트를 선택하는 것이 좋다.
- `shortIds`: 최대 16자의 16진수 문자(0-9, a-f).

서버 시작:
```bash
/usr/local/bin/xray/xray run -config /usr/local/etc/xray/config.json

# expose port, this config.json server with 443
ufw allow 443/tcp
iptables -I INPUT -s 0.0.0.0/0 -p tcp --dport=443 -j ACCEPT
```

그런 다음 `v2rayN` 등의 클라이언트에서 서버에 연결할 수 있다.
VMess 서버 추가:
- addr: VPS IP
- port: Xray 포트(여기서는 443)
- user id: [uuid]
- protocol: tcp
- flow: xtls-rprx-vision
- TLS: reality
- SNI: [domain]
- PublicKey: [public key]
- ShortId: [shortId]

이제 현실 세계에 연결하는 터널을 판 것이다!

링크:
- 여기서도 ["원스텝" 스크립트](https://233boy.com/)로 서버를 구축하는 것을 추천한다.