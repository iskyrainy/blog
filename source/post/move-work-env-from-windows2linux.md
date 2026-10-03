---
title: Move Work PC From Windows To Linux
category: Tech
tag: Linux
date: 2026-04-15T21:18:07+08:00
---


## Not Windows，But Linux
Windows在开箱即用和生态上绝对是无可比拟的存在。用户GUI设计的非常符合人的直觉（Win11除外），强大的兼容性也带来了其他任何操作系统都望之而不可及的生态。但是我非常讨厌Win11的一部分GUI设计和强制更新（另外吐槽一下，每次更新选“更新并关机”最后都是更新完重启，这个bug微软也不打算修了）。还有就是Windows的command terminal不怎么好用，一些开发场景需要使用WSL。但WSL本质虚拟机，网络等等都要在宿主机Windows上进行配置，所以又回到了原点。

除了对Windows本身的喜好外，另一个不得不说的原因也是最大的原因是，公司派发的电脑运行Win11是真的卡，10代i5的*ThinkPad*，使用JetBrains的IDE打开几个项目，那效率简直了。

于是我变考虑更换工作环境，现在有几个选择：
1. 购买更新性能更强的笔记本，Windows Laptop或者MacBook；
  - 优点：几乎不需要再考虑性能问题，生态强大且兼容
  - 缺点：需要花钱
2. 迁移至Linux；
  - 优点：由于Linux的可配置性，消耗更少的资源也变相解决了性能问题。统一且直接的开发生态，按需使用。
  - 缺点：需要考虑解决开发外的办公环境，一些工作软件如何安装，如何访问公司内网

身边也有一些同事购买MacBook使用，MacOS在我看来更是一坨垃圾，每次接收一些MacOS用户的压缩文件，里面总是带着层层臭名昭著的`.DS_Store` 🤮。总之第1条很快被我否决了，上个班还要自己出钱买办公电脑？No way.

毫无疑问，Linux可以完美甚至说可以带来120%的代码开发效率。但是Linux真的可以负担起除开发外的日常办公吗？以下是我日常工作中会遇到的场景：
1. 邮件接发；
2. IM软件，包括微信和公司的IM；
3. 内网访问，包括内网接入和内网资源访问；
4. 文档查看编辑，包括word、excel、ppt、pdf和visio；

如果不能满足这基本的几点，那使用Linux办公就是痴人说梦了。

所以我决定先在家里的电脑上刷机进行测试。家里的电脑我之前安装过Arch Linux，但办公电脑肯定不能使用Arch，这种滚动更新还是太不稳定。而且家里的Arch被我配置的花里胡哨，当成玩具玩一玩确实非常有意思，但说实在如果办公使用我不是特别喜欢这种花哨的东西，有些喧宾夺主。一开始我打算使用Fedora作为办公系统，于是把家里的Arch刷掉换成了Fedora KDE版。

其实我个人是更倾向于使用Redhat系的操作系统，一是Linus装机使用的就是Fedora，二是Redhat系在服务器领域家喻户晓，早已习惯。刷机后逐一对前面的四点进行测试。

邮件测试并不在有没有可用的软件，更主要的是如何**迁移**Windows Foxmail邮件至新邮件客户端。BTW，本来邮件应该是都存储在邮件服务器上的，迁移到新的邮箱客户端只需要从邮件服务器拉取就可以了。但是公司的网信安部要求必须自动删除7天前的邮件，说是为了信息安全。😅有点幽默了，邮件保存在服务器难道还不如保存在用户客户端安全？测试使用Thunderbird通过安装插件<sup>[1]</sup>即可实现EML邮件的导入。

IM软件得益于国产化信创替代的发展，基本多数IM均适配了一种或多种信创系统。微信官方提供的有deb/rpm/AppImage格式的安装包，公司IM也提供了deb安装包。Fedora是属于Redhat系的发行版，使用的是rpm包。我根据公司IM deb包进行转rpm包，试了很多次最后也无法成功运行。不得不感叹，给Linux打包确实麻烦，连linus本人都不愿为Linux制作发行包。😮‍💨

文档算是最简单的，不仅可以选择LibreOffice，还可以使用WPS。对于文档办公使用场景基本全面覆盖，需要注意的是部分Linux并不自带或管理宋体/仿宋/黑体/楷体等文档办公的中文字体。

最最重要的内网访问，公司采购的新的登录认证服务360，在Windows下运行停好的。但是在Linux我看只支持信创OS的桌面版，其他如Ubuntu等仅支持server版，尝试了半天目前还没有成功接入内网。😓因此目前还是通过VirtualBox Windows虚拟机+VPN访问内网。另外我还测试了winboat，具体后续章节再说。

> 经过测试，还是deb系的支持更好一些。

下面是迁移到Debian 13的部分过程。👉

