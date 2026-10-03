---
title: Debian13でNvidia Wayland起動時の致命的エラーを修正する
category: Tech
tag: Linux
date: 2026-04-21T23:21:19+08:00
---


昨年、私はWindowsとUbuntuがインストールされたデュアルOSのPCを持っていました。WindowsでNvidiaドライバーを更新したところ、Ubuntuが壊れてしまいました。Ubuntuを起動しようとしても、黒い画面になるだけでした。

先日、Debian 13でStardew Valleyを配信しようとしたところ、ハードウェアエンコーダーがないことに気づきました。そこで、新しいNVIDIAドライバーとハードウェアエンコード加速関連のパッケージをインストールしました。

**再起動したらまた黒い画面。** 最高。

もう一度再起動してリカバリモードを選択し、プロトコルをWaylandからx11に変更すると、システムは正常に動作しました。そこでTTYに入り、コマンドからWaylandを起動して詳細を確認することにしました。
```bash
$ dbus-run-session -- startplasma-wayland 2&>1 log.log
```

`log.log`によると、核心的なエラーは非常に明確です：
```log
No backend specified, automatically choosing drm
kwin_wayland_drm: No suitable DRM devices have been found
```

これは、KWin WaylandコンポジタがNVIDIAグラフィックスカードのDRM（Direct Rendering Manager）デバイスを見つけられないことを示しています。これはWaylandにおけるNVIDIAのクローズドソースドライバーの最も一般的な障害です。NVIDIAくたばれ。

まず、DRMデバイスが存在するか確認します。
```bash
$ ls -la /dev/dri/
total 0
drwxr-xr-x   3 root root        100 .
drwxr-xr-x  20 root root       3780 ..
drwxr-xr-x   2 root root         80 by-path
crw-rw----+  1 root video  226,   0 card0
crw-rw----+  1 root render 226, 128 renderD128
```

次に、DRMカーネルパラメータが有効になっているか確認します。
```bash
$ cat /sys/module/nvidia_drm/parameters/modeset
N
```

`modeset=N`はDRMモードが有効になっていないことを意味するため、Waylandは正常に動作できません。以下を実行します：
```bash
$ sudo rmmod nvidia_drm nvidia_modeset nvidia_uvm nvidia
$ sudo modprobe nvidia_drm modeset=1
$ sudo modprobe nvidia_modeset
$ sudo modprobe nvidia_uvm

$ cat /sys/module/nvidia_drm/parameters/modeset
Y
```

これで`modeset=Y`になりました。もう一度コマンドラインからWaylandを起動してみます。うまくいけば、`modeset`を永続的な設定に書き込むだけです。
```bash
$ dbus-run-session -- startplasma-wayland
```

**ついに動いたと思う。**

設定を設定ファイルに書き込みます：
```bash
$ sudo vim /etc/modprobe.d/nvidia-drm-modeset.conf
options nvidia_drm modeset=1

$ sudo vim /etc/modprobe.d/nvidia-drm-fbdev.conf
options nvidia_drm fbdev=1

$ sudo update-initramfs -u
$ reboot
```

LinuxでNvidiaを使うのは本当にひどい体験です。
> AMD YES