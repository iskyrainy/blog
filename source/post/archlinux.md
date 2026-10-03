---
title: Arch Linux
category: Tech
tag: Linux
date: 2025-10-26T10:55:32+08:00
---


# Linux Install and Config
## Why is Linux?
GNU/Linux is a totally open-source operation system kernel, so "Linux" which we called in usually is the distributions of GNU/Linux<sup>[1]</sup>.
There are many distributions we can use, as Ubuntu, Debian, Fedora, CentOS, Mint, Gentoo, Arch etc. But why is Linux?
1. **open source**: as we say, GNU/Linux kernel is whole open-source project, anyone can easily get its source code from net, which mean you can modify kernel source code in your own
2. **multiple users**: Linux has the best support for multiple users, each users' task can be managed and switch easily
3. **stable and safty**: Linux inherits the excellent stability and efficiency of Unix<sup>[2]</sup>. The Linux operating system can fully demonstrate the hardware advantages of the server.
4. **amazing ecosystem**: Linux has a rich ecosystem that can easily meet various needs such as servers, office, development and entertainment. Linux is suitable for both servers and development, which means that developers can follow the same set of standards from beginning to end, which is an immeasurable advantage.

This blog will show how to install and config Arch Linux(*A simple, lightweight distribution*) in detail.

## Install
### Pre-Install
For install Arch into your PC device, here need prepare an USB flash drive with at least **8GB** storage size. 
I recommend using *ventoy* for installation, follow steps behind:
1. download ventoy form [ventoy download](https://www.ventoy.net/cn/download.html)
2. install ventoy into your USB device<sup>[3]</sup>
3. install Arch iso from mirror station(any is ok, here I use [aliyun-archlinux](https://mirrors.aliyun.com/archlinux/iso/))
4. put iso file into your ventoy USB

### Install Arch
After prepare USB, now start the installation.
1. insert USB on PC, then start the PC
2. into the BIOS, set USB as the first boot item, then save and quit, this will go into ventoy system
3. choose Arch Linux item in list, and goto the first item then into the installation environment(tty)
    ![arch-1](https://i.postimg.cc/kXkG6QYv/Arch-1.png)
4. recommend install in wired network environment, also can use [`iwctl`](https://man.archlinux.org/man/iwctl.1) to set WIFI connection, the most important is make sure the entire installation in a networked environment
    ![arch-2](https://i.postimg.cc/jdWCSgcF/Arch-2.png)
5. update keyring and install archinstall:
    ```shell
    pacman -Sy archlinux-keyring
    pacman -S archinstall
    ```
6. start [archinstall](https://archinstall.archlinux.page/installing/guided.html):
    ```shell
    archinstall
    ```
    It is recommended to enable **UKI**, **Swap**, and **NTP synchronization**. For the bootloader, `systmed` is recommended.
    1. language: English
        ![arch-3](https://i.postimg.cc/KvdjkPp5/Arch-3.png)
    2. locale: choose your region
        ![arch-4](https://i.postimg.cc/SNwR261V/Arch-4.png)
        ![arch-5](https://i.postimg.cc/wTSMyX4S/Arch-5.png)
    3. disk config: *1024MB for bootloader*, *equal size with main memory for linux swap*, *other for disk*
        ![arch-8](https://i.postimg.cc/SNwR26t0/Arch-8.png)
        Here recommend use **btrfs**<sup>[4]</sup> for disk, also can choose **ext4**.
        And add two subvolum for disk:
        ![arch-7](https://i.postimg.cc/jdG2wHkr/Arch-7.png)
    4. auth: set root pwd and add a non-root user for common using.
        ![arch-9](https://i.postimg.cc/mgCDQP0B/Arch-9.png)
    5. profile: archinstall offers many profiles for differernt scenes, choose one for your need.
        ![arch-10](https://i.postimg.cc/Cxk1jRWw/Arch-10.png)
    6. application: mainly for bluetooth and audio
        ![arch-11](https://i.postimg.cc/t4WThsLT/Arch-11.png)
    7. kernel: here has four to choose, see different in table
        | Kernel             | Description                                                                                                       | Main Goals                                                                      | Pros                                                                                                                               | Cons                                                                                           |
        | ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
        | **linux**          | The **mainline kernel**, updated frequently and maintained directly by Linus Torvalds and the kernel team.        | Provides the **latest stable** kernel release.                                  | – Latest hardware support<br>– Frequent updates<br>– Good balance of stability and performance                                     | – May occasionally introduce regressions<br>– Slightly less stable than LTS                    |
        | **linux-lts**      | The **Long-Term Support** kernel, maintained for an extended period (usually 2–6 years).                          | Prioritizes **stability and long-term reliability** over cutting-edge features. | – Very stable<br>– Fewer regressions<br>– Ideal for servers, production systems, and older hardware                                | – Slower to receive new hardware support<br>– Missing some recent kernel improvements          |
        | **linux-hardened** | A kernel variant with **additional security hardening patches**, developed by the community and Arch maintainers. | Focuses on **security and attack surface reduction**.                           | – Enhanced security (e.g., stricter memory protections, mitigations for kernel exploits)<br>– Great for security-conscious systems | – Slight performance overhead<br>– Some features and drivers may be restricted or incompatible |
        | **linux-zen**      | A kernel tuned for **desktop performance and responsiveness**, maintained by the Zen kernel project.              | Optimized for **low latency** and a smooth desktop experience.                  | – Better interactivity and responsiveness<br>– Improved desktop and gaming performance                                             | – Slightly less stable than mainline<br>– Shorter support window<br>– Not ideal for servers    |
        
        ![arch-12](https://i.postimg.cc/Z5pRrW15/Arch-12.png)
    8. network: recommend use NetworkManager
        ![arch-13](https://i.postimg.cc/rwxmSDvz/Arch-13.png)
    9. pkgs: if using `linux-zen`, there need to add `linux-zen-header`
        ![arch-14](https://i.postimg.cc/dVr18hzL/Arch-14.png)
    10. timezone: choose your region
        ![arch-15](https://i.postimg.cc/13wtp8LV/Arch-15.png)
7. into Arch Linux to set systemd boot items:
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
End now, all installations are setup.

## Config
TTY<sup>[5]</sup> is perfectly capable of meeting all the functional requirements of services and development, but for the vast majority of people, a GUI is undoubtedly the balance between ease of use and efficiency.
> If you are in Chinese mainland, you maybe need to use some ways to avoid lock

### Gnome/KDE
GNOME/KDE requires almost no configuration; all basic functions are ready to use out of the box. Of course, you can also install plugins to customize the system or enhance its functionality.

### Hyprland
[Hyprland](https://github.com/hyprwm/Hyprland) is a 100% independent, dynamic tiling Wayland compositor that doesn't sacrifice on its looks. 
Compared to stacked window management, tiled window management has the advantage of maximizing the use of every inch of the screen and providing more information.

There are currently many complete and mature Hyprland configuration solutions. Like [HYDE](https://github.com/HyDE-Project/HyDE), [Omarchy](https://omarchy.org/) etc.
Here I recommend [end_4 hyprland dotfiles](https://github.com/end-4/dots-hyprland):
```shell
# run this command to install end_4 hyprland dotfiles
bash <(curl -s https://ii.clsty.link/get)
```

### Niri
[Niri](https://github.com/YaLTeR/niri) is also one type of dynamic tiling Wayland compositor but has different from Hyprland.
Niri allows users to extend the current window horizontally indefinitely. Furthermore, Niri provides a global dynamic window preview, allowing users to easily switch between the windows they are using.
It must be said that once you've experienced Niri's infinite expansion, Hyprland's window experience is significantly diminished.
![niri-preview](https://i.postimg.cc/C57FXq2H/niri-preview.png)

Here has a simple config for niri:
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
To support Chinese input/output, system should install fonts for output and fcitx5 for input.
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

More config for fcitx5, use `fcitx5-configtool` to update config in gui. See more [fcitx5](https://wiki.archlinuxcn.org/wiki/Fcitx5) and [Simplified Chinese](https://wiki.archlinuxcn.org/wiki/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%E6%9C%AC%E5%9C%B0%E5%8C%96)

### NetworkManager
NetworkManager is a program for providing detection and configuration for systems to automatically connect to networks. `networkmanager` pkg includes daemon program, command client(nmcli), tui client(nmtui).
```shell
# install
sudo pacman -S networkmanager
```

Usage of `nmcli`:
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
SteamOS<sup>[6]</sup> is a gaming-focused Linux distribution developed by Valve, based on Arch Linux and incorporating the company's video game storefront, Steam.
Thanks to Valve's [Proton](https://github.com/ValveSoftware/Proton) compatibility layer, the vast majority of games in the Steam library can run on Linux. We can get the information about game's compatibility at the [ProtonDB](https://www.protondb.com/).

Follow those steps to install Steam for Arch Linux:
```shell
# if PC is intel cpu with nvidia gpu, choose vulkan-intel;
# if PC is amd cpu/gpu, choose amdvlk
sudo pacman -S steam

# Steam only support x11 until now, so there is need to install and run xwayland-satellite for Wayland
sudo pacman -S xwayland-satellite
```

More information see [ArchWiki-Steam](https://wiki.archlinuxcn.org/wiki/Steam).

### Music player
Online music streaming is available through official platforms like NetEase Cloud Music or QQ Music, but the experience is poor on Linux and these services haven't been updated in a long time. Clearly, these companies are unwilling to invest resources in Linux desktop environments.
Here recommend use [YesPlayMusic](https://github.com/qier222/YesPlayMusic) to play music online.
```shell
# install app by yay/paru
paru -S yesplaymusic
```

Links:
[1]: See more [Linux and GNU project](https://www.gnu.org/gnu/linux-and-gnu.html)
[2]: An innovative or groundbreaking operating system which was developed in the 1970s by Ken Thompson, Dennis Ritchie, and many others at AT&T Laboratories. See more [Unix](https://unix.org/)
[3]: installation of ventoy see [doc](https://www.ventoy.net/cn/doc_start.html)
[4]: A modern copy-on-write (CoW) file system developed for Linux, designed to provide advanced features while also emphasizing fault tolerance, repair, and ease of management.
[5]: Teletypewriter. In modern Unix-like operating systems, terminal device input/output is passed to the system via a tty. The tty sits between the terminal and the shell, handling character stream transmission and basic control, enabling communication between the terminal and the shell.
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
[6]: See more [SteamOS](https://store.steampowered.com/steamos)
