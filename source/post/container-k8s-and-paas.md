---
title: Container, Kubernetes and PaaS
category: Tech
tag: Linux
date: 2026-02-23T00:23:04+08:00
---


## Part 1 Container Technology
What do containers bring? I believe anyone who has ever deployed or maintained a server has been driven to despair by endless dependency conflicts, environment errors, and a variety of incompatibility issues.

Containers have completely solved this problem. Container technology isolates the application from the underlying environment. Container-based container orchestration technology elevates deployment, production, and operations to a whole new level.

Containers are not a black technology that appears out of nowhere, they are essentially the ultimate package of Linux kernel capabilities. Long before Docker, Linux already had tools for isolation<sup>[1]</sup>:
- `chroot`<sup>[2]</sup>
- `Namespaces`<sup>[3]</sup>
- `Cgroups`<sup>[4]</sup>

So what is the genius point about containers? A container is a standardized encapsulation of an application process. Whether it uses *Linux's cgroup namespace* technology or virtualization *hypervisor* technology for this encapsulation is not the key point. The key point is the goal: containers are created for **application standardization**.
Containers packages the application and its entire library, configuration, and environment variables required to run into a read-only file system.

Learning technology requires understanding its history. Some marketing accounts spread rumors that Kubernetes has "abandoned" Docker and that Docker has completely fallen out of favor. Only by understanding the development of container technology can one truly understand what it means for Kubernetes to "abandon" Docker.

The development of container technology began with the emergence of Docker in 2013. It solved the classic problem of "running on my machine" through its image packaging mechanism, subsequently sparking a "container orchestration war" led by Docker Swarm, Apache Mesos, and Google's open-source Kubernetes (K8s). As K8s won the war<sup>[5]</sup> with its superior design and became the de facto standard, Docker donated its core runtime, containerd, to the CNCF to promote industry standardization, decoupling the underlying runtime from the upper-layer toolchain. Simultaneously, in pursuit of higher security and decentralization, daemonless alternatives such as Podman, which do not require root privileges, emerged, marking the container ecosystem's transition from a single dominant player to a diversified and lightweight era compliant with OCI standards.

After reviewing the entire history of container development, those familiar with containers will understand what Kubernetes "abandoned" Docker. Kubernetes abandoned support for Dockershim, meaning it will no longer call Docker via Dockeshim and then Docker via containerd; instead, it will directly call containerd.

> To avoid confusion between various concepts, a hierarchical diagram of the entire container runtime system is provided here.

