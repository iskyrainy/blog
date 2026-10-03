---
title: Move Work PC From Windows To Linux
category: Tech
tag: Linux
date: 2026-04-15T21:18:07+08:00
---


## Not Windows, But Linux
Windows is absolutely unrivaled when it comes to out-of-the-box experience and ecosystem. Its GUI is designed to be very intuitive (except for Win11), and its strong compatibility brings an ecosystem that no other operating system can match. But I really hate some of Win11's GUI design and forced updates (also, as a side note, every time I select "Update and shut down," it ends up updating and then rebooting — Microsoft doesn't seem to plan on fixing this bug). Also, Windows' command terminal isn't very good to use, and some development scenarios require WSL. But WSL is essentially a virtual machine, and networking and so on all have to be configured on the host Windows, so we're back to square one.

Besides my preference regarding Windows itself, another reason that must be mentioned — and the biggest one — is that the company-issued computer really struggles to run Win11: a 10th-gen i5 *ThinkPad*, opening a few projects in JetBrains IDEs, and the efficiency is just awful.

So I started considering switching my work environment, and now I have a few options:
1. Buy a newer, more powerful laptop, either a Windows Laptop or a MacBook;
  - Pros: Almost no need to worry about performance anymore, strong ecosystem and compatibility
  - Cons: Costs money
2. Migrate to Linux;
  - Pros: Thanks to Linux's configurability, it consumes fewer resources, which indirectly solves the performance problem. A unified and direct development ecosystem, use as needed.
  - Cons: Need to figure out the office environment outside of development — how to install some work software, how to access the company intranet

Some colleagues around me have also bought MacBooks to use. In my view, MacOS is even more of a pile of garbage. Every time I receive an archive from a MacOS user, it always comes with layers of the notorious `.DS_Store` 🤮. Anyway, option 1 was quickly rejected by me. Having to spend my own money on a work computer just to go to work? No way.

Without a doubt, Linux can perfectly — or even better than perfectly — deliver 120% coding efficiency. But can Linux really handle daily office work outside of development? Here are the scenarios I encounter in my daily work:
1. Sending and receiving emails;
2. IM software, including WeChat and the company's IM;
3. Intranet access, including intranet connectivity and access to intranet resources;
4. Document viewing and editing, including Word, Excel, PPT, PDF, and Visio;

If these basic points can't be satisfied, then using Linux for work is just a pipe dream.

So I decided to first flash the system on my home computer to test it out. I had previously installed Arch Linux on my home computer, but I definitely couldn't use Arch on a work computer — this kind of rolling release is just too unstable. Also, my home Arch was configured all fancy and flashy; it's really fun to play with as a toy, but honestly, if I were using it for work, I wouldn't particularly like that kind of flashy stuff — it distracts from the main purpose. At first I planned to use Fedora as my work system, so I wiped Arch on my home computer and switched to Fedora KDE.

Actually, I personally prefer Red Hat family operating systems. First, Linus himself uses Fedora on his machine; second, the Red Hat family is a household name in the server world, so I'm already used to it. After flashing the system, I tested the four points above one by one.

The email test wasn't really about whether there's usable software — it was more about how to **migrate** Windows Foxmail emails to a new email client. BTW, emails should originally all be stored on the mail server, and migrating to a new email client should just require pulling from the mail server. But the company's Network and Information Security Department requires that emails older than 7 days be automatically deleted, supposedly for information security. 😅 A bit humorous — emails stored on the server are less secure than stored on the user's client? I tested using Thunderbird and found that installing a plugin<sup>[1]</sup> allows EML email import.

For IM software, thanks to the development of domestic Xinchuang (IT innovation) substitution, most IM apps have been adapted to one or more Xinchuang systems. WeChat officially provides deb/rpm/AppImage installation packages, and the company IM also provides a deb package. Fedora is a Red Hat family distribution and uses rpm packages. I converted the company IM's deb package to an rpm package, tried many times, and still couldn't get it to run successfully in the end. I can't help but sigh — packaging for Linux really is a pain; even Linus himself is unwilling to make distribution packages for Linux. 😮‍💨

Documents are the easiest — not only can you use LibreOffice, you can also use WPS. For document office scenarios, it basically covers everything comprehensively. One thing to note is that some Linux systems don't come with or manage Chinese fonts for document work such as SimSun/FangSong/SimHei/KaiTi.

The most important part — intranet access. The new login authentication service the company purchased, 360, runs just fine under Windows. But on Linux, I see it only supports the desktop version for Xinchuang OSes; others like Ubuntu only support the server version. I tried for quite a while and still haven't successfully connected to the intranet. 😓 So for now I'm still accessing the intranet through a VirtualBox Windows VM + VPN. I also tested winboat; I'll talk about that in a later section.

> After testing, deb-based systems are actually better supported.

Below is part of the process of migrating to Debian 13. 👉

## Let's go!
> !!! Before installing a new system, be sure all your data has been backed up.

