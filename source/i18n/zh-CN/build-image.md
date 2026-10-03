---
title: 构建容器
category: Tech
tag: Docker
date: 2025-07-08T00:32:44+08:00
---

# 构建容器
在编程或部署应用程序时，处理*环境*往往是一项颇具挑战的任务。容器技术为这一问题提供了无缝的解决方案。容器就像轻量级的虚拟机，封装了应用程序运行所需的环境，因此你可以只专注于所需的依赖项和服务。本文将带你逐步完成构建 Docker 镜像的过程。

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
从 Dockerfile 构建 Docker 镜像。
如下所示：
```Dockerfile
# 基于基础镜像构建新镜像，alpine 是一个非常精简的 Linux 基础操作系统，能让新镜像占用更少的空间。
FROM alpine:3.22
# 关于镜像的一些附加信息
LABEL author="gdhvxcj"
# 设置所有命令的工作目录
WORKDIR /app
# 将文件复制到镜像中
COPY target/test.jar /app/test.jar
# 一些用于构建工作环境的命令，这里只安装 jre 以减小空间占用
RUN apk add --no-cache openjdk21-jre
# 暴露端口
EXPOSE 8900
# 容器启动时运行的命令，新镜像的 CMD 会覆盖基础镜像的 CMD
CMD java -jar test.jar
```

## 3 运行容器
加载镜像并运行容器：
```bash
# 将镜像保存为 tar 文件
docker save -o test.jar test:latest
# 从 tar 文件加载镜像
docker load -i test.jar
# 运行容器
docker run -it -d --restart=always -p 8900:8900 -v /app/log:/app/log --cpus=4 --memory=4g --name test_container test:latest
```

## 4 容器与虚拟机的区别

虽然 Docker 容器和传统虚拟机（VM）都为应用程序提供隔离的环境，但它们在**架构**、**隔离性**、**资源访问**和**可移植性**方面存在显著差异。

| 方面                     | 虚拟机（VM）                                                      | Docker 容器                                                        |
|--------------------------|-------------------------------------------------------------------|--------------------------------------------------------------------|
| **虚拟化层**             | 基于 Hypervisor（如 KVM、VMware），每个 VM 都有完整的客户机操作系统 | 操作系统级（Linux namespaces 和 cgroups）；共享宿主内核            |
| **隔离性**               | 硬件强制隔离；每个 VM 运行自己的内核                              | 进程级隔离；PID、NET、MNT、IPC、UTS 和 USER namespaces             |
| **启动时间**             | 分钟级                                                            | 毫秒到秒级                                                         |
| **镜像大小**             | 吉字节（完整操作系统镜像）                                        | 兆字节（仅包含必要的层）                                           |
| **资源开销**             | 较高——客户机操作系统占用 CPU、内存和磁盘                          | 较低——无客户机内核，运行时占用极小                                 |
| **操作系统兼容性**       | 可同时承载不同的操作系统家族（例如在 Linux 上运行 Windows）       | 与宿主相同的内核家族（大多仅支持 Linux）                           |
| **I/O 性能**             | 通过虚拟设备（vNIC、vDisk）进行中介                               | 接近原生；可直接访问宿主设备，并可选限制                           |
| **更新与管理**           | 每个 VM 需进行完整的操作系统打补丁                                | 分层镜像；复用公共层，更新和回滚迅速                               |
| **可移植性**             | 镜像臃肿；迁移较慢                                                 | 轻量级镜像仓库；在任何 Docker 主机上行为一致                       |

### 4.1 何时选择虚拟机

- **混合操作系统环境**：需要在 Linux 宿主上运行 Windows、BSD 或其他非 Linux 客户机。
- **最大隔离性**：需要严格硬件隔离的高安全性、多租户用例。
- **遗留应用程序**：依赖自定义内核或需要完整操作系统控制权的应用。

### 4.2 何时选择容器

- **微服务**：可以独立构建、交付和扩展的小型、单一用途的服务。
- **CI/CD 流水线**：从开发到生产的可复现构建环境。
- **资源效率**：以最小的开销和极快的启动速度最大化宿主利用率。
- **DevOps 工作流**：利用镜像分层、版本化镜像仓库，以及 Compose 或 Kubernetes 等编排工具。

### 4.3 未来趋势
- **容器与虚拟机的融合**
  随着安全问题的日益突出，混合方案正在兴起，将容器运行在轻量级虚拟机内（如 Kata Containers、Firecracker），以融合强隔离性与容器的敏捷性。
- **Unikernel 与 MicroVM**
  像 AWS Firecracker（MicroVM）和 MirageOS（Unikernel）这样的项目将客户机操作系统精简到最低限度，提供毫秒级启动和最小的攻击面，非常适合无服务器和边缘工作负载。
- **无服务器与函数沙箱化**
  除了长时间运行的容器之外，无服务器平台正朝着通过 MicroVM 或安全容器沙箱实现隔离的方向发展，从而实现细粒度计费和缩容至零。
- **声明式基础设施与 GitOps**
  基础设施即代码工具（Terraform、Pulumi）和 GitOps 工作流越来越多地以统一、版本控制的方式管理容器集群和虚拟机集群。
- **边缘与 IoT 部署**
  对轻量级占用空间的需求推动了针对边缘设备优化的容器运行时的发展，而 MicroVM 则可确保多租户 IoT 网关上的隔离性。
- **设计即安全**
  运行时加固（rootless 容器、seccomp、gVisor）、镜像来源追溯（in-toto、Sigstore）和供应链管控正成为虚拟机和容器流水线的标准配置。

这些趋势共同指向一个生态系统，在其中**虚拟机**、**容器**、**MicroVM**和**Unikernel**共存——各自应用于那些需要在隔离性、性能与可管理性之间取得恰当平衡的工作负载。

## 5 容器最佳实践
在使用 Docker 容器（或任何兼容 OCI 的运行时）时，遵循以下最佳实践将帮助你构建更可靠、安全和可维护的镜像与部署：

1. **每个容器一个进程**
   - 在前台运行单个主进程。
   - 如果需要边车容器（日志收集器、代理），请使用单独的容器，并通过 Docker Compose 或 Kubernetes 进行协调。
2. **使用最小基础镜像**
   - 选择精简或“distroless”镜像（如 `alpine`、`gcr.io/distroless/base`），以减少攻击面和镜像大小。
   - 利用多阶段构建，在一个阶段编译应用程序，仅将运行时产物复制到最终阶段。
3. **固定依赖项与镜像标签**
   - 为操作系统包和语言运行时指定确切版本（`apk add openjdk21-jre=21.0.0-r0`）。
   - 在生产环境中避免使用 `latest` 标签——使用不可变标签或摘要（`alpine:3.22` → `alpine@sha256:…`）。
4. **智能地分层 Dockerfile**
   - 将频繁变更的命令（应用程序代码）放在靠底部的位置，以便缓存最大化地提升重建速度。
   - 将长期不变的依赖项（系统库、语言运行时）分离到较早的层中。
5. **限制容器权限**
   - 切勿以 root 身份运行；创建并切换到非 root 用户（`RUN addgroup app && adduser -S -G app app`）。
   - 启用 Docker 的用户命名空间重映射，或使用安全配置文件（AppArmor、SELinux）。
6. **设置资源约束**
   - 定义 CPU、内存和 I/O 限制，防止某个容器独占宿主资源（`--cpus`、`--memory`、`--blkio-weight`）。
   - 在 Kubernetes 中，为每个 Pod 规格使用 `requests` 和 `limits`。


[1]: [Docker 静态包](https://download.docker.com/linux/static/stable/)