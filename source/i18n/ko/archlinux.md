---
title: Arch Linux
category: Tech
tag: Linux
date: 2025-10-26T10:55:32+08:00
---


# Linux 설치 및 설정
## 왜 리눅스인가?
GNU/Linux는 완전한 오픈 소스 운영 체제 커널이며, 우리가 흔히 "리눅스"라고 부르는 것은 GNU/Linux의 배포판들이다<sup>[1]</sup>.
우리가 사용할 수 있는 배포판은 Ubuntu, Debian, Fedora, CentOS, Mint, Gentoo, Arch 등 다양하다. 그렇다면 왜 리눅스인가?
1. **오픈 소스**: 앞서 말했듯이 GNU/Linux 커널은 완전한 오픈 소스 프로젝트이며, 누구나 인터넷에서 소스 코드를 쉽게 얻을 수 있다. 이는 커널 소스 코드를 직접 수정할 수 있다는 것을 의미한다.
2. **다중 사용자**: 리눅스는 다중 사용자를 가장 잘 지원하며, 각 사용자의 작업을 쉽게 관리하고 전환할 수 있다.
3. **안정성과 안전성**: 리눅스는 Unix<sup>[2]</sup>의 뛰어난 안정성과 효율성을 계승했다. 리눅스 운영 체제는 서버의 하드웨어 이점을 충분히 발휘할 수 있다.
4. **놀라운 생태계**: 리눅스는 서버, 사무, 개발, 엔터테인먼트 등 다양한 요구를 쉽게 충족할 수 있는 풍부한 생태계를 갖추고 있다. 리눅스는 서버와 개발 모두에 적합하며, 이는 개발자가 처음부터 끝까지 동일한 표준을 따를 수 있다는 것을 의미하며, 이는 측량할 수 없는 이점이다.

이 블로그에서는 Arch Linux(*간단하고 가벼운 배포판*)를 설치하고 설정하는 방법을 자세히 보여줄 것이다.