## Let's go!
> !!! 安装新系统前务必确保所有资料已经备份。

删除分区表，安装Debian 13 KDE版本。

### 科学上网
这部分基本没什么好说的，大部分软件都是支持跨平台的，比如*v2rayn*等。下载deb后安装，导入配置。
```bash
sudo apt install ./v2rayN-linux-64.deb
```

### 输入法
毫无疑问当然使用fcitx5 + rime。
```bash
sudo apt install fcitx5-rime

# 词库可以选择万象或者雾凇等
cd $HOME/.local/share/fcitx5
# 以雾凇为例
git clone https://github.com/iDvel/rime-ice.git rime --depth 1
```
首先在“键盘”->“虚拟键盘”中选择“Fcitx5 Wayland”。然后在KDE setting里“语言和时间”->“输入法”，删除所有默认输入法，添加rime（中州韵）。

### 字体
字体安装包括英文字体和中文字体。
```bash
sudo apt install fonts-roboto fonts-dejavu-core fonts-cantarell fonts-liberation
```

手动安装部分：
- 英文字体: [Nerd Font](https://www.nerdfonts.com/)。
- 中文字体: [文档全家桶](https://flc.zjnu.edu.cn/2024/1110/c18580a485306/page.htm), 微软雅黑<sup>[2]</sup>。

手动安装字体按照下面操作：
```bash
sudo apt install fontconfig xfonts-utils
mkdir -p ~/.local/share/fonts

cp /path/to/your/font.tty ~/.local/share/fonts/
cp /path/to/your/font.ttc ~/.local/share/fonts/

chmod 644 ~/.local/share/fonts/*
fc-cache -fv
```

### 办公软件
一些常用的办公软件：
- [微信](https://linux.weixin.qq.com/)
- [QQ](https://im.qq.com/linuxqq/download.html)
- [WPS](https://www.wps.cn/product/wpslinux#)
- [MoeKoe](https://music.moekoe.cn/)
- [listen1_desktop](https://github.com/listen1/listen1_desktop)

下载安装包后到下载目录运行`sudo apt install ./xxx.deb`

邮件使用Thunderbird，通过运行`sudo apt install thunderbird`安装。在thunderbird配置邮箱账号后安装ImortExportTools NG插件，右键收件箱开始导入EML邮件。

### Virtual VM
我目前使用的Oracle VirtualBox。vbox虚拟化不是通过kvm而是vboxdrv，但是系统默认加载kvm。通过下面脚本快速切换kvm和vboxdrv。
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

360安全终端把非信创OS都识别到server端了。即便可以使用desktop版，使用体验也不会太好（不能双跨）。那有没有一种兼具二者的方法呢？

有的，Winboat<sup>[3]</sup>理论上完全可以实现需求。winboat通过容器运行Windows，再通过RDP协议将Windows原生应用传送到Linux界面。

因此，理论上只要在容器内的Windows安装并连接VPN，再使用winboat使用Windows原生服务，也就达到了既定需求。但为什么说理论上，因为Windwos连接VPN后，VPN把局域网通信也给屏蔽了，winboat API也就失效了。

如果能在连接VPN后，运行脚本或者其他任何方式，保证局域网通信正常，那么应该就可以了，后续有时间再测试下。

### 开发环境
开发环境配置就见仁见智了，记得git clone之前的dotfiles到本地。不过国内开发怎么能缺少镜像站呢，呵呵。😅
常用的镜像站：
- [阿里云](https://developer.aliyun.com/mirror/)
- [中科大](https://mirrors.ustc.edu.cn/)
- [清华](https://mirrors.tuna.tsinghua.edu.cn/)
- [docker镜像站-南大](https://doc.nju.edu.cn/books/e1654)
- [docker镜像站-github](https://github.com/dongyubin/DockerHub)

### KDE插件
不得不说，默认的KDE确实有一点不那么美观。🤔
推荐使用的几个插件：
- [KdeControlStation](https://store.kde.org/p/2196105): 综合控制面板，包括网络/蓝牙等
- [Kurve - Audio Visualizer](https://store.kde.org/p/2299506): 音频可视化
- [Panel Colorizer](https://store.kde.org/p/2130967)：美化dock
- [Advanced Weather Widget](https://store.kde.org/p/2349879)：更好的天气组件

> 有点遗憾，似乎没有什么比较好用的万年历组件😓

Links:
[1]: [ImortExportTools NG](https://addons.thunderbird.net/zh-CN/thunderbird/addon/importexporttools-ng/?src=hp-dl-mostpopular)
[2]: 最简单方法是从Windows下拷贝过来，C:/Windows/Fonts/msyh*.ttc
[3]: 一种旨在Linux原生使用Windows应用的软件。See more [winboat](https://winboat.app/).