![Container-System](https://i.postimg.cc/y8SPzBr0/Container-System.png)

## Part 2 Container Standard: OCI
In the early days, Docker tried to integrate networking, storage, orchestration, and everything else into a giant monolithic daemon. This caused discontent in the community, especially the CoreOS. In 2014, CoreOS launched  rkt (Rocket), and proposed the AppC specification. In order to avoid the container ecosystem from falling into fragmentation, **OCI**<sup>[6]</sup> (Open Container Initiative) was officially established in 2015 under the leadership of the Linux Foundation.

The OCI currently contains three specifications: 
- the Runtime Specification (runtime-spec): The structure of the container image is defined to ensure that the image can be recognized and managed by various tools
- the Image Specification (image-spec): It defines the distribution method for container images, ensuring that images can interact with image repositories via a standardized HTTP API
- the Distribution Specification (distribution-spec): It defines the operational standards for containers, ensuring that the container lifecycle can be executed and managed uniformly during container runtime
![OCI](https://i.postimg.cc/13zH7wpf/OCI.png)

### 2.1 runtime-spec
The Runtime Specification outlines how to run a “filesystem bundle” that is unpacked on disk. At a high-level an OCI implementation would download an OCI Image then unpack that image into an OCI Runtime filesystem bundle. At this point the OCI Runtime Bundle would be run by an OCI Runtime.

This spec rules:
- config: `config.json` configuration file describes information such as the container's processes, mounts, hooks, resource limits, etc.
- env: Keep container run environment same, unpack image to runtime filesystem bundle
- lifecycle: declare container from `create` to `delete`

Docker donated its lowest level of container creation code to OCI - `runc` (before was `libcontainer`), which became a reference implementation of the OCI runtime specification. 

### 2.2 image-spec
The goal of this specification is to enable the creation of interoperable tools for building, transporting, and preparing a container image to run.
![image-spec1](https://github.com/opencontainers/image-spec/blob/main/img/build-diagram.png?raw=true)
![image-spec2](https://github.com/opencontainers/image-spec/blob/main/img/run-diagram.png?raw=true)

Image Specification rules iamges' structure:
- `image manifest`
- `image index`
- `filesystem layers`
- `configuration`

### 2.3 distribution-spec
The Distribution Specification ensures that different repositories and clients can use a unified API for image distribution. This allows repositories to use both public repositories (Docker Hub, etc.) and private repositories (Harbor, etc.). Clients can upload or download images using the HTTP requests outlined in the specification.
![distribution-spec](https://i.postimg.cc/nrcjVYFy/OCI-Distribution-spec.png)

## Part 3 Kubernetes
The following diagram shows the relationship between the parts of a Kubernetes cluster: 
![kubernetes-architecture](https://www.redhat.com/rhdc/managed-files/kubernetes_diagram-v3-770x717_0.svg)

> [Kubernetes doc](kubernetes.io/docs/concepts/architecture/) has the more informations about each components.

From here, we create a kubernetes cluster by `minikube`<sup>[7]</sup>.

Here I suggest start with `docker` driver<sup>[8]</sup>. 
```bash
# with a proxy for speed up
$ minikube start --driver=docker --docker-env HTTP_PROXY=http://127.0.0.1:10808 --docker-env HTTPS_PROXY=https://127.0.0.1:10808
```
After `start` run finished, we can see the cluster container by `sudo docker ps`:
```bash
$ sudo docker ps
CONTAINER ID   IMAGE                                 COMMAND                  CREATED        STATUS        PORTS                                                                                                                                  NAMES
ca7632420dcd   gcr.io/k8s-minikube/kicbase:v0.0.50   "/usr/local/bin/entr…"   22 hours ago   Up 22 hours   127.0.0.1:32783->22/tcp, 127.0.0.1:32784->2376/tcp, 127.0.0.1:32785->5000/tcp, 127.0.0.1:32786->8443/tcp, 127.0.0.1:32787->32443/tcp   minikube
```

All the cluster components are installed in the container `b08f695f77b6`, let us go into to see more:
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

We can see `k8s-etcd`, `kube-apiserver`, `k8s_kube-controller-manager`, `k8s_kube-scheduler`, `k8s_kube-proxy` etc. All components are totally same with [kubernetes-architecture](#part-3-kubernetes). For now, `exit` k8s container and continue operating the cluster.
```bash
root@minikube:/# exit
exit
$ kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   21h   v1.35.1
```

`minikube` can not use local docker image, so we need load local image to minikube inner docker:
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

Because the cluster run in the docker container, so we need expose the server by creating a service:
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

For now, the `deployment/nginx-deployment` only has one pod in running for server. When traffic increases, we will need to scale the application to keep up with user demand. *Scaling* is accomplished by changing the number of replicas in a Deployment.
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

## Part 4 PaaS and IaaS
> Consider this: OpenStack can virtualize bare metal hardware resources, partitioning, allocating, and assembling them into basic services (virtual machines) and delivering them to customers on demand. Similarly, Kubernetes can be deployed on bare metal, packaging hardware resources into containers and delivering them to users. For customers, there is no fundamental difference between VMs and containers in terms of usage. Therefore, is it still necessary for cloud service providers to simultaneously implement IaaS (OpenStack) and PaaS (Kubernetes)?

On the surface, users do indeed just want "computing resources": a shell to run code. But for cloud service providers,  IaaS (represented by OpenStack) and PaaS (represented by Kubernetes) are not mutually exclusive competitors.

The main reasons why cloud service providers still retain both are based on the following four dimensions:
- *secure isolation*: Containers<sup>[9]</sup> are "soft isolated", VMs are "hard isolated". Containers share the host machine's **kernel**, so *container escape* can compromise the data of other users on the same physical machine. VMs have their own independent kernels.
- *division of labor*: IaaS addresses the "monetization of physical resources"; PaaS addresses the "application lifecycle".
- *compatibility with diverse workloads*: Not all business operations can be "containerized". For some lagacy apps and stateful services, their architects still prefer to run them on IaaS or even bare metal to obtain more stable IO performance.
- *maintenance costs*: Physical machines have vastly different CPU and memory specifications. If managed directly by Kubernetes, the scheduler would become extremely complex.

For now, IaaS and PaaS are both the important and basic part for cloud service providers.

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
