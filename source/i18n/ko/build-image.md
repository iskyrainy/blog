---
title: 컨테이너 빌드
category: Tech
tag: Docker
date: 2025-07-08T00:32:44+08:00
---

# 컨테이너 빌드
애플리케이션을 프로그래밍하거나 배포할 때 *환경*을 다루는 것은 종종 까다로운 작업이 될 수 있습니다. 컨테이너 기술은 이 문제에 대한 매끄러운 해결책을 제공합니다. 컨테이너는 애플리케이션이 실행되는 데 필요한 환경을 캡슐화한 경량 가상 머신처럼 작동하므로, 필요한 의존성과 서비스에만 집중할 수 있습니다. 이 글에서는 Docker 이미지를 빌드하는 단계를 살펴봅니다.

## 1 Docker 기반
Docker 이미지를 빌드하기 전에 서버에 Docker가 설치되어 있어야 합니다. 다음은 CentOS용 설치 단계입니다:
1. 온라인 설치:
   ```bash
    yum update
    yum install -y docker-ce docker-ce-cli containerd.io
   ```
2. 오프라인<sup>[1]</sup> 설치: 예시는 `28.3.1` 버전을 설치하는 것이며, 설치하려는 버전으로 바꾸십시오
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

## 2 이미지 빌드
Dockerfile로부터 docker 이미지를 빌드합니다.
예시:
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

## 3 컨테이너 실행
이미지를 로드하고 컨테이너를 실행합니다:
```bash
# save image to tar
docker save -o test.jar test:latest
# load image from tar
docker load -i test.jar
# run a container
docker run -it -d --restart=always -p 8900:8900 -v /app/log:/app/log --cpus=4 --memory=4g --name test_container test:latest
```

## 4 컨테이너와 가상 머신의 차이

Docker 컨테이너와 전통적인 가상 머신(VM) 모두 애플리케이션을 위한 격리된 환경을 제공하지만, **아키텍처**, **격리**, **리소스 접근**, **이식성** 면에서 크게 다릅니다.

| 측면                   | 가상 머신 (VM)                                              | Docker 컨테이너                                                   |
|--------------------------|-------------------------------------------------------------------|--------------------------------------------------------------------|
| **가상화 계층** | 하이퍼바이저 기반 (예: KVM, VMware), VM마다 완전한 게스트 OS    | OS 수준 (Linux 네임스페이스 & cgroups); 호스트 커널 공유           |
| **격리**            | 하드웨어 강제; 각 VM이 자체 커널 실행                    | 프로세스 수준; PID, NET, MNT, IPC, UTS & USER 네임스페이스           |
| **부팅 시간**            | 분 단위                                                           | 밀리초에서 초 단위                                            |
| **이미지 크기**           | 기가바이트 (완전한 OS 이미지)                                         | 메가바이트 (필요한 레이어만)                                  |
| **리소스 오버헤드**      | 높음—게스트 OS가 CPU, 메모리 & 디스크 사용                           | 낮음—게스트 커널 없음, 최소 런타임 풋프린트                   |
| **OS 호환성**       | 다양한 OS 계열을 동시에 호스팅 가능 (예: Linux에서 Windows) | 호스트와 동일한 커널 계열 (대부분 Linux 전용)                 |
| **I/O 성능**       | 가상 장치(vNIC, vDisk)를 통해 중계됨                    | 거의 네이티브; 선택적 제한과 함께 호스트 장치에 직접 접근  |
| **업데이트 & 관리** | VM마다 전체 OS 패치                                           | 계층화된 이미지; 공통 레이어 재사용, 빠른 업데이트 & 롤백      |
| **이식성**          | 부피가 큰 이미지; 마이그레이션 느림                                   | 경량 레지스트리; 모든 Docker 호스트에서 동일한 동작  |

### 4.1 VM을 선택해야 할 때

- **혼합 OS 환경**: Linux 호스트에서 Windows, BSD 또는 기타 비Linux 게스트가 필요할 때.
- **최대 격리**: 엄격한 하드웨어 분리가 필요한 고보안, 멀티테넌트 사용 사례.
- **레거시 애플리케이션**: 사용자 정의 커널에 의존하거나 전체 OS 제어를 기대하는 앱.

### 4.2 컨테이너를 선택해야 할 때

- **마이크로서비스**: 독립적으로 빌드, 배포, 확장할 수 있는 작고 단일 목적의 서비스.
- **CI/CD 파이프라인**: 개발부터 프로덕션까지 재현 가능한 빌드 환경.
- **리소스 효율성**: 최소한의 오버헤드와 매우 빠른 시작으로 호스트 활용 극대화.
- **DevOps 워크플로**: 이미지 레이어링, 버전 관리 레지스트리, Compose나 Kubernetes 같은 오케스트레이션 도구 활용.

