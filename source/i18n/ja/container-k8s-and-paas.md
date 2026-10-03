---
title: コンテナ、Kubernetes、PaaS
category: Tech
tag: Linux
date: 2026-02-23T00:23:04+08:00
---


## Part 1 コンテナ技術
コンテナは何をもたらすのか? サーバのデプロイや運用をしたことがある人なら誰でも、終わりのない依存関係の衝突、環境エラー、そしてさまざまな非互換問題に絶望させられた経験があるだろう。

コンテナはこの問題を完全に解決した。コンテナ技術はアプリケーションを基盤環境から分離する。コンテナベースのコンテナオーケストレーション技術は、デプロイ、プロダクション、運用をまったく新しいレベルへと引き上げる。

コンテナは突如現れたブラックテクノロジーではなく、本質的にはLinuxカーネル機能の究極のパッケージ化である。Dockerよりもずっと前から、Linuxには分離のためのツールが存在していた<sup>[1]</sup>:
- `chroot`<sup>[2]</sup>
- `Namespaces`<sup>[3]</sup>
- `Cgroups`<sup>[4]</sup>

では、コンテナの天才的な点は何か? コンテナとは、アプリケーションプロセスの標準化されたカプセル化である。このカプセル化に*Linuxのcgroup名前空間*技術を使うか、仮想化の*ハイパーバイザー*技術を使うかは本質的な問題ではない。重要なのは目的である。コンテナは**アプリケーションの標準化**のために生まれた。
コンテナはアプリケーションと、それを実行するために必要なライブラリ、設定、環境変数のすべてを読み取り専用のファイルシステムにパッケージ化する。

技術を学ぶにはその歴史を理解する必要がある。一部のマーケティングアカウントは、KubernetesがDockerを「見捨てた」とか、Dockerは完全に廃れたなどという噂を流している。コンテナ技術の発展を理解してこそ、KubernetesがDockerを「見捨てた」ことの本当の意味が分かる。

コンテナ技術の発展は、2013年のDockerの登場から始まった。Dockerはイメージパッケージングの仕組みによって「自分のマシンでは動く」という古典的な問題を解決し、その後、Docker Swarm、Apache Mesos、そしてGoogleがオープンソース化したKubernetes (K8s) が主導する「コンテナオーケストレーション戦争」を引き起こした。K8sがその優れた設計によって戦争に勝利し<sup>[5]</sup>、デファクトスタンダードとなると、Dockerは中核ランタイムであるcontainerdをCNCFに寄贈し、業界の標準化を推進して、基盤となるランタイムと上位のツールチェーンを分離した。同時に、より高いセキュリティと分散化を求めて、root権限を必要としないデーモンレスの代替手段であるPodmanなどが登場し、コンテナエコシステムは単一の支配者から、OCI標準に準拠した多様で軽量な時代へと移行した。

コンテナの発展の歴史全体を振り返れば、コンテナに詳しい人ならKubernetesがDockerを「見捨てた」意味が分かるだろう。KubernetesはDockershimのサポートを廃止した。つまり、Dockeshimを介してDockerを呼び出し、さらにDockerを介してcontainerdを呼び出すのではなく、containerdを直接呼び出すようになったのである。

> さまざまな概念の混同を避けるため、コンテナランタイムシステム全体の階層図をここに示す。

