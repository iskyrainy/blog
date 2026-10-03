---
title: 修复 Debian 13 中 Nvidia Wayland 启动致命错误
category: Tech
tag: Linux
date: 2026-04-21T23:21:19+08:00
---


去年，我有一台装了 Windows 和 Ubuntu 的双系统电脑。我在 Windows 里更新了 Nvidia 驱动，结果 Ubuntu 就挂了。尝试启动 Ubuntu，只得到一个黑屏。

昨天，我想在 Debian 13 里直播《星露谷物语》，发现这里没有硬件编码器。于是我安装了新的 NVIDIA 驱动以及硬件编码加速相关的软件包。

**重启后再次黑屏。** 真棒。

再次重启并选择恢复模式，把协议从 Wayland 改成 x11，然后我发现系统运行正常。于是我进入 TTY，从命令行启动 Wayland，看看更详细的报错。
```bash
$ dbus-run-session -- startplasma-wayland 2&>1 log.log
```

根据 `log.log`，核心错误非常明确：
```log
No backend specified, automatically choosing drm
kwin_wayland_drm: No suitable DRM devices have been found
```

这说明 KWin Wayland 合成器找不到 NVIDIA 显卡的 DRM（Direct Rendering Manager）设备。这是 NVIDIA 闭源驱动在 Wayland 下最常见的故障。去他妈的 NVIDIA。

首先，检查 DRM 设备是否存在。
```bash
$ ls -la /dev/dri/
total 0
drwxr-xr-x   3 root root        100 .
drwxr-xr-x  20 root root       3780 ..
drwxr-xr-x   2 root root         80 by-path
crw-rw----+  1 root video  226,   0 card0
crw-rw----+  1 root render 226, 128 renderD128
```

然后检查 DRM 内核参数是否生效。
```bash
$ cat /sys/module/nvidia_drm/parameters/modeset
N
```

`modeset=N` 表示 DRM 模式没有生效，因此 Wayland 无法正常工作。执行以下命令：
```bash
$ sudo rmmod nvidia_drm nvidia_modeset nvidia_uvm nvidia
$ sudo modprobe nvidia_drm modeset=1
$ sudo modprobe nvidia_modeset
$ sudo modprobe nvidia_uvm

$ cat /sys/module/nvidia_drm/parameters/modeset
Y
```

现在 `modeset=Y`，再次尝试从命令行启动 Wayland。如果成功了，我们只需要把 `modeset` 写入永久配置。
```bash
$ dbus-run-session -- startplasma-wayland
```

**以为终于成功了。**

把配置写入配置文件：
```bash
$ sudo vim /etc/modprobe.d/nvidia-drm-modeset.conf
options nvidia_drm modeset=1

$ sudo vim /etc/modprobe.d/nvidia-drm-fbdev.conf
options nvidia_drm fbdev=1

$ sudo update-initramfs -u
$ reboot
```

在 Linux 上用 Nvidia 真是一种糟糕的体验。
> AMD YES