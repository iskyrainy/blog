---
title: 构建容器
category: Tech
tag: Docker
date: 2025-07-08T00:32:44+08:00
---

# 构建容器
在编程或部署应用程序时，处理*环境*往往是一项颇具挑战性的任务。容器技术为这一问题提供了无缝的解决方案。容器就像轻量级虚拟机一样，将应用程序运行所需的环境封装起来，这样你就可以只专注于所需的依赖项和服务。本文将带你一步步构建 Docker 镜像。

## 1 Docker 基础
在开始构建 Docker 镜像之前，你需要在服务器上安装 Docker。以下是 CentOS 的安装步骤：
1. 在线安装：
   ```bash
    yum update
    yum install -y docker-ce docker-ce-cli containerd.io
   ```
2. 离线<sup>[1]</sup>安装：示例安装的是 `28.3.1` 版本，请替换为你想要安装的版本
   ```bash
    wget https://download.docker.com/linux/static/stable/x86_64/docker-28.3.1.tgz
    tar xzf docker-28.3.1.tgz
    cp -f docker/* /usr/bin/
    echo "
    [Unit]
    Description=Docker Application Container Engine
    Documentation=https://docs.docker.com
    After=network-online.target firewalld.service
    Wants=network-online.target

    [Service]
    Type=notify
    ExecStart=/usr/bin/dockerd
    ExecReload=/bin/kill -s HUP $MAINPID
    LimitNOFILE=infinity
    LimitNPROC=infinity
    TimeoutStartSec=0
    Delegate=yes
    KillMode=process
    Restart=on-failure
    StartLimitBurst=3
    StartLimitInterval=60s

    [Install]
    WantedBy=multi-user.target
    " > /etc/systemd/system/docker.service

    chmod +x /etc/systemd/system/docker.service
    systemctl daemon-reload
    systemctl start docker
    systemctl enable docker.service
   ```

## 2 构建镜像
通过 Dockerfile 构建一个 docker 镜像。
如下：
```Dockerfile
# build a new image from base image, alpine is a very slim linux base os, make the new image takes less space.
FROM alpine:3.22
# some attach info about image
LABEL author="gdhvxcj"
# set all commands' work dir
WORKDIR /app
# copy file into image
COPY target/test.jar /app/test.jar
# some commands to build work environment, here only install jre for less space
RUN apk add --no-cache openjdk21-jre
# expose ports
EXPOSE 8900
# run command when container start running, the new images' CMD will cover base images' CMD
CMD java -jar test.jar
```

## 3 运行容器
加载镜像并运行一个容器：
```bash
# save image to tar
docker save -o test.jar test:latest
# load image from tar
docker load -i test.jar
# run a container
docker run -it -d --restart=always -p 8900:8900 -v /app/log:/app/log --cpus=4 --memory=4g --name test_container test:latest
```

## 4 容器与虚拟机的区别

虽然 Docker 容器和传统虚拟机（VM）都为应用程序提供了隔离的运行环境，但它们在**架构**、**隔离性**、**资源访问**和**可移植性**方面存在显著差异。

| 方面                     | 虚拟机（VM）                                                      | Docker 容器                                                        |
|--------------------------|-------------------------------------------------------------------|--------------------------------------------------------------------|
| **虚拟化层**             | 基于 Hypervisor（如 KVM、VMware），每个 VM 运行完整的客户机 OS    | OS 级别（Linux namespaces 与 cgroups）；共享宿主内核               |
| **隔离性**               | 硬件强制隔离；每个 VM 运行自己的内核                              | 进程级别；PID、NET、MNT、IPC、UTS 和 USER 命名空间                 |
| **启动时间**             | 分钟级                                                            | 毫秒到秒级                                                         |
| **镜像大小**             | 吉字节（完整 OS 镜像）                                            | 兆字节（仅包含必要的层）                                           |
| **资源开销**             | 较高——客户机 OS 占用 CPU、内存和磁盘                              | 较低——无客户机内核，运行时占用极小                                 |
| **OS 兼容性**            | 可同时承载不同的 OS 系列（例如在 Linux 上运行 Windows）           | 与宿主相同的内核系列（大多仅限 Linux）                             |
| **I/O 性能**             | 通过虚拟设备（vNIC、vDisk）进行中介                               | 接近原生；可直接访问宿主设备，并可选施加限制                       |
| **更新与管理**           | 每个 VM 需进行完整的 OS 补丁更新                                  | 分层镜像；复用公共层，更新和回滚快速                               |
| **可移植性**             | 镜像庞大；迁移较慢                                                | 轻量级仓库；在任何 Docker 主机上行为一致                           |

