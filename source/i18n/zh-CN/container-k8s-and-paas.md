---
title: 容器、Kubernetes 与 PaaS
category: Tech
tag: Linux
date: 2026-02-23T00:23:04+08:00
---


## 第一部分 容器技术
容器带来了什么？我相信任何曾经部署或维护过服务器的人，都曾被无休止的依赖冲突、环境错误以及各种不兼容问题逼到绝望。

容器彻底解决了这个问题。容器技术将应用与底层环境隔离开来。基于容器的容器编排技术将部署、生产和运维提升到了一个全新的水平。

容器并非凭空出现的黑科技，它本质上是对 Linux 内核能力的终极封装。早在 Docker 之前，Linux 就已经有了用于隔离的工具<sup>[1]</sup>：
- `chroot`<sup>[2]</sup>
- `Namespaces`<sup>[3]</sup>
- `Cgroups`<sup>[4]</sup>

那么容器的天才之处在哪里？容器是对应用进程的标准化封装。至于这种封装使用的是*Linux 的 cgroup namespace* 技术还是虚拟化 *hypervisor* 技术，并不是关键。关键在于目标：容器是为**应用标准化**而创建的。
容器将应用及其运行所需的全部库、配置和环境变量打包成一个只读文件系统。

学习技术需要了解它的历史。一些营销号散布谣言称 Kubernetes 已经“抛弃”了 Docker，Docker 已彻底失宠。只有理解容器技术的发展历程，才能真正理解 Kubernetes“抛弃”Docker 意味着什么。

容器技术的发展始于 2013 年 Docker 的出现。它通过镜像打包机制解决了经典的“在我机器上能跑”问题，随后引发了由 Docker Swarm、Apache Mesos 和 Google 开源的 Kubernetes（K8s）主导的“容器编排战争”。随着 K8s 凭借其卓越的设计赢得这场战争<sup>[5]</sup>并成为事实标准，Docker 将其核心运行时 containerd 捐赠给 CNCF 以推动行业标准化，将底层运行时与上层工具链解耦。与此同时，为了追求更高的安全性和去中心化，诸如 Podman 这样无需 root 权限的无守护进程替代方案相继涌现，标志着容器生态从一家独大转向符合 OCI 标准的多元化、轻量化时代。

回顾整个容器发展史后，熟悉容器的人就会明白 Kubernetes“抛弃”了 Docker 的什么。Kubernetes 放弃了对 Dockershim 的支持，意味着它不再通过 Dockershim 调用 Docker、再由 Docker 调用 containerd，而是直接调用 containerd。

> 为避免各种概念之间的混淆，这里提供了整个容器运行时体系的分层图。

