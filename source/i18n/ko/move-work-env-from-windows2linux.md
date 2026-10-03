---
title: Windows에서 Linux로 업무용 PC 전환하기
category: Tech
tag: Linux
date: 2026-04-15T21:18:07+08:00
---


## Not Windows, But Linux
Windows는 개봉 즉시 사용 가능한 환경과 생태계 측면에서 절대적으로 비할 데 없는 존재다. 사용자 GUI 디자인은 매우 직관적이며(Win11은 제외), 강력한 호환성은 다른 어떤 운영체제도 따라올 수 없는 생태계를 만들어냈다. 하지만 나는 Win11의 일부 GUI 디자인과 강제 업데이트를 매우 싫어한다(덧붙이자면, 매번 업데이트할 때 "업데이트 후 종료"를 선택해도 결국 업데이트 완료 후 재부팅되는데, 이 버그를 마이크로소프트도 고칠 생각이 없는 듯하다). 또한 Windows의 command terminal은 그다지 편리하지 않아서 일부 개발 환경에서는 WSL을 사용해야 한다. 하지만 WSL은 본질적으로 가상 머신이라 네트워크 등 모든 것을 호스트 Windows에서 설정해야 하므로 다시 원점으로 돌아온다.

Windows 자체에 대한 호불호 외에도, 또 하나 반드시 언급해야 할 이유이자 가장 큰 이유는 회사에서 지급한 컴퓨터로 Win11을 실행하면 정말 느리다는 것이다. 10세대 i5 *ThinkPad*로 JetBrains IDE에서 프로젝트 몇 개를 열면 그 효율이란 정말...

그래서 나는 업무 환경을 바꿀 것을 고려하게 되었고, 현재 몇 가지 선택지가 있다:
1. 더 좋은 성능의 노트북 구매, Windows Laptop 또는 MacBook;
  - 장점: 성능 문제를 거의 고려할 필요가 없고, 생태계가 강력하며 호환성도 좋음
  - 단점: 돈이 듦
2. Linux로 전환;
  - 장점: Linux의 구성 가능성 덕분에 자원을 적게 소모하여 성능 문제도 간접적으로 해결. 통일되고 직접적인 개발 생태계, 필요에 따라 사용.
  - 단점: 개발 외의 사무 환경, 일부 업무 소프트웨어 설치 방법, 사내망 접근 방법 등을 해결해야 함

주변에 MacBook을 구매해서 사용하는 동료들도 있는데, MacOS는 내가 보기에 더더욱 쓰레기 덩어리다. MacOS 사용자가 보내는 압축 파일을 받을 때마다 항상 악명 높은 `.DS_Store`가 층층이 들어있다 🤮. 아무튼 1번은 금방 기각했다. 회사 다니면서 사비로 업무용 컴퓨터를 사라고? No way.

의심할 여지 없이 Linux는 코드 개발 효율을 완벽하게, 아니 120%까지 끌어올릴 수 있다. 하지만 Linux가 정말로 개발 외의 일상 업무를 감당할 수 있을까? 다음은 내 일상 업무에서 마주치는 시나리오들이다:
1. 이메일 송수신;
2. IM 소프트웨어, 위챗 및 회사 IM 포함;
3. 사내망 접근, 사내망 접속 및 사내 자원 접근 포함;
4. 문서 열람 및 편집, word, excel, ppt, pdf, visio 포함;

이 기본적인 몇 가지를 충족하지 못한다면 Linux로 업무를 보는 것은 어불성설이다.

그래서 나는 먼저 집 컴퓨터에 OS를 새로 설치해서 테스트하기로 했다. 집 컴퓨터에는 이전에 Arch Linux를 설치한 적이 있지만, 업무용 컴퓨터에는 절대 Arch를 쓸 수 없다. 이런 롤링 릴리스는 너무 불안정하다. 게다가 집의 Arch는 내가 요란하게 꾸며놔서 장난감 삼아 가지고 노는 건 확실히 매우 재미있지만, 솔직히 업무용으로 쓴다면 이런 화려한 것을 그다지 좋아하지 않는다. 주객이 전도된 느낌이다. 처음에는 Fedora를 업무용 시스템으로 사용할 계획이어서 집의 Arch를 밀어버리고 Fedora KDE 버전으로 교체했다.

사실 나는 개인적으로 Redhat 계열 운영체제를 더 선호한다. 첫째, Linus가 설치에 사용한 것이 바로 Fedora이고, 둘째, Redhat 계열은 서버 분야에서 누구나 알 정도로 유명해서 이미 익숙하기 때문이다. OS를 새로 설치한 후 앞의 네 가지 항목을 하나씩 테스트했다.