### 4.1 何时选择虚拟机

- **混合 OS 环境**：需要在 Linux 宿主上运行 Windows、BSD 或其他非 Linux 客户机。  
- **最大隔离性**：需要严格硬件隔离的高安全性、多租户用例。  
- **遗留应用程序**：依赖自定义内核或需要完整 OS 控制权的应用。

### 4.2 何时选择容器

- **微服务**：可以独立构建、交付和扩展的小型单一用途服务。  
- **CI/CD 流水线**：从开发到生产都可复现的构建环境。  
- **资源效率**：以极小的开销和闪电般的启动速度最大化宿主利用率。  
- **DevOps 工作流**：充分利用镜像分层、版本化仓库以及 Compose 或 Kubernetes 等编排工具。

### 4.3 未来趋势
- **容器与虚拟机的融合**  
  随着安全问题的日益突出，混合方案正在兴起，即在轻量级 VM 中运行容器（如 Kata Containers、Firecracker），以将强隔离性与容器的敏捷性相结合。
- **Unikernel 与 MicroVM**  
  像 AWS Firecracker（MicroVM）和 MirageOS（Unikernel）这样的项目将客户机 OS 精简到最低限度，提供毫秒级启动和最小攻击面，非常适合无服务器和边缘工作负载。
- **无服务器与函数沙箱**  
  除了长时间运行的容器之外，无服务器平台正朝着通过 microVM 或安全容器沙箱实现隔离的方向发展，从而实现细粒度计费和缩容至零。
- **声明式基础设施与 GitOps**  
  基础设施即代码工具（Terraform、Pulumi）和 GitOps 工作流越来越多地以统一的、版本控制的方式同时管理容器集群和 VM 集群。
- **边缘与 IoT 部署**  
  对轻量级占用的需求正在推动针对边缘设备优化的容器运行时，而 microVM 则在多租户 IoT 网关上确保隔离性。
- **设计即安全**  
  运行时加固（无根容器、seccomp、gVisor）、镜像来源验证（in-toto、Sigstore）和供应链管控正成为 VM 和容器流水线的标准配置。

综合来看，这些趋势指向一个 **VM**、**容器**、**microVM** 和 **unikernel** 共存的生态系统——每种技术都会被用于那些需要在隔离性、性能与可管理性之间取得恰当平衡的工作负载。

## 5 容器最佳实践
在使用 Docker 容器（或任何符合 OCI 标准的运行时）时，遵循以下最佳实践将帮助你构建更可靠、更安全、更易维护的镜像和部署：

1. **每个容器一个进程**  
   - 在前台运行单个主进程。  
   - 如果需要边车（日志收集器、代理），请使用单独的容器，并通过 Docker Compose 或 Kubernetes 进行协调。
2. **使用最小基础镜像**  
   - 选择精简或“distroless”镜像（如 `alpine`、`gcr.io/distroless/base`），以减少攻击面和镜像大小。  
   - 利用多阶段构建，在一个阶段编译应用程序，仅将运行时产物复制到最终阶段。
3. **固定依赖项与镜像标签**  
   - 为 OS 包和语言运行时指定精确版本（`apk add openjdk21-jre=21.0.0-r0`）。  
   - 在生产环境中避免使用 `latest` 标签——使用不可变标签或摘要（`alpine:3.22` → `alpine@sha256:…`）。
4. **智能分层 Dockerfile**  
   - 将频繁变化的命令（应用程序代码）放在靠近底部的位置，以便缓存最大化重建速度。  
   - 将长期稳定的依赖项（系统库、语言运行时）放在靠前的层中。
5. **限制容器权限**  
   - 切勿以 root 运行；创建非 root 用户并切换过去（`RUN addgroup app && adduser -S -G app app`）。  
   - 启用 Docker 的用户命名空间重映射，或使用安全配置文件（AppArmor、SELinux）。
6. **设置资源约束**  
   - 定义 CPU、内存和 I/O 限制，防止容器独占宿主资源（`--cpus`、`--memory`、`--blkio-weight`）。  
   - 在 Kubernetes 中，为每个 Pod 规格使用 `requests` 和 `limits`。


[1]: [Docker 静态包](https://download.docker.com/linux/static/stable/)