Delete the partition table and install Debian 13 KDE.

### Circumventing Internet Censorship
There's basically nothing much to say about this part — most software supports cross-platform, such as *v2rayn* and so on. Download the deb and install it, then import the configuration.
```bash
sudo apt install ./v2rayN-linux-64.deb
```

### Input Method
Without a doubt, of course I use fcitx5 + rime.
```bash
sudo apt install fcitx5-rime

# For the dictionary, you can choose Wanxiang or Wusong, etc.
cd $HOME/.local/share/fcitx5
# Taking Wusong as an example
git clone https://github.com/iDvel/rime-ice.git rime --depth 1
```
First, in "Keyboard" -> "Virtual Keyboard," select "Fcitx5 Wayland." Then in KDE settings, go to "Language and Time" -> "Input Method," delete all default input methods, and add rime (Zhongzhou Yun).

### Fonts
Font installation includes both English and Chinese fonts.
```bash
sudo apt install fonts-roboto fonts-dejavu-core fonts-cantarell fonts-liberation
```

Manual installation part:
- English fonts: [Nerd Font](https://www.nerdfonts.com/).
- Chinese fonts: [Document font bundle](https://flc.zjnu.edu.cn/2024/1110/c18580a485306/page.htm), Microsoft YaHei<sup>[2]</sup>.

To manually install fonts, follow the steps below:
```bash
sudo apt install fontconfig xfonts-utils
mkdir -p ~/.local/share/fonts

cp /path/to/your/font.tty ~/.local/share/fonts/
cp /path/to/your/font.ttc ~/.local/share/fonts/

chmod 644 ~/.local/share/fonts/*
fc-cache -fv
```

### Office Software
Some commonly used office software:
- [WeChat](https://linux.weixin.qq.com/)
- [QQ](https://im.qq.com/linuxqq/download.html)
- [WPS](https://www.wps.cn/product/wpslinux#)
- [MoeKoe](https://music.moekoe.cn/)
- [listen1_desktop](https://github.com/listen1/listen1_desktop)

After downloading the installation package, go to the download directory and run `sudo apt install ./xxx.deb`

For email, use Thunderbird, installed by running `sudo apt install thunderbird`. After configuring the email account in Thunderbird, install the ImportExportTools NG plugin, then right-click the inbox to start importing EML emails.

### Virtual VM
I'm currently using Oracle VirtualBox. VBox virtualization isn't through kvm but through vboxdrv, yet the system loads kvm by default. Use the following script to quickly switch between kvm and vboxdrv.
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

360 Security Terminal identifies all non-Xinchuang OSes as server-side. Even if the desktop version can be used, the experience won't be great (no dual-span). So is there a method that combines both?

Yes, Winboat<sup>[3]</sup> can theoretically fully meet the requirement. Winboat runs Windows through a container, and then transmits Windows native applications to the Linux desktop via the RDP protocol.

Therefore, in theory, as long as you install and connect VPN on the Windows inside the container, and then use winboat to use Windows native services, the requirement would be met. But why do I say "in theory"? Because after Windows connects to the VPN, the VPN also blocks LAN communication, and the winboat API becomes invalid.

If, after connecting to the VPN, you could run a script or use any other method to ensure LAN communication works normally, then it should work. I'll test it later when I have time.

### Development Environment
Development environment configuration is a matter of personal preference. Just remember to git clone your previous dotfiles locally. But how can domestic development do without mirror sites, heh. 😅
Commonly used mirror sites:
- [Alibaba Cloud](https://developer.aliyun.com/mirror/)
- [USTC](https://mirrors.ustc.edu.cn/)
- [Tsinghua](https://mirrors.tuna.tsinghua.edu.cn/)
- [Docker mirror site - Nanjing University](https://doc.nju.edu.cn/books/e1654)
- [Docker mirror site - GitHub](https://github.com/dongyubin/DockerHub)

### KDE Plugins
I have to say, the default KDE really is a bit less than aesthetically pleasing. 🤔
A few recommended plugins:
- [KdeControlStation](https://store.kde.org/p/2196105): Comprehensive control panel, including network/Bluetooth, etc.
- [Kurve - Audio Visualizer](https://store.kde.org/p/2299506): Audio visualizer
- [Panel Colorizer](https://store.kde.org/p/2130967): Beautify the dock
- [Advanced Weather Widget](https://store.kde.org/p/2349879): A better weather widget

> A bit of a shame — there doesn't seem to be any decent perpetual calendar widget 😓

Links:
[1]: [ImportExportTools NG](https://addons.thunderbird.net/zh-CN/thunderbird/addon/importexporttools-ng/?src=hp-dl-mostpopular)
[2]: The simplest way is to copy it over from Windows, C:/Windows/Fonts/msyh*.ttc
[3]: A piece of software aimed at natively using Windows applications on Linux. See more [winboat](https://winboat.app/).