이메일 테스트는 사용 가능한 소프트웨어가 있느냐 없느냐의 문제가 아니라, Windows Foxmail 메일을 새 메일 클라이언트로 어떻게 **마이그레이션**하느냐가 더 중요하다. BTW, 원래 이메일은 모두 메일 서버에 저장되어 있어야 하고, 새 메일 클라이언트로 마이그레이션하려면 메일 서버에서 가져오기만 하면 된다. 하지만 회사의 정보보안부에서 정보 보안을 이유로 반드시 7일 전의 메일을 자동 삭제하라고 요구했다. 😅 좀 웃기다. 메일을 서버에 보관하는 것이 사용자 클라이언트에 보관하는 것보다 못하다는 건가? Thunderbird를 사용하여 플러그인<sup>[1]</sup>을 설치하면 EML 메일 가져오기를 구현할 수 있음을 테스트로 확인했다.

IM 소프트웨어는 국산화 신창(信創) 대체의 발전 덕분에 대부분의 IM이 하나 이상의 신창 시스템에 적응해 있다. 위챗은 공식적으로 deb/rpm/AppImage 형식의 설치 패키지를 제공하고, 회사 IM도 deb 설치 패키지를 제공한다. Fedora는 Redhat 계열 배포판이라 rpm 패키지를 사용한다. 나는 회사 IM deb 패키지를 rpm 패키지로 변환했는데, 여러 번 시도했지만 결국 성공적으로 실행하지 못했다. Linux용 패키징이 정말 번거롭다는 것을 절로 느낀다. Linus 본인조차 Linux용 배포 패키지를 만들려 하지 않는다. 😮‍💨

문서는 가장 간단하다. LibreOffice를 선택할 수도 있고 WPS를 사용할 수도 있다. 문서 업무 사용 시나리오를 기본적으로 전면 커버한다. 주의할 점은 일부 Linux는 문서 업무용 중문 폰트인 송체/방송체/흑체/해서체 등을 기본적으로 포함하거나 관리하지 않는다는 것이다.

가장 중요한 사내망 접근. 회사에서 구매한 새로운 로그인 인증 서비스인 360은 Windows에서는 잘 작동한다. 하지만 Linux에서는 신창 OS의 데스크톱 버전만 지원하고 Ubuntu 등은 server 버전만 지원하는 것으로 보인다. 한참을 시도했지만 아직 사내망에 성공적으로 접속하지 못했다. 😓 따라서 현재는 VirtualBox Windows 가상 머신 + VPN을 통해 사내망에 접근하고 있다. 또한 winboat도 테스트했는데, 구체적인 내용은 이후 장에서 다루겠다.

> 테스트 결과, 역시 deb 계열의 지원이 더 좋다.

다음은 Debian 13으로 마이그레이션한 일부 과정이다. 👉

## Let's go!
> !!! 새 시스템을 설치하기 전에 반드시 모든 자료가 백업되었는지 확인하라.

파티션 테이블을 삭제하고 Debian 13 KDE 버전을 설치한다.

###科学上网
이 부분은 기본적으로 설명할 것이 별로 없다. 대부분의 소프트웨어가 크로스 플랫폼을 지원한다. 예를 들어 *v2rayn* 등. deb를 다운로드한 후 설치하고 설정을 가져온다.
```bash
sudo apt install ./v2rayN-linux-64.deb
```

### 입력기
의심할 여지 없이 fcitx5 + rime을 사용한다.
```bash
sudo apt install fcitx5-rime

# 어휘집은 万象이나 雾凇 등을 선택할 수 있다
cd $HOME/.local/share/fcitx5
# 雾凇을 예로 들면
git clone https://github.com/iDvel/rime-ice.git rime --depth 1
```
먼저 "키보드"->"가상 키보드"에서 "Fcitx5 Wayland"를 선택한다. 그런 다음 KDE setting에서 "언어 및 시간"->"입력기"로 가서 모든 기본 입력기를 삭제하고 rime(中州韻)을 추가한다.

### 폰트
폰트 설치는 영문 폰트와 중문 폰트를 포함한다.
```bash
sudo apt install fonts-roboto fonts-dejavu-core fonts-cantarell fonts-liberation
```

