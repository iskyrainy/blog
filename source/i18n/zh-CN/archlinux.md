---
title: Arch Linux
category: Tech
tag: Linux
date: 2025-10-26T10:55:32+08:00
---


# Linux 安装与配置
## 为什么选择 Linux？
GNU/Linux 是一个完全开源的操作系统内核，所以我们通常所说的“Linux”其实是 GNU/Linux 的各种发行版<sup>[1]</sup>。
我们可以使用许多发行版，如 Ubuntu、Debian、Fedora、CentOS、Mint、Gentoo、Arch 等。但为什么要选择 Linux 呢？
1. **开源**：正如我们所说，GNU/Linux 内核是一个完全开源的项目，任何人都可以轻松地从网络上获取其源代码，这意味着你可以自行修改内核源代码。
2. **多用户**：Linux 对多用户的支持是最好的，每个用户的任务都可以轻松管理和切换。
3. **稳定与安全**：Linux 继承了 Unix<sup>[2]</sup> 出色的稳定性和高效性。Linux 操作系统能够充分发挥服务器的硬件优势。
4. **出色的生态系统**：Linux 拥有丰富的生态系统，可以轻松满足服务器、办公、开发和娱乐等各种需求。Linux 既适合服务器也适合开发，这意味着开发者可以从头到尾遵循同一套标准，这是一个不可估量的优势。

本博客将详细介绍如何安装和配置 Arch Linux（*一个简单、轻量的发行版*）。

