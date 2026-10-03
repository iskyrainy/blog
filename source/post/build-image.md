---
title: Build Container
category: Tech
tag: Docker
date: 2025-07-08T00:32:44+08:00
---

# Build Container
When it comes to programming or deploying applications, handling *environments* can often be a challenging task. Container technology offers a seamless solution to this issue. Containers function as lightweight virtual machines that encapsulate the environment needed for your application to run, so you can focus solely on the dependencies and services that are required. This article will walk through the steps of building a Docker image.

## 1 Docker base
Before you start building Docker images, you need to have Docker installed on your server. Below are the installation steps for CentOS:
1. online install: 
   ```bash
    yum update
    yum install -y docker-ce docker-ce-cli containerd.io
   ```
2. offline<sup>[1]</sup> install: example is install the version of `28.3.1`, please replace the version wanted install
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

## 2 Build a image
Build a docker image from a Dockerfile.
As:
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

## 3 Run a container
Load image and run a container:
```bash
# save image to tar
docker save -o test.jar test:latest
# load image from tar
docker load -i test.jar
# run a container
docker run -it -d --restart=always -p 8900:8900 -v /app/log:/app/log --cpus=4 --memory=4g --name test_container test:latest
```

## 4 Difference between Container and Virtual Machines

While both Docker containers and traditional virtual machines (VMs) provide isolated environments for applications, they differ significantly in **architecture**, **isolation**, **resource access**, and **portability**.

| Aspect                   | Virtual Machine (VM)                                              | Docker Container                                                   |
|--------------------------|-------------------------------------------------------------------|--------------------------------------------------------------------|
| **Virtualization Layer** | Hypervisor-based (e.g., KVM, VMware) with full guest OS per VM    | OS-level (Linux namespaces & cgroups); share host kernel           |
| **Isolation**            | Hardware‑enforced; each VM runs its own kernel                    | Process‑level; PID, NET, MNT, IPC, UTS & USER namespaces           |
| **Boot Time**            | Minutes                                                           | Milliseconds to seconds                                            |
| **Image Size**           | Gigabytes (full OS image)                                         | Megabytes (only necessary layers)                                  |
| **Resource Overhead**    | Higher—guest OS uses CPU, memory & disk                           | Lower—no guest kernel, minimal runtime footprint                   |
| **OS Compatibility**     | Can host different OS families simultaneously (e.g. Windows on Linux) | Same kernel family as host (mostly Linux-only)                 |
| **I/O Performance**      | Mediated through virtual devices (vNIC, vDisk)                    | Near‑native; direct host device access with optional restrictions  |
| **Updates & Management** | Full OS patching per VM                                           | Layered images; reuse common layers, fast updates & rollbacks      |
| **Portability**          | Bulky images; slower to migrate                                   | Lightweight registries; identical behavior across any Docker host  |

### 4.1 When to Choose VMs

- **Mixed‑OS environments**: Need Windows, BSD, or other non‑Linux guests on a Linux host.  
- **Maximum isolation**: High‑security, multi‑tenant use‑cases requiring strict hardware separation.  
- **Legacy applications**: Apps that depend on custom kernels or expect full OS control.

### 4.2 When to Choose Container

- **Microservices**: Small, single‑purpose services you can build, ship and scale independently.  
- **CI/CD pipelines**: Reproducible build environments from development through production.  
- **Resource efficiency**: Maximize host utilization with minimal overhead and lightning‑fast start‑up.  
- **DevOps workflows**: Leverage image layering, versioned registries, and orchestration tools like Compose or Kubernetes.

### 4.3 Future Trends
- **Convergence of Containers and VMs**  
  As security concerns grow, hybrid approaches are emerging that run containers inside lightweight VMs (e.g. Kata Containers, Firecracker) to blend strong isolation with container agility.
- **Unikernels and MicroVMs**  
  Projects like AWS Firecracker (MicroVM) and MirageOS (Unikernel) strip down the guest OS to the bare minimum, offering millisecond startups and minimal attack surface, ideal for serverless and edge workloads.
- **Serverless and Function Sandboxing**  
  Beyond long‑running containers, serverless platforms are moving toward isolation via microVMs or secure container sandboxes, enabling fine‑grained billing and scale‑to‑zero.
- **Declarative Infrastructure & GitOps**  
  Infrastructure as Code tools (Terraform, Pulumi) and GitOps workflows increasingly manage both container clusters and VM fleets in a unified, version‑controlled manner.
- **Edge & IoT Deployments**  
  The need for lightweight footprints is driving container runtimes optimized for edge devices, while microVMs ensure isolation on multi‑tenant IoT gateways.
- **Security by Design**  
  Runtime hardening (rootless containers, seccomp, gVisor), image provenance (in-toto, Sigstore), and supply‑chain controls are becoming standard for both VM and container pipelines.

Together, these trends point toward an ecosystem where **VMs**, **containers**, **microVMs**, and **unikernels** coexist—each brought to bear on workloads that demand the right balance of isolation, performance, and manageability.  

## 5 Container Best Practices
When working with Docker containers (or any OCI‑compliant runtime), following these best practices will help you build more reliable, secure, and maintainable images and deployments:

1. **One Process per Container**  
   - Run a single main process in the foreground.  
   - If you need sidecars (log collectors, proxies), use separate containers and coordinate them with Docker Compose or Kubernetes.
2. **Use Minimal Base Images**  
   - Choose slim or “distroless” images (e.g. `alpine`, `gcr.io/distroless/base`) to reduce attack surface and image size.  
   - Leverage multi‑stage builds to compile your application in one stage and copy only the runtime artifacts into the final stage.
3. **Pin Dependencies & Image Tags**  
   - Specify exact versions for OS packages and language runtimes (`apk add openjdk21-jre=21.0.0-r0`).  
   - Avoid the `latest` tag in production—use immutable tags or digests (`alpine:3.22` → `alpine@sha256:…`).
4. **Layer Your Dockerfile Intelligently**  
   - Group commands that change frequently (application code) near the bottom, so caching maximizes rebuild speed.  
   - Separate long‑lived dependencies (system libraries, language runtime) into early layers.
5. **Limit Container Privileges**  
   - Never run as root; create and switch to a non‑root user (`RUN addgroup app && adduser -S -G app app`).  
   - Enable Docker’s user namespace remapping or use security profiles (AppArmor, SELinux).  
6. **Set Resource Constraints**  
   - Define CPU, memory, and I/O limits to prevent a container from monopolizing the host (`--cpus`, `--memory`, `--blkio-weight`).  
   - In Kubernetes, use `requests` and `limits` for every Pod spec.


[1]: [Docker static pkg](https://download.docker.com/linux/static/stable/)
