---
title: Debian13에서 Nvidia Wayland 시작 치명적 오류 수정하기
category: Tech
tag: Linux
date: 2026-04-21T23:21:19+08:00
---


작년에 나는 Windows와 Ubuntu가 설치된 듀얼 OS PC를 사용하고 있었다. Windows에서 Nvidia 드라이버를 업데이트했더니 Ubuntu가 망가졌다. Ubuntu를 시작하려고 해도 검은 화면만 나왔다.

어제는 Debian 13에서 Stardew Valley를 스트리밍하고 싶었는데 하드웨어 인코더가 없다는 것을 발견했다. 그래서 새 NVIDIA 드라이버와 하드웨어 코딩 가속 관련 패키지들을 설치했다.

**재부팅했더니 또 검은 화면이 나온다.** 멋지군.

다시 재시작해서 복구 모드를 선택하고, 프로토콜을 Wayland에서 x11로 변경했더니 시스템이 잘 작동하는 것을 확인했다. 그래서 TTY로 들어가서 명령어로 Wayland를 시작해 더 자세한 내용을 확인했다.
```bash
$ dbus-run-session -- startplasma-wayland 2&>1 log.log
```

`log.log`에 따르면, 핵심 오류는 매우 명확하다:
```log
No backend specified, automatically choosing drm
kwin_wayland_drm: No suitable DRM devices have been found
```

이것은 KWin Wayland 컴포지터가 NVIDIA 그래픽 카드의 DRM(Direct Rendering Manager) 장치를 찾을 수 없다는 것을 의미한다. 이것은 Wayland에서 NVIDIA 폐쇄형 소스 드라이버의 가장 흔한 오류다. NVIDIA 망할 놈.

먼저 DRM 장치가 존재하는지 확인한다.
```bash
$ ls -la /dev/dri/
total 0
drwxr-xr-x   3 root root        100 .
drwxr-xr-x  20 root root       3780 ..
drwxr-xr-x   2 root root         80 by-path
crw-rw----+  1 root video  226,   0 card0
crw-rw----+  1 root render 226, 128 renderD128
```

그런 다음 DRM 커널 매개변수가 적용되어 있는지 확인한다.
```bash
$ cat /sys/module/nvidia_drm/parameters/modeset
N
```

`modeset=N`은 DRM 모드가 적용되지 않았다는 뜻이며, 따라서 Wayland가 제대로 작동할 수 없다. 다음을 실행한다:
```bash
$ sudo rmmod nvidia_drm nvidia_modeset nvidia_uvm nvidia
$ sudo modprobe nvidia_drm modeset=1
$ sudo modprobe nvidia_modeset
$ sudo modprobe nvidia_uvm

$ cat /sys/module/nvidia_drm/parameters/modeset
Y
```

이제 `modeset=Y`이므로, 명령줄에서 Wayland를 다시 시작해 본다. 작동한다면 `modeset`을 영구 설정에 기록하기만 하면 된다.
```bash
$ dbus-run-session -- startplasma-wayland
```

**드디어 작동한다고 생각했다.**

설정을 설정 파일에 작성한다:
```bash
$ sudo vim /etc/modprobe.d/nvidia-drm-modeset.conf
options nvidia_drm modeset=1

$ sudo vim /etc/modprobe.d/nvidia-drm-fbdev.conf
options nvidia_drm fbdev=1

$ sudo update-initramfs -u
$ reboot
```

Linux에서 Nvidia를 사용하는 것은 정말 끔찍한 경험이다.
> AMD YES