### 4.3 미래 동향
- **컨테이너와 VM의 수렴**
  보안 우려가 커지면서, 컨테이너를 경량 VM 안에서 실행하여 강력한 격리와 컨테이너의 민첩성을 결합하는 하이브리드 접근법(예: Kata Containers, Firecracker)이 등장하고 있습니다.
- **유니커널과 마이크로VM**
  AWS Firecracker(MicroVM)와 MirageOS(Unikernel) 같은 프로젝트는 게스트 OS를 최소한으로 줄여 밀리초 단위의 시작과 최소한의 공격 표면을 제공하며, 서버리스와 엣지 워크로드에 이상적입니다.
- **서버리스와 함수 샌드박싱**
  장시간 실행되는 컨테이너를 넘어, 서버리스 플랫폼은 마이크로VM이나 보안 컨테이너 샌드박스를 통한 격리로 나아가고 있으며, 세밀한 과금과 제로 스케일링을 가능하게 합니다.
- **선언적 인프라 & GitOps**
  Infrastructure as Code 도구(Terraform, Pulumi)와 GitOps 워크플로는 점점 더 컨테이너 클러스터와 VM 플릿을 통합된 버전 관리 방식으로 관리하고 있습니다.
- **엣지 & IoT 배포**
  경량 풋프린트에 대한 요구가 엣지 장치에 최적화된 컨테이너 런타임을 이끌고 있으며, 마이크로VM은 멀티테넌트 IoT 게이트웨이에서 격리를 보장합니다.
- **설계에 의한 보안**
  런타임 강화(루트리스 컨테이너, seccomp, gVisor), 이미지 출처(in-toto, Sigstore), 공급망 제어가 VM과 컨테이너 파이프라인 모두의 표준이 되고 있습니다.

이러한 동향은 함께 **VM**, **컨테이너**, **마이크로VM**, **유니커널**이 공존하는 생태계를 지향하며, 각각은 격리, 성능, 관리 용이성의 적절한 균형을 요구하는 워크로드에 활용됩니다.

## 5 컨테이너 모범 사례
Docker 컨테이너(또는 OCI 호환 런타임)를 사용할 때 다음 모범 사례를 따르면 더 안정적이고 안전하며 유지 관리가 용이한 이미지와 배포를 만들 수 있습니다:

1. **컨테이너당 하나의 프로세스**
   - 포그라운드에서 단일 메인 프로세스를 실행하십시오.
   - 사이드카(로그 수집기, 프록시)가 필요하면 별도의 컨테이너를 사용하고 Docker Compose나 Kubernetes로 조정하십시오.
2. **최소 기본 이미지 사용**
   - 공격 표면과 이미지 크기를 줄이기 위해 슬림 또는 "distroless" 이미지(예: `alpine`, `gcr.io/distroless/base`)를 선택하십시오.
   - 멀티 스테이지 빌드를 활용하여 한 단계에서 애플리케이션을 컴파일하고 런타임 아티팩트만 최종 단계로 복사하십시오.
3. **의존성 & 이미지 태그 고정**
   - OS 패키지와 언어 런타임의 정확한 버전을 지정하십시오(`apk add openjdk21-jre=21.0.0-r0`).
   - 프로덕션에서는 `latest` 태그를 피하고, 불변 태그나 다이제스트를 사용하십시오(`alpine:3.22` → `alpine@sha256:…`).
4. **Dockerfile 레이어를 지능적으로 구성**
   - 자주 변경되는 명령(애플리케이션 코드)을 하단에 그룹화하여 캐싱이 재빌드 속도를 극대화하도록 하십시오.
   - 오래 지속되는 의존성(시스템 라이브러리, 언어 런타임)을 초기 레이어로 분리하십시오.
5. **컨테이너 권한 제한**
   - 절대 root로 실행하지 마십시오; 비root 사용자를 생성하고 전환하십시오(`RUN addgroup app && adduser -S -G app app`).
   - Docker의 사용자 네임스페이스 리매핑을 활성화하거나 보안 프로필(AppArmor, SELinux)을 사용하십시오.
6. **리소스 제약 설정**
   - 컨테이너가 호스트를 독점하지 않도록 CPU, 메모리, I/O 제한을 정의하십시오(`--cpus`, `--memory`, `--blkio-weight`).
   - Kubernetes에서는 모든 Pod 스펙에 `requests`와 `limits`를 사용하십시오.


[1]: [Docker static pkg](https://download.docker.com/linux/static/stable/)