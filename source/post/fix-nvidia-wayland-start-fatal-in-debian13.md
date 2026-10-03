---
title: Fix Nvidia Wayland Start Fatal In Debian13
category: Tech
tag: Linux
date: 2026-04-21T23:21:19+08:00
---


Last year, I had a double-OS PC which was installed with Windows and Ubuntu. I updated Nvidia driver in Windows and Ubuntu broken. Tried get start Ubuntu and only get a black.

Last day, I want to stream Stardew Valley in Debian 13 and found here is no hardware encoder. So I installed the new NVIDIA drivers and hardware coding acceleration related packages.

**REBOOT AND GET A BLACK SCREEN AGAIN.** Cool.

Restart again and choose the restore mode, change protocol from Wayland to x11, and I found system works well. So I go into TTY and start Wayland from command to see more details.
```bash
$ dbus-run-session -- startplasma-wayland 2&>1 log.log
```

According to the `log.log`, the core error is very clear::
```log
No backend specified, automatically choosing drm
kwin_wayland_drm: No suitable DRM devices have been found
```

This indicates that the KWin Wayland compositor cannot find the NVIDIA graphics card's DRM (Direct Rendering Manager) device. This is the most common fault of NVIDIA's closed-source drivers under Wayland. Fuck NVIDIA.

First, check if the DRM device exists.
```bash
$ ls -la /dev/dri/
total 0
drwxr-xr-x   3 root root        100 .
drwxr-xr-x  20 root root       3780 ..
drwxr-xr-x   2 root root         80 by-path
crw-rw----+  1 root video  226,   0 card0
crw-rw----+  1 root render 226, 128 renderD128
```

Then check if the DRM kernel parameters are in effect.
```bash
$ cat /sys/module/nvidia_drm/parameters/modeset
N
```

`modeset=N` means DRM mode not in effect, so that Wayland cannot work well. Run follow:
```bash
$ sudo rmmod nvidia_drm nvidia_modeset nvidia_uvm nvidia
$ sudo modprobe nvidia_drm modeset=1
$ sudo modprobe nvidia_modeset
$ sudo modprobe nvidia_uvm

$ cat /sys/module/nvidia_drm/parameters/modeset
Y
```

Now `modeset=Y`, try to start Wayland from command line again. If it works we just need to dump `modeset` to permanent configuration. 
```bash
$ dbus-run-session -- startplasma-wayland
```

**THINKS IT WORKS FINALLY.**

Write config into config file:
```bash
$ sudo vim /etc/modprobe.d/nvidia-drm-modeset.conf
options nvidia_drm modeset=1

$ sudo vim /etc/modprobe.d/nvidia-drm-fbdev.conf
options nvidia_drm fbdev=1

$ sudo update-initramfs -u
$ reboot
```

Using Nvidia on Linux is really a terrible experience.
> AMD YES