## 설치
### 사전 설치
PC 기기에 Arch를 설치하려면 최소 **8GB** 저장 용량의 USB 플래시 드라이브를 준비해야 한다.
설치에는 *ventoy* 사용을 권장하며, 다음 단계를 따른다:
1. [ventoy 다운로드](https://www.ventoy.net/cn/download.html)에서 ventoy를 다운로드한다.
2. USB 기기에 ventoy를 설치한다<sup>[3]</sup>.
3. 미러 사이트에서 Arch iso를 다운로드한다(어디든 괜찮으며, 여기서는 [aliyun-archlinux](https://mirrors.aliyun.com/archlinux/iso/)를 사용한다).
4. iso 파일을 ventoy USB에 넣는다.

### Arch 설치
USB를 준비한 후, 이제 설치를 시작한다.
1. PC에 USB를 삽입한 후 PC를 시작한다.
2. BIOS에 진입하여 USB를 첫 번째 부팅 항목으로 설정한 후 저장하고 종료하면 ventoy 시스템으로 진입한다.
3. 목록에서 Arch Linux 항목을 선택하고 첫 번째 항목으로 이동하여 설치 환경(tty)으로 진입한다.
    ![arch-1](https://i.postimg.cc/kXkG6QYv/Arch-1.png)
4. 유선 네트워크 환경에서 설치하는 것을 권장하며, [`iwctl`](https://man.archlinux.org/man/iwctl.1)을 사용하여 WIFI 연결을 설정할 수도 있다. 가장 중요한 것은 전체 설치가 네트워크 환경에서 이루어지도록 하는 것이다.
    ![arch-2](https://i.postimg.cc/jdWCSgcF/Arch-2.png)
5. keyring을 업데이트하고 archinstall을 설치한다:
    ```shell
    pacman -Sy archlinux-keyring
    pacman -S archinstall
    ```
6. [archinstall](https://archinstall.archlinux.page/installing/guided.html)을 시작한다:
    ```shell
    archinstall
    ```
    **UKI**, **Swap**, **NTP synchronization**을 활성화하는 것을 권장한다. 부트로더로는 `systmed`를 권장한다.
    1. language: English
        ![arch-3](https://i.postimg.cc/KvdjkPp5/Arch-3.png)
    2. locale: 지역을 선택한다
        ![arch-4](https://i.postimg.cc/SNwR261V/Arch-4.png)
        ![arch-5](https://i.postimg.cc/wTSMyX4S/Arch-5.png)
    3. disk config: *부트로더용 1024MB*, *linux swap용 메인 메모리와 동일한 크기*, *나머지는 디스크용*
        ![arch-8](https://i.postimg.cc/SNwR26t0/Arch-8.png)
        여기서는 디스크에 **btrfs**<sup>[4]</sup> 사용을 권장하며, **ext4**를 선택할 수도 있다.
        그리고 디스크에 두 개의 서브볼륨을 추가한다:
        ![arch-7](https://i.postimg.cc/jdG2wHkr/Arch-7.png)
    4. auth: root 비밀번호를 설정하고 일반 사용을 위한 비root 사용자를 추가한다.
        ![arch-9](https://i.postimg.cc/mgCDQP0B/Arch-9.png)
    5. profile: archinstall은 다양한 시나리오를 위한 많은 프로필을 제공하므로, 필요에 맞는 것을 선택한다.
        ![arch-10](https://i.postimg.cc/Cxk1jRWw/Arch-10.png)
    6. application: 주로 블루투스와 오디오용
        ![arch-11](https://i.postimg.cc/t4WThsLT/Arch-11.png)
    7. kernel: 여기서는 네 가지를 선택할 수 있으며, 차이점은 표를 참고한다
        | Kernel             | Description                                                                                                       | Main Goals                                                                      | Pros                                                                                                                               | Cons                                                                                           |
        | ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
        | **linux**          | **메인라인 커널**로, 자주 업데이트되며 Linus Torvalds와 커널 팀이 직접 유지 관리한다.        | **최신 안정** 커널 릴리스를 제공한다.                                  | – 최신 하드웨어 지원<br>– 잦은 업데이트<br>– 안정성과 성능의 좋은 균형                                     | – 때때로 회귀를 초래할 수 있음<br>– LTS보다 약간 덜 안정적                    |
        | **linux-lts**      | **장기 지원** 커널로, 장기간(보통 2–6년) 유지 관리된다.                          | 최첨단 기능보다 **안정성과 장기적 신뢰성**을 우선시한다. | – 매우 안정적<br>– 회귀가 적음<br>– 서버, 프로덕션 시스템, 구형 하드웨어에 이상적                                | – 새 하드웨어 지원이 느림<br>– 일부 최신 커널 개선 사항 누락          |
        | **linux-hardened** | **추가 보안 강화 패치**가 적용된 커널 변형으로, 커뮤니티와 Arch 유지 관리자가 개발한다. | **보안과 공격 표면 축소**에 초점을 맞춘다.                           | – 강화된 보안(예: 더 엄격한 메모리 보호, 커널 익스플로잇 완화)<br>– 보안에 민감한 시스템에 적합 | – 약간의 성능 오버헤드<br>– 일부 기능과 드라이버가 제한되거나 호환되지 않을 수 있음 |
        | **linux-zen**      | **데스크톱 성능과 응답성**에 맞게 조정된 커널로, Zen 커널 프로젝트가 유지 관리한다.              | **낮은 지연 시간**과 부드러운 데스크톱 경험에 최적화되어 있다.                  | – 더 나은 상호 작용과 응답성<br>– 향상된 데스크톱 및 게임 성능                                             | – 메인라인보다 약간 덜 안정적<br>– 더 짧은 지원 기간<br>– 서버에 이상적이지 않음    |
        
        ![arch-12](https://i.postimg.cc/Z5pRrW15/Arch-12.png)
    8. network: NetworkManager 사용을 권장한다
        ![arch-13](https://i.postimg.cc/rwxmSDvz/Arch-13.png)
    9. pkgs: `linux-zen`을 사용하는 경우 `linux-zen-header`를 추가해야 한다
        ![arch-14](https://i.postimg.cc/dVr18hzL/Arch-14.png)
    10. timezone: 지역을 선택한다
        ![arch-15](https://i.postimg.cc/13wtp8LV/Arch-15.png)
7. Arch Linux로 진입하여 systemd 부팅 항목을 설정한다:
    ```shell
    # go into Arch Linux
    arch-chroot /mnt
    
    # install and config
    bootctl install
    bootctl list
    exit

    # reboot
    reboot
    ```
이로써 모든 설치가 완료되었다.

## 설정
TTY<sup>[5]</sup>는 서비스와 개발의 모든 기능적 요구 사항을 완벽하게 충족할 수 있지만, 대부분의 사람들에게 GUI는 의심할 여지 없이 사용 편의성과 효율성 사이의 균형이다.
> 중국 본토에 있다면, 차단을 우회할 수 있는 몇 가지 방법이 필요할 수 있다

### Gnome/KDE
GNOME/KDE는 거의 설정이 필요 없으며, 모든 기본 기능을 바로 사용할 수 있다. 물론 플러그인을 설치하여 시스템을 사용자 정의하거나 기능을 향상시킬 수도 있다.

### Hyprland
[Hyprland](https://github.com/hyprwm/Hyprland)는 외관을 희생하지 않는 100% 독립적인 동적 타일링 Wayland 컴포지터이다.
스택형 창 관리와 비교할 때, 타일형 창 관리는 화면의 모든 인치를 최대한 활용하고 더 많은 정보를 제공한다는 장점이 있다.

현재 완성되고 성숙한 Hyprland 설정 솔루션이 많이 있다. 예를 들어 [HYDE](https://github.com/HyDE-Project/HyDE), [Omarchy](https://omarchy.org/) 등이 있다.
여기서는 [end_4 hyprland dotfiles](https://github.com/end-4/dots-hyprland)를 권장한다:
```shell
# run this command to install end_4 hyprland dotfiles
bash <(curl -s https://ii.clsty.link/get)
```

### Niri
[Niri](https://github.com/YaLTeR/niri)도 동적 타일링 Wayland 컴포지터의 한 종류이지만 Hyprland와는 다르다.
Niri는 사용자가 현재 창을 무한정 수평으로 확장할 수 있게 해준다. 또한 Niri는 전역 동적 창 미리보기를 제공하여 사용자가 사용 중인 창 사이를 쉽게 전환할 수 있게 해준다.
Niri의 무한 확장을 한 번 경험하면 Hyprland의 창 경험이 현저히 떨어진다고 말할 수밖에 없다.
![niri-preview](https://i.postimg.cc/C57FXq2H/niri-preview.png)

다음은 niri를 위한 간단한 설정이다:
```kdl
environment {
    QT_QPA_PLATFORM "wayland;xcb"
    QT_QPA_PLATFORMTHEME "qt6ct"
    QT_WAYLAND_DISABLE_WINDOWDECORATION "1"
    DISPLAY ":0"
}
input {
    keyboard {
        xkb {
        }
        numlock
    }
    touchpad {
        tap
        natural-scroll
    }

    warp-mouse-to-focus
    focus-follows-mouse max-scroll-amount="100%"
}
output "HKC OVERSEAS LIMITED OG27QK 0000000000000" {
    mode "2560x1440@120.000"
    scale 1
    transform "normal"
    position x=0 y=0
}

layout {
    background-color "transparent"
    gaps 4
    always-center-single-column
    center-focused-column "never"

    preset-column-widths {
        proportion 0.33333
        proportion 0.5
        proportion 0.66667
    }

    default-column-width { proportion 0.5; }

    focus-ring {
        width 2
        active-color "#7fc8ff"
        inactive-color "#505050"
        active-gradient from="#80c8ff" to="#c7ff7f" angle=45
    }

    border {
        off

        width 4
        active-color "#ffc87f"
        inactive-color "#505050"
        urgent-color "#9b0000"
    }

    shadow {
        on
        draw-behind-window true
        softness 30
        spread 7
        offset x=0 y=5
        color "#0007"
    }

    struts {
        left 4
        right 4
        top 4
        bottom 4
    }
}

spawn-at-startup "waybar"
spawn-at-startup "xwayland-satellite"

prefer-no-csd
screenshot-path "~/Pictures/Screenshots/Screenshot from %Y-%m-%d %H-%M-%S.png"
animations {
    slowdown 1.5
}

window-rule {
    match app-id=r#"^org\.wezfurlong\.wezterm$"#
    default-column-width {}
}

window-rule {
    match app-id=r#"firefox$"# title="^Picture-in-Picture$"
    open-floating true
}

window-rule {
    match app-id=r#"^org\.keepassxc\.KeePassXC$"#
    match app-id=r#"^org\.gnome\.World\.Secrets$"#
    block-out-from "screen-capture"
}

window-rule {
    geometry-corner-radius 15
    clip-to-geometry true
}
```

### fcitx5
중국어 입력/출력을 지원하려면 시스템에 출력용 폰트와 입력용 fcitx5를 설치해야 한다.
```shell
# install fonts
sudo pacman -S noto-fonts-cjk wqy-microhei

# install fcitx5
sudo pacman -S fcitx5-im fcitx5-chinese-addons

# add env to /etc/environment
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS="@im=fcitx"
SDL_IM_MODULE=fcitx
```

fcitx5에 대한 더 많은 설정은 `fcitx5-configtool`을 사용하여 GUI에서 설정을 업데이트한다. 더 보기: [fcitx5](https://wiki.archlinuxcn.org/wiki/Fcitx5) 및 [Simplified Chinese](https://wiki.archlinuxcn.org/wiki/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%E6%9C%AC%E5%9C%B0%E5%8C%96)

### NetworkManager
NetworkManager는 시스템이 네트워크에 자동으로 연결할 수 있도록 감지 및 설정을 제공하는 프로그램이다. `networkmanager` 패키지에는 데몬 프로그램, 명령 클라이언트(nmcli), tui 클라이언트(nmtui)가 포함되어 있다.
```shell
# install
sudo pacman -S networkmanager
```

`nmcli` 사용법:
```shell
# detect wifi list
nmcli device wifi list

# connect to wifi
nmcli device wifi connect [SSID/BSSID] [password]

# connect to hidden wifi
nmcli device wifi connect [SSID/BSSID] [password] hidden yes

# show all network device status
nmcli device

# turn off wifi
nmcli radio wifi off

# show connection info
nmcli connection show

# connect by saved config
nmcli connection up [name/uuid]

# delete saved config
nmcli connection delete [name/uuid]
```

### steam
SteamOS<sup>[6]</sup>는 Valve가 개발한 게임 중심의 리눅스 배포판으로, Arch Linux를 기반으로 하며 회사의 비디오 게임 스토어프론트인 Steam을 통합했다.
Valve의 [Proton](https://github.com/ValveSoftware/Proton) 호환성 레이어 덕분에 Steam 라이브러리의 대부분의 게임이 리눅스에서 실행될 수 있다. 게임의 호환성 정보는 [ProtonDB](https://www.protondb.com/)에서 얻을 수 있다.

Arch Linux용 Steam을 설치하려면 다음 단계를 따른다:
```shell
# if PC is intel cpu with nvidia gpu, choose vulkan-intel;
# if PC is amd cpu/gpu, choose amdvlk
sudo pacman -S steam

# Steam only support x11 until now, so there is need to install and run xwayland-satellite for Wayland
sudo pacman -S xwayland-satellite
```

더 많은 정보는 [ArchWiki-Steam](https://wiki.archlinuxcn.org/wiki/Steam)을 참고한다.

### 음악 플레이어
온라인 음악 스트리밍은 NetEase Cloud Music이나 QQ Music 같은 공식 플랫폼을 통해 이용할 수 있지만, 리눅스에서의 경험은 열악하고 이러한 서비스는 오랫동안 업데이트되지 않았다. 분명히 이 회사들은 리눅스 데스크톱 환경에 자원을 투자할 의향이 없다.
여기서는 온라인 음악 재생을 위해 [YesPlayMusic](https://github.com/qier222/YesPlayMusic) 사용을 권장한다.
```shell
# install app by yay/paru
paru -S yesplaymusic
```

링크:
[1]: 더 보기: [Linux and GNU project](https://www.gnu.org/gnu/linux-and-gnu.html)
[2]: 1970년대에 Ken Thompson, Dennis Ritchie 및 AT&T Laboratories의 많은 사람들이 개발한 혁신적이고 획기적인 운영 체제. 더 보기: [Unix](https://unix.org/)
[3]: ventoy 설치에 대해서는 [doc](https://www.ventoy.net/cn/doc_start.html) 참고
[4]: 리눅스용으로 개발된 현대적인 copy-on-write (CoW) 파일 시스템으로, 고급 기능을 제공하면서도 내결함성, 복구 및 관리 용이성을 강조하도록 설계되었다.
[5]: Teletypewriter. 현대의 유닉스 계열 운영 체제에서 터미널 장치 입력/출력은 tty를 통해 시스템으로 전달된다. tty는 터미널과 셸 사이에 위치하여 문자 스트림 전송과 기본 제어를 처리하며, 터미널과 셸 간의 통신을 가능하게 한다.
```shell
# commands workflow
User Input/Display
      ↓ 
Terminal Device
      ↓ 
tty (Kernel character device interface, for transmitting input, output, and control)
      ↓ 
Shell (Command Line Interpreter, for parsing and executing commands)
      ↓ 
Operating System Kernel (Executes commands, manages resources)
```
[6]: 더 보기: [SteamOS](https://store.steampowered.com/steamos)