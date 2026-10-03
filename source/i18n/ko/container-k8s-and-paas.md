---
title: 컨테이너, 쿠버네티스 그리고 PaaS
category: Tech
tag: Linux
date: 2026-02-23T00:23:04+08:00
---


## Part 1 컨테이너 기술
컨테이너는 무엇을 가져다주는가? 서버를 한 번이라도 배포하거나 유지보수해 본 사람이라면 끝없는 의존성 충돌, 환경 오류, 그리고 갖가지 호환성 문제에 절망해 본 적이 있을 것이다.

컨테이너는 이 문제를 완전히 해결했다. 컨테이너 기술은 애플리케이션을 하위 환경으로부터 격리한다. 컨테이너 기반의 컨테이너 오케스트레이션 기술은 배포, 프로덕션, 운영을 완전히 새로운 차원으로 끌어올린다.

컨테이너는 갑자기 등장한 블랙 기술이 아니라, 본질적으로 리눅스 커널 기능의 궁극적인 패키징이다. Docker 훨씬 이전부터 리눅스에는 격리를 위한 도구들이 이미 존재했다<sup>[1]</sup>:
- `chroot`<sup>[2]</sup>
- `Namespaces`<sup>[3]</sup>
- `Cgroups`<sup>[4]</sup>

그렇다면 컨테이너의 천재적인 점은 무엇인가? 컨테이너는 애플리케이션 프로세스의 표준화된 캡슐화이다. 이 캡슐화에 *리눅스의 cgroup 네임스페이스* 기술을 사용하든, 가상화 *하이퍼바이저* 기술을 사용하든 그것은 핵심이 아니다. 핵심은 목표다: 컨테이너는 **애플리케이션 표준화**를 위해 만들어진다.
컨테이너는 애플리케이션과 그 실행에 필요한 전체 라이브러리, 설정, 환경 변수를 읽기 전용 파일 시스템으로 패키징한다.

기술을 배우려면 그 역사를 이해해야 한다. 일부 마케팅 계정들은 Kubernetes가 Docker를 "버렸다"느니, Docker가 완전히 외면받게 되었다느니 하는 소문을 퍼뜨린다. 컨테이너 기술의 발전을 이해해야만 Kubernetes가 Docker를 "버렸다"는 것의 진정한 의미를 이해할 수 있다.

컨테이너 기술의 발전은 2013년 Docker의 등장에서 시작되었다. Docker는 이미지 패키징 메커니즘을 통해 "내 컴퓨터에서는 되는데"라는 고전적인 문제를 해결했고, 이후 Docker Swarm, Apache Mesos, 그리고 구글이 오픈소스로 공개한 Kubernetes(K8s)가 주도한 "컨테이너 오케스트레이션 전쟁"에 불을 붙였다. K8s가 뛰어난 설계로 전쟁에서 승리<sup>[5]</sup>하여 사실상의 표준이 되자, Docker는 핵심 런타임인 containerd를 CNCF에 기부하여 업계 표준화를 촉진하고 하위 런타임과 상위 도구 체인을 분리했다. 동시에 더 높은 보안성과 탈중앙화를 추구하며 root 권한이 필요 없는 데몬리스 대안인 Podman 등이 등장했고, 이는 컨테이너 생태계가 단일 강자 체제에서 OCI 표준을 준수하는 다양하고 경량화된 시대로 전환되었음을 의미한다.

컨테이너 발전의 전체 역사를 살펴보면, 컨테이너에 익숙한 사람들은 Kubernetes가 Docker를 "버렸다"는 것의 의미를 이해할 것이다. Kubernetes는 Dockershim에 대한 지원을 중단한 것이며, 이는 더 이상 Dockershim을 통해 Docker를 호출하고 다시 Docker를 통해 containerd를 호출하지 않고, containerd를 직접 호출한다는 의미이다.

> 여러 개념 간의 혼동을 피하기 위해, 여기에 전체 컨테이너 런타임 시스템의 계층 다이어그램을 제공한다.