## 安装
### 安装前准备
要将 Arch 安装到你的 PC 设备上，这里需要准备一个至少 **8GB** 存储容量的 U 盘。
我推荐使用 *ventoy* 进行安装，请按照以下步骤操作：
1. 从 [ventoy 下载](https://www.ventoy.net/cn/download.html) 页面下载 ventoy
2. 将 ventoy 安装到你的 USB 设备中<sup>[3]</sup>
3. 从镜像站下载 Arch iso（任意镜像站均可，这里我使用 [aliyun-archlinux](https://mirrors.aliyun.com/archlinux/iso/)）
4. 将 iso 文件放入你的 ventoy U 盘

### 安装 Arch
准备好 U 盘后，现在开始安装。
1. 将 U 盘插入 PC，然后启动 PC
2. 进入 BIOS，将 USB 设置为第一启动项，然后保存并退出，这将进入 ventoy 系统
3. 在列表中选择 Arch Linux 项，进入第一项后进入安装环境（tty）
    ![arch-1](https://i.postimg.cc/kXkG6QYv/Arch-1.png)
4. 推荐在有线网络环境下安装，也可以使用 [`iwctl`](https://man.archlinux.org/man/iwctl.1) 设置 WIFI 连接，最重要的是确保整个安装过程处于联网环境中
    ![arch-2](https://i.postimg.cc/jdWCSgcF/Arch-2.png)
5. 更新 keyring 并安装 archinstall：
    ```shell
    pacman -Sy archlinux-keyring
    pacman -S archinstall
    ```
6. 启动 [archinstall](https://archinstall.archlinux.page/installing/guided.html)：
    ```shell
    archinstall
    ```
    建议启用 **UKI**、**Swap** 和 **NTP 同步**。对于引导加载程序，推荐使用 `systmed`。
    1. language（语言）：English
        ![arch-3](https://i.postimg.cc/KvdjkPp5/Arch-3.png)
    2. locale（区域设置）：选择你所在的地区
        ![arch-4](https://i.postimg.cc/SNwR261V/Arch-4.png)
        ![arch-5](https://i.postimg.cc/wTSMyX4S/Arch-5.png)
    3. disk config（磁盘配置）：*1024MB 用于引导加载程序*，*与主内存等大小用于 linux swap*，*其余用于磁盘*
        ![arch-8](https://i.postimg.cc/SNwR26t0/Arch-8.png)
        这里推荐磁盘使用 **btrfs**<sup>[4]</sup>，也可以选择 **ext4**。
        并为磁盘添加两个子卷：
        ![arch-7](https://i.postimg.cc/jdG2wHkr/Arch-7.png)
    4. auth（认证）：设置 root 密码并添加一个非 root 用户用于日常使用。
        ![arch-9](https://i.postimg.cc/mgCDQP0B/Arch-9.png)
    5. profile（配置文件）：archinstall 提供了许多适用于不同场景的配置文件，根据你的需求选择一个。
        ![arch-10](https://i.postimg.cc/Cxk1jRWw/Arch-10.png)
    6. application（应用）：主要用于蓝牙和音频
        ![arch-11](https://i.postimg.cc/t4WThsLT/Arch-11.png)
    7. kernel（内核）：这里有四个可选，差异见下表
        | 内核               | 描述                                                                                                              | 主要目标                                                                         | 优点                                                                                                                               | 缺点                                                                                           |
        | ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
        | **linux**          | **主线内核**，更新频繁，由 Linus Torvalds 和内核团队直接维护。                                                    | 提供**最新的稳定**内核版本。                                                     | – 最新的硬件支持<br>– 更新频繁<br>– 稳定性和性能的良好平衡                                                                         | – 偶尔可能引入回归<br>– 稳定性略低于 LTS                                                       |
        | **linux-lts**      | **长期支持**内核，维护周期较长（通常为 2–6 年）。                                                                 | 优先考虑**稳定性和长期可靠性**，而非前沿特性。                                   | – 非常稳定<br>– 回归较少<br>– 非常适合服务器、生产系统和较旧的硬件                                                                 | – 新硬件支持到来较慢<br>– 缺少一些近期的内核改进                                               |
        | **linux-hardened** | 带有**额外安全加固补丁**的内核变体，由社区和 Arch 维护者开发。                                                    | 专注于**安全性和减小攻击面**。                                                   | – 增强的安全性（例如更严格的内存保护、针对内核漏洞的缓解措施）<br>– 非常适合注重安全的系统                                      | – 略有性能开销<br>– 部分特性和驱动可能受限或不兼容                                             |
        | **linux-zen**      | 针对**桌面性能和响应速度**调优的内核，由 Zen 内核项目维护。                                                       | 针对**低延迟**和流畅的桌面体验进行优化。                                         | – 更好的交互性和响应速度<br>– 改进的桌面和游戏性能                                                                                 | – 稳定性略低于主线<br>– 支持周期较短<br>– 不适合服务器                                        |
        
        ![arch-12](https://i.postimg.cc/Z5pRrW15/Arch-12.png)
    8. network（网络）：推荐使用 NetworkManager
        ![arch-13](https://i.postimg.cc/rwxmSDvz/Arch-13.png)
    9. pkgs（软件包）：如果使用 `linux-zen`，需要添加 `linux-zen-header`
        ![arch-14](https://i.postimg.cc/dVr18hzL/Arch-14.png)
    10. timezone（时区）：选择你所在的地区
        ![arch-15](https://i.postimg.cc/13wtp8LV/Arch-15.png)
7. 进入 Arch Linux 设置 systemd 启动项：
    ```shell
    # 进入 Arch Linux
    arch-chroot /mnt
    
    # 安装并配置
    bootctl install
    bootctl list
    exit

    # 重启
    reboot
    ```
到此为止，所有安装都已设置完成。

## 配置
TTY<sup>[5]</sup> 完全能够满足服务和开发的所有功能需求，但对绝大多数人来说，GUI 无疑是易用性与效率之间的平衡。
> 如果你在中国大陆，可能需要使用某些方式来避免网络封锁

### Gnome/KDE
GNOME/KDE 几乎不需要配置；所有基本功能开箱即用。当然，你也可以安装插件来自定义系统或增强其功能。

### Hyprland
[Hyprland](https://github.com/hyprwm/Hyprland) 是一个 100% 独立的动态平铺 Wayland 合成器，同时不牺牲其外观。
与堆叠式窗口管理相比，平铺式窗口管理的优势在于能够最大限度地利用屏幕的每一寸空间并提供更多信息。

目前有许多完整且成熟的 Hyprland 配置方案。比如 [HYDE](https://github.com/HyDE-Project/HyDE)、[Omarchy](https://omarchy.org/) 等。
这里我推荐 [end_4 hyprland dotfiles](https://github.com/end-4/dots-hyprland)：
```shell
# 运行此命令安装 end_4 hyprland dotfiles
bash <(curl -s https://ii.clsty.link/get)
```

### Niri
[Niri](https://github.com/YaLTeR/niri) 也是一种动态平铺 Wayland 合成器，但与 Hyprland 有所不同。
Niri 允许用户无限地水平扩展当前窗口。此外，Niri 提供全局动态窗口预览，让用户可以轻松切换正在使用的窗口。
不得不说，一旦你体验过 Niri 的无限扩展，Hyprland 的窗口体验就会大打折扣。
![niri-preview](https://i.postimg.cc/C57FXq2H/niri-preview.png)

这里有一份 Niri 的简单配置：
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
为了支持中文输入/输出，系统应安装用于输出的字体和用于输入的 fcitx5。
```shell
# 安装字体
sudo pacman -S noto-fonts-cjk wqy-microhei

# 安装 fcitx5
sudo pacman -S fcitx5-im fcitx5-chinese-addons

# 将环境变量添加到 /etc/environment
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS="@im=fcitx"
SDL_IM_MODULE=fcitx
```

更多 fcitx5 配置，使用 `fcitx5-configtool` 在 GUI 中更新配置。参见 [fcitx5](https://wiki.archlinuxcn.org/wiki/Fcitx5) 和 [简体中文](https://wiki.archlinuxcn.org/wiki/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%E6%9C%AC%E5%9C%B0%E5%8C%96)

### NetworkManager
NetworkManager 是一个为系统提供网络检测和配置以实现自动连接网络的程序。`networkmanager` 包包含守护进程、命令行客户端（nmcli）、TUI 客户端（nmtui）。
```shell
# 安装
sudo pacman -S networkmanager
```

`nmcli` 的用法：
```shell
# 检测 wifi 列表
nmcli device wifi list

# 连接 wifi
nmcli device wifi connect [SSID/BSSID] [password]

# 连接隐藏 wifi
nmcli device wifi connect [SSID/BSSID] [password] hidden yes

# 显示所有网络设备状态
nmcli device

# 关闭 wifi
nmcli radio wifi off

# 显示连接信息
nmcli connection show

# 通过已保存的配置连接
nmcli connection up [name/uuid]

# 删除已保存的配置
nmcli connection delete [name/uuid]
```

### steam
SteamOS<sup>[6]</sup> 是 Valve 开发的一款以游戏为核心的 Linux 发行版，基于 Arch Linux 并集成了该公司的视频游戏商店 Steam。
得益于 Valve 的 [Proton](https://github.com/ValveSoftware/Proton) 兼容层，Steam 库中的绝大多数游戏都可以在 Linux 上运行。我们可以在 [ProtonDB](https://www.protondb.com/) 上获取游戏兼容性的相关信息。

按照以下步骤为 Arch Linux 安装 Steam：
```shell
# 如果 PC 是 intel cpu 配 nvidia gpu，选择 vulkan-intel；
# 如果 PC 是 amd cpu/gpu，选择 amdvlk
sudo pacman -S steam

# Steam 至今仅支持 x11，因此需要在 Wayland 上安装并运行 xwayland-satellite
sudo pacman -S xwayland-satellite
```

更多信息参见 [ArchWiki-Steam](https://wiki.archlinuxcn.org/wiki/Steam)。

### 音乐播放器
可以通过网易云音乐或 QQ 音乐等官方平台进行在线音乐流媒体播放，但在 Linux 上体验很差，而且这些服务已经很久没有更新了。显然，这些公司不愿意在 Linux 桌面环境上投入资源。
这里推荐使用 [YesPlayMusic](https://github.com/qier222/YesPlayMusic) 在线播放音乐。
```shell
# 通过 yay/paru 安装应用
paru -S yesplaymusic
```

链接：
[1]: 更多内容参见 [Linux 与 GNU 项目](https://www.gnu.org/gnu/linux-and-gnu.html)
[2]: 一个具有创新性或开创性的操作系统，由 Ken Thompson、Dennis Ritchie 等人在 20 世纪 70 年代于 AT&T 实验室开发。更多内容参见 [Unix](https://unix.org/)
[3]: ventoy 的安装参见 [文档](https://www.ventoy.net/cn/doc_start.html)
[4]: 一种为 Linux 开发的现代写时复制（CoW）文件系统，旨在提供高级功能，同时强调容错性、可修复性和易管理性。
[5]: Teletypewriter（电传打字机）。在现代类 Unix 操作系统中，终端设备的输入/输出通过 tty 传递给系统。tty 位于终端和 shell 之间，处理字符流传输和基本控制，实现终端与 shell 之间的通信。
```shell
# 命令工作流程
用户输入/显示
      ↓ 
终端设备
      ↓ 
tty（内核字符设备接口，用于传输输入、输出和控制）
      ↓ 
Shell（命令行解释器，用于解析和执行命令）
      ↓ 
操作系统内核（执行命令、管理资源）
```
[6]: 更多内容参见 [SteamOS](https://store.steampowered.com/steamos)