![Container-System](https://i.postimg.cc/y8SPzBr0/Container-System.png)

## 第二部分 容器标准：OCI
早期，Docker 试图将网络、存储、编排等一切功能都集成到一个庞大的单体守护进程中。这引起了社区的不满，尤其是 CoreOS。2014 年，CoreOS 推出了 rkt（Rocket），并提出了 AppC 规范。为了避免容器生态陷入碎片化，**OCI**<sup>[6]</sup>（Open Container Initiative，开放容器倡议）于 2015 年在 Linux 基金会的领导下正式成立。

OCI 目前包含三个规范：
- 运行时规范（runtime-spec）：定义了容器镜像的结构，确保镜像能够被各种工具识别和管理
- 镜像规范（image-spec）：定义了容器镜像的分发方式，确保镜像能够通过标准化的 HTTP API 与镜像仓库交互
- 分发规范（distribution-spec）：定义了容器的操作标准，确保容器生命周期在容器运行时能够被统一执行和管理
![OCI](https://i.postimg.cc/13zH7wpf/OCI.png)

### 2.1 runtime-spec
运行时规范概述了如何运行一个在磁盘上解包后的“文件系统包（filesystem bundle）”。从高层来看，OCI 实现会先下载一个 OCI 镜像，然后将该镜像解包为 OCI 运行时文件系统包。此时，OCI 运行时包将由 OCI 运行时来运行。

该规范规定：
- config：`config.json` 配置文件描述了容器的进程、挂载、钩子、资源限制等信息
- env：保持容器运行环境一致，将镜像解包为运行时文件系统包
- lifecycle：声明容器从 `create` 到 `delete` 的生命周期

Docker 将其最底层的容器创建代码捐赠给了 OCI —— `runc`（之前是 `libcontainer`），它成为了 OCI 运行时规范的参考实现。

### 2.2 image-spec
该规范的目标是支持创建可互操作的工具，用于构建、传输和准备要运行的容器镜像。
![image-spec1](https://github.com/opencontainers/image-spec/blob/main/img/build-diagram.png?raw=true)
![image-spec2](https://github.com/opencontainers/image-spec/blob/main/img/run-diagram.png?raw=true)

镜像规范规定了镜像的结构：
- `image manifest`
- `image index`
- `filesystem layers`
- `configuration`

### 2.3 distribution-spec
分发规范确保不同的仓库和客户端能够使用统一的 API 进行镜像分发。这使得仓库既可以是公共仓库（Docker Hub 等），也可以是私有仓库（Harbor 等）。客户端可以使用规范中概述的 HTTP 请求来上传或下载镜像。
![distribution-spec](https://i.postimg.cc/nrcjVYFy/OCI-Distribution-spec.png)

## 第三部分 Kubernetes
下图展示了 Kubernetes 集群各部分之间的关系：
![kubernetes-architecture](https://www.redhat.com/rhdc/managed-files/kubernetes_diagram-v3-770x717_0.svg)

> [Kubernetes 文档](kubernetes.io/docs/concepts/architecture/)中有关于各组件的更多信息。

接下来，我们通过 `minikube`<sup>[7]</sup> 创建一个 Kubernetes 集群。

这里我建议从 `docker` 驱动<sup>[8]</sup>开始。
```bash
# with a proxy for speed up
$ minikube start --driver=docker --docker-env HTTP_PROXY=http://127.0.0.1:10808 --docker-env HTTPS_PROXY=https://127.0.0.1:10808
```
在 `start` 运行完成后，我们可以通过 `sudo docker ps` 看到集群容器：
```bash
$ sudo docker ps
CONTAINER ID   IMAGE                                 COMMAND                  CREATED        STATUS        PORTS                                                                                                                                  NAMES
ca7632420dcd   gcr.io/k8s-minikube/kicbase:v0.0.50   "/usr/local/bin/entr…"   22 hours ago   Up 22 hours   127.0.0.1:32783->22/tcp, 127.0.0.1:32784->2376/tcp, 127.0.0.1:32785->5000/tcp, 127.0.0.1:32786->8443/tcp, 127.0.0.1:32787->32443/tcp   minikube
```

所有集群组件都安装在容器 `b08f695f77b6` 中，让我们进去看看：
```bash
$ sudo docker exec -it ca bash
root@minikube:/# docker ps
CONTAINER ID   IMAGE                          COMMAND                  CREATED          STATUS          PORTS     NAMES
2b13c3ba6bfc   6e38f40d628d                   "/storage-provisioner"   12 minutes ago   Up 12 minutes             k8s_storage-provisioner_storage-provisioner_kube-system_40bbe55a-f2c5-4437-a25c-ab1480fd60ba_3
edd148893e7d   6521110cdb01                   "/usr/local/bin/kube…"   12 minutes ago   Up 12 minutes             k8s_kube-proxy_kube-proxy-z62pd_kube-system_a8f05639-7a9a-4223-bf6e-ea853a1e98f8_1
7ba597ff8721   registry.k8s.io/pause:3.10.1   "/pause"                 12 minutes ago   Up 12 minutes             k8s_POD_kube-proxy-z62pd_kube-system_a8f05639-7a9a-4223-bf6e-ea853a1e98f8_1
a0691f34fce7   8d7002962c48                   "kube-controller-man…"   12 minutes ago   Up 12 minutes             k8s_kube-controller-manager_kube-controller-manager-minikube_kube-system_740363cf4388c2d0df59fc97f96b889c_1
50ff889197dc   5f2a969bc7a4                   "kube-scheduler --au…"   12 minutes ago   Up 12 minutes             k8s_kube-scheduler_kube-scheduler-minikube_kube-system_1c7123a121598343200ffd5b015ca580_1
8ac2d6404f9d   registry.k8s.io/pause:3.10.1   "/pause"                 12 minutes ago   Up 12 minutes             k8s_POD_kube-controller-manager-minikube_kube-system_740363cf4388c2d0df59fc97f96b889c_1
c2fcbd56234d   registry.k8s.io/pause:3.10.1   "/pause"                 12 minutes ago   Up 12 minutes             k8s_POD_kube-scheduler-minikube_kube-system_1c7123a121598343200ffd5b015ca580_1
667608d38640   aa5e3ebc0dfe                   "/coredns -conf /etc…"   13 minutes ago   Up 12 minutes             k8s_coredns_coredns-7d764666f9-fbjqm_kube-system_89cac240-26f4-491b-b577-99a5b16b2c4f_1
af56e73a598f   0a108f718956                   "etcd --advertise-cl…"   13 minutes ago   Up 12 minutes             k8s_etcd_etcd-minikube_kube-system_5ff8e3b06bbaa8cb7ebc2bf531e48a2f_1
1748429ffd9f   6f9eeb0cff98                   "kube-apiserver --ad…"   13 minutes ago   Up 12 minutes             k8s_kube-apiserver_kube-apiserver-minikube_kube-system_a6dc00f40d27725f15407f95751ce5f7_1
26ea893227ad   registry.k8s.io/pause:3.10.1   "/pause"                 13 minutes ago   Up 13 minutes             k8s_POD_storage-provisioner_kube-system_40bbe55a-f2c5-4437-a25c-ab1480fd60ba_1
4d4cd615319b   registry.k8s.io/pause:3.10.1   "/pause"                 13 minutes ago   Up 13 minutes             k8s_POD_coredns-7d764666f9-fbjqm_kube-system_89cac240-26f4-491b-b577-99a5b16b2c4f_1
d3030b3eea90   registry.k8s.io/pause:3.10.1   "/pause"                 13 minutes ago   Up 13 minutes             k8s_POD_etcd-minikube_kube-system_5ff8e3b06bbaa8cb7ebc2bf531e48a2f_1
420d3415b081   registry.k8s.io/pause:3.10.1   "/pause"                 13 minutes ago   Up 13 minutes             k8s_POD_kube-apiserver-minikube_kube-system_a6dc00f40d27725f15407f95751ce5f7_1
```

我们可以看到 `k8s-etcd`、`kube-apiserver`、`k8s_kube-controller-manager`、`k8s_kube-scheduler`、`k8s_kube-proxy` 等组件。所有组件与 [kubernetes-architecture](#part-3-kubernetes) 完全一致。现在，`exit` 退出 k8s 容器，继续操作集群。
```bash
root@minikube:/# exit
exit
$ kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   21h   v1.35.1
```

`minikube` 无法使用本地 docker 镜像，因此我们需要将本地镜像加载到 minikube 内部的 docker 中：
```bash
$ sudo usermod -aG docker $USER && newgrp docker
[iskyrainy@archlinux ~]$ minikube image load nginx:1.29.5

[iskyrainy@archlinux ~]$ exit
exit
$ kubectl create deployment nginx-deployment --image=nginx:1.29.5
deployment.apps/nginx-deployment created
$ kubectl describe deployment/nginx-deployment
Name:                   nginx-deployment
Namespace:              default
CreationTimestamp:      Mon, 02 Mar 2026 22:25:25 +0800
Labels:                 app=nginx-deployment
Annotations:            deployment.kubernetes.io/revision: 1
Selector:               app=nginx-deployment
Replicas:               1 desired | 1 updated | 1 total | 1 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=nginx-deployment
  Containers:
   nginx:
    Image:         nginx:1.29.5
    Port:          <none>
    Host Port:     <none>
    Environment:   <none>
    Mounts:        <none>
  Volumes:         <none>
  Node-Selectors:  <none>
  Tolerations:     <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  <none>
NewReplicaSet:   nginx-deployment-67655586bd (1/1 replicas created)
Events:
  Type    Reason             Age   From                   Message
  ----    ------             ----  ----                   -------
  Normal  ScalingReplicaSet  14s   deployment-controller  Scaled up replica set nginx-deployment-67655586bd from 0 to 1
$ kubectl get pods
NAME                                READY   STATUS    RESTARTS   AGE
nginx-deployment-67655586bd-nn9w4   1/1     Running   0          45s
```

由于集群运行在 docker 容器中，因此我们需要通过创建 service 来暴露服务：
```bash
$ kubectl expose deployment nginx-deployment --type=NodePort --port=80
service/nginx-deployment exposed
$ kubectl get services
NAME               TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
kubernetes         ClusterIP   10.96.0.1       <none>        443/TCP        21h
nginx-deployment   NodePort    10.106.190.24   <none>        80:32323/TCP   9s
[iskyrainy@archlinux ~]$ minikube ip
192.168.49.2
[iskyrainy@archlinux ~]$ curl 192.168.49.2:32323
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>

<p>For online documentation and support please refer to
<a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at
<a href="http://nginx.com/">nginx.com</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
```

目前，`deployment/nginx-deployment` 只有一个 pod 在运行并提供服务。当流量增加时，我们需要扩展应用以满足用户需求。*扩缩容（Scaling）*是通过更改 Deployment 中的副本数量来实现的。
```bash
# delete service/nginx-deployment created before, then create a new service which uses `LoadBalancer`
$ kubectl delete service/nginx-deployment
service "nginx-deployment" deleted from default namespace
$ kubectl expose deployment nginx-deployment --type=LoadBalancer --port=80
service/nginx-deployment exposed
$ kubectl scale deployments/nginx-deployment --replicas=4
deployment.apps/nginx-deployment scaled
$ kubectl get deployments
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   4/4     4            4           30m
$ kubectl get pods
NAME                                READY   STATUS    RESTARTS   AGE
nginx-deployment-67655586bd-647x6   1/1     Running   0          14s
nginx-deployment-67655586bd-nn9w4   1/1     Running   0          30m
nginx-deployment-67655586bd-qtbtm   1/1     Running   0          14s
nginx-deployment-67655586bd-xs78m   1/1     Running   0          14s
```

## 第四部分 PaaS 与 IaaS
> 试想一下：OpenStack 可以将裸金属硬件资源虚拟化，进行划分、分配和组装，形成基础服务（虚拟机），并按需交付给客户。同样，Kubernetes 可以部署在裸金属上，将硬件资源打包成容器并交付给用户。对客户而言，虚拟机和容器在使用上并没有本质区别。那么，云服务提供商是否仍有必要同时实现 IaaS（OpenStack）和 PaaS（Kubernetes）？

从表面上看，用户确实只是想要“计算资源”：一个运行代码的 shell。但对云服务提供商而言，IaaS（以 OpenStack 为代表）和 PaaS（以 Kubernetes 为代表）并非互相排斥的竞争者。

云服务提供商仍然同时保留两者的主要原因基于以下四个维度：
- *安全隔离*：容器<sup>[9]</sup>是“软隔离”，虚拟机是“硬隔离”。容器共享宿主机的**内核**，因此*容器逃逸*可能会危及同一物理机上其他用户的数据。而虚拟机拥有自己独立的内核。
- *分工不同*：IaaS 解决的是“物理资源的变现”；PaaS 解决的是“应用生命周期”。
- *多样化工作负载的兼容性*：并非所有业务都能“容器化”。对于一些遗留应用和有状态服务，其架构师仍然倾向于将它们运行在 IaaS 甚至裸金属上，以获得更稳定的 IO 性能。
- *维护成本*：物理机的 CPU 和内存规格差异很大。如果直接由 Kubernetes 管理，调度器将变得极其复杂。

目前，IaaS 和 PaaS 对云服务提供商而言都是重要且基础的部分。

Links:
[1]: Linux kernel API. But here has some difference between *LXC* and *Docker*, see more [*Difference between LXC and libcontainer*](https://stackoverflow.com/questions/34152365/difference-between-lxc-and-libcontainer)
[2]: An utility used to change the process's root dir to create a new logical environment separate from OS root dir. See more [*Chroot*](https://wiki.gentoo.org/wiki/Chroot)
[3]: Linux Namespace, an encapsulation isolation of global system resources. See more [*namespaces(7) — Linux manual page*](https://man7.org/linux/man-pages/man7/namespaces.7.html)
[4]: Allow processes to be organized into hierarchical groups whose usage of various types of resources can then be limited and monitored. See more [*cgroups(7) — Linux manual page*](https://man7.org/linux/man-pages/man7/cgroups.7.html), [*Linux Cgroups 01*](https://segmentfault.com/a/1190000007241437), [*Linux Cgroup 02*](https://segmentfault.com/a/1190000007241437)
[5]: See the blog [*How Kubernetes Won the Container Orchestration War*](https://www.izumanetworks.com/blog/how-k8s-won-the-orchestration-war/)
[6]: See the details in [OCI](https://github.com/opencontainers)
[7]: `minikube` quickly sets up a local Kubernetes cluster on macOS, Linux, and Windows. See more [minikube doc](https://minikube.sigs.k8s.io/docs/)
[8]: See `minikube` driver support in [Drivers](https://minikube.sigs.k8s.io/docs/drivers/)
[9]: Kata Container is one type container which has more security, it essentially extremely lightweight virtual machines. See more [Kata container](https://katacontainers.io/)