![Container-System](https://i.postimg.cc/y8SPzBr0/Container-System.png)

## Part 2 コンテナ標準: OCI
初期の頃、Dockerはネットワーキング、ストレージ、オーケストレーションなどすべてを巨大なモノリシックデーモンに統合しようとした。これはコミュニティ、特にCoreOSの不満を招いた。2014年、CoreOSはrkt (Rocket) を発表し、AppC仕様を提唱した。コンテナエコシステムが分断に陥るのを避けるため、**OCI**<sup>[6]</sup> (Open Container Initiative) が2015年、Linux Foundationの主導のもとで正式に設立された。

OCIは現在3つの仕様を含んでいる:
- ランタイム仕様 (runtime-spec): コンテナイメージの構造を定義し、イメージがさまざまなツールで認識・管理できることを保証する
- イメージ仕様 (image-spec): コンテナイメージの配布方法を定義し、イメージが標準化されたHTTP APIを介してイメージリポジトリとやり取りできることを保証する
- 配布仕様 (distribution-spec): コンテナの運用基準を定義し、コンテナのライフサイクルがコンテナランタイム中に統一的に実行・管理できることを保証する
![OCI](https://i.postimg.cc/13zH7wpf/OCI.png)

### 2.1 runtime-spec
ランタイム仕様は、ディスク上に展開された「ファイルシステムバンドル」をどのように実行するかを概説する。大まかに言えば、OCI実装はOCIイメージをダウンロードし、そのイメージをOCIランタイムファイルシステムバンドルに展開する。この時点で、OCIランタイムバンドルはOCIランタイムによって実行される。

この仕様が規定するもの:
- config: `config.json` 設定ファイルは、コンテナのプロセス、マウント、フック、リソース制限などの情報を記述する
- env: コンテナの実行環境を同一に保ち、イメージをランタイムファイルシステムバンドルに展開する
- lifecycle: コンテナの`create`から`delete`までを宣言する

Dockerはコンテナ作成の最も低レベルなコードをOCIに寄贈した - それが`runc` (以前は`libcontainer`) であり、OCIランタイム仕様のリファレンス実装となった。

### 2.2 image-spec
この仕様の目的は、コンテナイメージをビルド、転送、実行準備するための相互運用可能なツールの作成を可能にすることである。
![image-spec1](https://github.com/opencontainers/image-spec/blob/main/img/build-diagram.png?raw=true)
![image-spec2](https://github.com/opencontainers/image-spec/blob/main/img/run-diagram.png?raw=true)

イメージ仕様はイメージの構造を規定する:
- `image manifest`
- `image index`
- `filesystem layers`
- `configuration`

### 2.3 distribution-spec
配布仕様は、異なるリポジトリとクライアントがイメージ配布のために統一されたAPIを使用できることを保証する。これにより、リポジトリはパブリックリポジトリ (Docker Hubなど) とプライベートリポジトリ (Harborなど) の両方を使用できる。クライアントは仕様に概説されたHTTPリクエストを使用してイメージをアップロードまたはダウンロードできる。
![distribution-spec](https://i.postimg.cc/nrcjVYFy/OCI-Distribution-spec.png)

## Part 3 Kubernetes
以下の図は、Kubernetesクラスタの各部分の関係を示している:
![kubernetes-architecture](https://www.redhat.com/rhdc/managed-files/kubernetes_diagram-v3-770x717_0.svg)

> [Kubernetes doc](kubernetes.io/docs/concepts/architecture/) に各コンポーネントの詳細情報がある。

ここから、`minikube`<sup>[7]</sup>でKubernetesクラスタを作成する。

ここでは`docker`ドライバ<sup>[8]</sup>から始めることを勧める。
```bash
# with a proxy for speed up
$ minikube start --driver=docker --docker-env HTTP_PROXY=http://127.0.0.1:10808 --docker-env HTTPS_PROXY=https://127.0.0.1:10808
```
`start`の実行が完了したら、`sudo docker ps`でクラスタコンテナを確認できる:
```bash
$ sudo docker ps
CONTAINER ID   IMAGE                                 COMMAND                  CREATED        STATUS        PORTS                                                                                                                                  NAMES
ca7632420dcd   gcr.io/k8s-minikube/kicbase:v0.0.50   "/usr/local/bin/entr…"   22 hours ago   Up 22 hours   127.0.0.1:32783->22/tcp, 127.0.0.1:32784->2376/tcp, 127.0.0.1:32785->5000/tcp, 127.0.0.1:32786->8443/tcp, 127.0.0.1:32787->32443/tcp   minikube
```

すべてのクラスタコンポーネントはコンテナ`b08f695f77b6`にインストールされている。中に入って詳しく見てみよう:
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

`k8s-etcd`、`kube-apiserver`、`k8s_kube-controller-manager`、`k8s_kube-scheduler`、`k8s_kube-proxy`などが確認できる。すべてのコンポーネントは[kubernetes-architecture](#part-3-kubernetes)とまったく同じである。ここでk8sコンテナを`exit`し、クラスタの操作を続ける。
```bash
root@minikube:/# exit
exit
$ kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   21h   v1.35.1
```

`minikube`はローカルのdockerイメージを使用できないため、ローカルイメージをminikube内部のdockerにロードする必要がある:
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

クラスタはdockerコンテナ内で動作しているため、サービスを作成してサーバを公開する必要がある:
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

現時点では、`deployment/nginx-deployment`にはサーバ用に実行中のpodが1つしかない。トラフィックが増加すると、ユーザの需要に追いつくためにアプリケーションをスケールする必要がある。*スケーリング*は、Deployment内のレプリカ数を変更することで実現される。
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

## Part 4 PaaSとIaaS
> 考えてみよう: OpenStackはベアメタルのハードウェアリソースを仮想化し、分割、割り当て、組み立てを行って基本サービス (仮想マシン) とし、顧客にオンデマンドで提供できる。同様に、Kubernetesはベアメタル上にデプロイでき、ハードウェアリソースをコンテナにパッケージ化してユーザに提供できる。顧客にとって、VMとコンテナの使用方法に根本的な違いはない。それならば、クラウドサービスプロバイダはIaaS (OpenStack) とPaaS (Kubernetes) を同時に実装する必要がまだあるのだろうか?

表面的には、ユーザは確かに「コンピューティングリソース」、つまりコードを実行するためのシェルを望んでいるだけである。しかしクラウドサービスプロバイダにとって、IaaS (OpenStackに代表される) とPaaS (Kubernetesに代表される) は相互排他的な競合相手ではない。

クラウドサービスプロバイダが両方を維持し続ける主な理由は、以下の4つの次元に基づいている:
- *安全な分離*: コンテナ<sup>[9]</sup>は「ソフト分離」であり、VMは「ハード分離」である。コンテナはホストマシンの**カーネル**を共有するため、*コンテナエスケープ*によって同じ物理マシン上の他のユーザのデータが侵害される可能性がある。VMは独自の独立したカーネルを持つ。
- *役割分担*: IaaSは「物理リソースの収益化」に対応し、PaaSは「アプリケーションライフサイクル」に対応する。
- *多様なワークロードとの互換性*: すべてのビジネスオペレーションが「コンテナ化」できるわけではない。一部のレガシーアプリやステートフルサービスでは、アーキテクトはより安定したIO性能を得るために、IaaSやベアメタル上で実行することを依然として好む。
- *保守コスト*: 物理マシンはCPUやメモリの仕様が大きく異なる。Kubernetesで直接管理すると、スケジューラが極めて複雑になる。

現時点では、IaaSとPaaSはどちらもクラウドサービスプロバイダにとって重要かつ基本的な部分である。

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