수동 설치 부분:
- 영문 폰트: [Nerd Font](https://www.nerdfonts.com/).
- 중문 폰트: [문서 풀세트](https://flc.zjnu.edu.cn/2024/1110/c18580a485306/page.htm), 微软雅黑<sup>[2]</sup>.

수동 폰트 설치는 아래 작업을 따른다:
```bash
sudo apt install fontconfig xfonts-utils
mkdir -p ~/.local/share/fonts

cp /path/to/your/font.tty ~/.local/share/fonts/
cp /path/to/your/font.ttc ~/.local/share/fonts/

chmod 644 ~/.local/share/fonts/*
fc-cache -fv
```

### 오피스 소프트웨어
몇 가지 자주 사용하는 오피스 소프트웨어:
- [위챗](https://linux.weixin.qq.com/)
- [QQ](https://im.qq.com/linuxqq/download.html)
- [WPS](https://www.wps.cn/product/wpslinux#)
- [MoeKoe](https://music.moekoe.cn/)
- [listen1_desktop](https://github.com/listen1/listen1_desktop)

설치 패키지를 다운로드한 후 다운로드 디렉토리에서 `sudo apt install ./xxx.deb`를 실행한다.

메일은 Thunderbird를 사용하며, `sudo apt install thunderbird`를 실행하여 설치한다. Thunderbird에서 메일 계정을 설정한 후 ImortExportTools NG 플러그인을 설치하고, 받은편지함을 우클릭하여 EML 메일 가져오기를 시작한다.

### Virtual VM
나는 현재 Oracle VirtualBox를 사용하고 있다. vbox 가상화는 kvm이 아니라 vboxdrv를 통해 이루어지지만, 시스템은 기본적으로 kvm을 로드한다. 아래 스크립트를 통해 kvm과 vboxdrv를 빠르게 전환한다.
```bash
#!/usr/bin/env bash

set -euo pipefail

KVM_MODULE=""
CPU_VENDOR=$(grep -E 'vendor_id' /proc/cpuinfo | head -1)

if [[ $CPU_VENDOR == *"Intel"* ]]; then
    KVM_MODULE="kvm_intel"
elif [[ $CPU_VENDOR == *"AMD"* ]]; then
    KVM_MODULE="kvm_amd"
else
    echo "Unsupported CPU vendor"
    exit 1
fi

is_loaded() {
    lsmod | awk '{print $1}' | grep -qx "$1"
}

load_vbox() {
    echo "[+] Switching to VirtualBox"

    if is_loaded "kvm"; then
        sudo modprobe -r "$KVM_MODULE" kvm
    fi

    sudo modprobe vboxdrv

    echo "[+] VirtualBox modules loaded"
}

load_kvm() {
    echo "[+] Switching to KVM"

    if is_loaded "vboxdrv"; then
        sudo modprobe -r vboxnetadp vboxnetflt vboxdrv || true
    fi

    sudo modprobe kvm
    sudo modprobe "$KVM_MODULE"

    echo "[+] KVM modules loaded"
}

case "${1:-}" in
    vbox)
        load_vbox
        ;;
    kvm)
        load_kvm
        ;;
    *)
        echo "Usage: $0 {vbox|kvm}"
        exit 1
        ;;
esac
```

360 안전 터미널은 비신창 OS를 모두 server 측으로 인식한다. 설령 desktop 버전을 사용할 수 있다 해도 사용 경험이 그다지 좋지 않을 것이다(이중 접속 불가). 그렇다면 두 가지를 겸비한 방법은 없을까?

있다. Winboat<sup>[3]</sup>는 이론적으로 요구 사항을 완전히 구현할 수 있다. winboat는 컨테이너를 통해 Windows를 실행하고, 다시 RDP 프로토콜을 통해 Windows 네이티브 애플리케이션을 Linux 인터페이스로 전달한다.

따라서 이론적으로는 컨테이너 내의 Windows에 VPN을 설치하고 연결한 후, winboat를 사용하여 Windows 네이티브 서비스를 사용하면 기존 요구 사항을 달성할 수 있다. 하지만 왜 이론적으로라고 하냐면, Windows에서 VPN을 연결하면 VPN이 LAN 통신까지 차단해버려서 winboat API도 무효화되기 때문이다.

만약 VPN 연결 후 스크립트를 실행하거나 다른 어떤 방법으로든 LAN 통신이 정상적으로 유지되도록 할 수 있다면 가능할 것이다. 나중에 시간이 되면 다시 테스트해보겠다.

### 개발 환경
개발 환경 구성은 사람마다 다르다. git clone으로 이전 dotfiles를 로컬에 가져오는 것을 잊지 말자. 하지만 중국 내 개발에 미러 사이트가 빠질 수 있겠는가, 하하. 😅
자주 사용하는 미러 사이트:
- [알리윈](https://developer.aliyun.com/mirror/)
- [중국과학기술대](https://mirrors.ustc.edu.cn/)
- [칭화](https://mirrors.tuna.tsinghua.edu.cn/)
- [docker 미러 사이트-난징대](https://doc.nju.edu.cn/books/e1654)
- [docker 미러 사이트-github](https://github.com/dongyubin/DockerHub)

### KDE 플러그인
말하자면, 기본 KDE는 확실히 좀 미관상 아쉽다. 🤔
추천하는 몇 가지 플러그인:
- [KdeControlStation](https://store.kde.org/p/2196105): 종합 컨트롤 패널, 네트워크/블루투스 등 포함
- [Kurve - Audio Visualizer](https://store.kde.org/p/2299506): 오디오 시각화
- [Panel Colorizer](https://store.kde.org/p/2130967): dock 미화
- [Advanced Weather Widget](https://store.kde.org/p/2349879): 더 나은 날씨 위젯

> 좀 아쉽다, 딱히 쓸만한 만년력 위젯이 없는 것 같다 😓

Links:
[1]: [ImortExportTools NG](https://addons.thunderbird.net/zh-CN/thunderbird/addon/importexporttools-ng/?src=hp-dl-mostpopular)
[2]: 가장 간단한 방법은 Windows에서 복사해오는 것이다, C:/Windows/Fonts/msyh*.ttc
[3]: Linux에서 Windows 애플리케이션을 네이티브로 사용하기 위한 소프트웨어. See more [winboat](https://winboat.app/).