![Container-System](https://i.postimg.cc/y8SPzBr0/Container-System.png)

## Part 2 컨테이너 표준: OCI
초기에는 Docker가 네트워킹, 스토리지, 오케스트레이션 등 모든 것을 거대한 모놀리식 데몬에 통합하려 했다. 이는 커뮤니티, 특히 CoreOS의 불만을 샀다. 2014년 CoreOS는 rkt (Rocket)를 출시하고 AppC 명세를 제안했다. 컨테이너 생태계가 파편화되는 것을 막기 위해, 2015년 리눅스 재단의 주도로 **OCI**<sup>[6]</sup> (Open Container Initiative)가 공식 설립되었다.

OCI는 현재 세 가지 명세를 포함한다:
- 런타임 명세 (runtime-spec): 컨테이너 이미지의 구조를 정의하여 이미지가 다양한 도구에 의해 인식되고 관리될 수 있도록 보장한다
- 이미지 명세 (image-spec): 컨테이너 이미지의 배포 방식을 정의하여 이미지가 표준화된 HTTP API를 통해 이미지 저장소와 상호작용할 수 있도록 보장한다
- 배포 명세 (distribution-spec): 컨테이너의 운영 표준을 정의하여 컨테이너 런타임 동안 컨테이너 수명 주기가 일관되게 실행되고 관리될 수 있도록 보장한다
![OCI](https://i.postimg.cc/13zH7wpf/OCI.png)

### 2.1 runtime-spec
런타임 명세는 디스크에 압축 해제된 "파일시스템 번들"을 어떻게 실행하는지 설명한다. 높은 수준에서 OCI 구현은 OCI 이미지를 다운로드한 다음 해당 이미지를 OCI 런타임 파일시스템 번들로 압축 해제한다. 이 시점에서 OCI 런타임 번들은 OCI 런타임에 의해 실행된다.

이 명세가 규정하는 것:
- config: `config.json` 설정 파일은 컨테이너의 프로세스, 마운트, 훅, 리소스 제한 등의 정보를 설명한다
- env: 컨테이너 실행 환경을 동일하게 유지하고, 이미지를 런타임 파일시스템 번들로 압축 해제한다
- lifecycle: `create`부터 `delete`까지 컨테이너를 선언한다

Docker는 컨테이너 생성의 가장 낮은 수준의 코드를 OCI에 기부했다 - `runc` (이전에는 `libcontainer`), 이는 OCI 런타임 명세의 참조 구현이 되었다.

### 2.2 image-spec
이 명세의 목표는 컨테이너 이미지를 빌드, 전송, 실행 준비하기 위한 상호 운용 가능한 도구의 생성을 가능하게 하는 것이다.
![image-spec1](https://github.com/opencontainers/image-spec/blob/main/img/build-diagram.png?raw=true)
![image-spec2](https://github.com/opencontainers/image-spec/blob/main/img/run-diagram.png?raw=true)

이미지 명세는 이미지의 구조를 규정한다:
- `image manifest`
- `image index`
- `filesystem layers`
- `configuration`

### 2.3 distribution-spec
배포 명세는 서로 다른 저장소와 클라이언트가 이미지 배포를 위해 통일된 API를 사용할 수 있도록 보장한다. 이를 통해 저장소는 공개 저장소(Docker Hub 등)와 비공개 저장소(Harbor 등)를 모두 사용할 수 있다. 클라이언트는 명세에 설명된 HTTP 요청을 사용하여 이미지를 업로드하거나 다운로드할 수 있다.
![distribution-spec](https://i.postimg.cc/nrcjVYFy/OCI-Distribution-spec.png)

## Part 3 Kubernetes
다음 다이어그램은 Kubernetes 클러스터의 구성 요소 간 관계를 보여준다:
![kubernetes-architecture](https://www.redhat.com/rhdc/managed-files/kubernetes_diagram-v3-770x717_0.svg)

> [Kubernetes 문서](kubernetes.io/docs/concepts/architecture/)에 각 구성 요소에 대한 더 많은 정보가 있다.

여기서부터 `minikube`<sup>[7]</sup>를 통해 kubernetes 클러스터를 생성한다.

여기서는 `docker` 드라이버<sup>[8]</sup>로 시작하는 것을 권장한다.
```bash
# with a proxy for speed up
$ minikube start --driver=docker --docker-env HTTP_PROXY=http://127.0.0.1:10808 --docker-env HTTPS_PROXY=https://127.0.0.1:10808
```
`start` 실행이 완료되면 `sudo docker ps`로 클러스터 컨테이너를 볼 수 있다:
```bash
$ sudo docker ps
CONTAINER ID   IMAGE                                 COMMAND                  CREATED        STATUS        PORTS                                                                                                                                  NAMES
ca7632420dcd   gcr.io/k8s-minikube/kicbase:v0.0.50   "/usr/local/bin/entr…"   22 hours ago   Up 22 hours   127.0.0.1:32783->22/tcp, 127.0.0.1:32784->2376/tcp, 127.0.0.1:32785->5000/tcp, 127.0.0.1:32786->8443/tcp, 127.0.0.1:32787->32443/tcp   minikube
```

모든 클러스터 구성 요소는 컨테이너 `b08f695f77b6`에 설치되어 있으니, 들어가서 더 살펴보자:
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

`k8s-etcd`, `kube-apiserver`, `k8s_kube-controller-manager`, `k8s_kube-scheduler`, `k8s_kube-proxy` 등을 볼 수 있다. 모든 구성 요소는 [kubernetes-architecture](#part-3-kubernetes)와 완전히 동일하다. 이제 k8s 컨테이너를 `exit`하고 클러스터 운영을 계속하자.
```bash
root@minikube:/# exit
exit
$ kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   21h   v1.35.1
```

`minikube`는 로컬 docker 이미지를 사용할 수 없으므로, 로컬 이미지를 minikube 내부 docker에 로드해야 한다:
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

클러스터가 docker 컨테이너에서 실행되므로, 서비스를 생성하여 서버를 노출해야 한다:
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

현재 `deployment/nginx-deployment`에는 서비스 제공을 위해 실행 중인 파드가 하나뿐이다. 트래픽이 증가하면 사용자 수요를 따라잡기 위해 애플리케이션을 확장해야 한다. *확장*은 Deployment의 레플리카 수를 변경함으로써 이루어진다.
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

## Part 4 PaaS와 IaaS
> 생각해 보자: OpenStack은 베어메탈 하드웨어 자원을 가상화하고, 분할, 할당, 조립하여 기본 서비스(가상 머신)로 만들어 고객에게 온디맨드로 제공할 수 있다. 마찬가지로 Kubernetes는 베어메탈에 배포되어 하드웨어 자원을 컨테이너로 패키징하여 사용자에게 제공할 수 있다. 고객 입장에서는 가상 머신과 컨테이너가 사용 측면에서 근본적인 차이가 없다. 그렇다면 클라우드 서비스 제공자가 IaaS(OpenStack)와 PaaS(Kubernetes)를 동시에 구현할 필요가 여전히 있는가?

표면적으로 사용자는 실제로 "컴퓨팅 자원"만을 원한다: 코드를 실행할 셸. 하지만 클라우드 서비스 제공자 입장에서 IaaS(OpenStack으로 대표되는)와 PaaS(Kubernetes로 대표되는)는 상호 배타적인 경쟁자가 아니다.

클라우드 서비스 제공자가 여전히 둘 다 유지하는 주된 이유는 다음 네 가지 차원에 기반한다:
- *보안 격리*: 컨테이너<sup>[9]</sup>는 "소프트 격리"이고, VM은 "하드 격리"이다. 컨테이너는 호스트 머신의 **커널**을 공유하므로 *컨테이너 탈출*이 발생하면 동일한 물리 머신의 다른 사용자 데이터를 위협할 수 있다. VM은 자체적인 독립 커널을 가진다.
- *역할 분담*: IaaS는 "물리 자원의 수익화"를 다루고, PaaS는 "애플리케이션 수명 주기"를 다룬다.
- *다양한 워크로드와의 호환성*: 모든 비즈니스 운영이 "컨테이너화"될 수 있는 것은 아니다. 일부 레거시 앱과 상태 저장 서비스의 경우, 아키텍트들은 더 안정적인 IO 성능을 얻기 위해 IaaS나 심지어 베어메탈에서 실행하는 것을 여전히 선호한다.
- *유지보수 비용*: 물리 머신은 CPU와 메모리 사양이 매우 다양하다. 이를 Kubernetes로 직접 관리하면 스케줄러가 극도로 복잡해질 것이다.

현재 IaaS와 PaaS는 클라우드 서비스 제공자에게 중요한 기본 요소이다.

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