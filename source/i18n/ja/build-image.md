---
title: コンテナのビルド
category: Tech
tag: Docker
date: 2025-07-08T00:32:44+08:00
---

# コンテナのビルド
アプリケーションのプログラミングやデプロイにおいて、*環境*の扱いはしばしば困難な作業となります。コンテナ技術はこの問題にシームレスな解決策を提供します。コンテナは、アプリケーションの実行に必要な環境をカプセル化した軽量な仮想マシンとして機能するため、必要な依存関係やサービスにのみ集中することができます。本記事では、Dockerイメージをビルドする手順を解説します。

## 1 Dockerの基盤
Dockerイメージのビルドを始める前に、サーバーにDockerがインストールされている必要があります。以下はCentOS向けのインストール手順です：
1. オンラインインストール：
   ```bash
    yum update
    yum install -y docker-ce docker-ce-cli containerd.io
   ```
2. オフライン<sup>[1]</sup>インストール：例は`28.3.1`のバージョンをインストールする場合です。インストールしたいバージョンに置き換えてください
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

## 2 イメージのビルド
DockerfileからDockerイメージをビルドします。
例：
```Dockerfile
# ベースイメージから新しいイメージをビルドします。alpineは非常にスリムなLinuxベースOSで、新しいイメージのサイズを小さくできます。
FROM alpine:3.22
# イメージに関する付加情報
LABEL author="gdhvxcj"
# すべてのコマンドの作業ディレクトリを設定
WORKDIR /app
# ファイルをイメージにコピー
COPY target/test.jar /app/test.jar
# 作業環境を構築するためのコマンド。ここではサイズを小さくするためにjreのみをインストール
RUN apk add --no-cache openjdk21-jre
# ポートを公開
EXPOSE 8900
# コンテナ起動時に実行するコマンド。新しいイメージのCMDはベースイメージのCMDを上書きします
CMD java -jar test.jar
```

## 3 コンテナの実行
イメージをロードしてコンテナを実行します：
```bash
# イメージをtarに保存
docker save -o test.jar test:latest
# tarからイメージをロード
docker load -i test.jar
# コンテナを実行
docker run -it -d --restart=always -p 8900:8900 -v /app/log:/app/log --cpus=4 --memory=4g --name test_container test:latest
```

## 4 コンテナと仮想マシンの違い

Dockerコンテナと従来の仮想マシン（VM）はどちらもアプリケーションに分離された環境を提供しますが、**アーキテクチャ**、**分離**、**リソースアクセス**、**ポータビリティ**の点で大きく異なります。

| 観点                     | 仮想マシン（VM）                                                      | Dockerコンテナ                                                       |
|--------------------------|-------------------------------------------------------------------|--------------------------------------------------------------------|
| **仮想化レイヤー**        | ハイパーバイザーベース（例：KVM、VMware）。VMごとに完全なゲストOS    | OSレベル（Linux namespaces & cgroups）。ホストカーネルを共有           |
| **分離**                 | ハードウェアによる強制。各VMが独自のカーネルを実行                    | プロセスレベル。PID、NET、MNT、IPC、UTS、USER名前空間                 |
| **起動時間**             | 数分                                                               | ミリ秒から秒単位                                                     |
| **イメージサイズ**        | ギガバイト（完全なOSイメージ）                                        | メガバイト（必要なレイヤーのみ）                                       |
| **リソースオーバーヘッド**  | 高い—ゲストOSがCPU、メモリ、ディスクを使用                            | 低い—ゲストカーネルなし、最小限のランタイムフットプリント                |
| **OS互換性**             | 異なるOSファミリーを同時にホスト可能（例：Linux上のWindows）            | ホストと同じカーネルファミリー（ほとんどがLinux専用）                     |
| **I/Oパフォーマンス**      | 仮想デバイス（vNIC、vDisk）を介して仲介される                          | ネイティブに近い。オプションの制限付きでホストデバイスに直接アクセス         |
| **更新と管理**            | VMごとに完全なOSパッチ適用                                            | レイヤー化されたイメージ。共通レイヤーを再利用し、高速な更新とロールバック    |
| **ポータビリティ**         | 大きなイメージ。移行が遅い                                            | 軽量なレジストリ。どのDockerホストでも同一の動作                         |

### 4.1 VMを選ぶべき場合

- **混合OS環境**：Linuxホスト上でWindows、BSD、その他の非Linuxゲストが必要な場合。
- **最大限の分離**：厳格なハードウェア分離を必要とする高セキュリティ、マルチテナントのユースケース。
- **レガシーアプリケーション**：カスタムカーネルに依存する、または完全なOS制御を期待するアプリ。

### 4.2 コンテナを選ぶべき場合

- **マイクロサービス**：独立してビルド、出荷、スケールできる小さな単一目的のサービス。
- **CI/CDパイプライン**：開発から本番まで再現可能なビルド環境。
- **リソース効率**：最小限のオーバーヘッドと超高速起動でホストの使用率を最大化。
- **DevOpsワークフロー**：イメージレイヤリング、バージョン管理されたレジストリ、ComposeやKubernetesなどのオーケストレーションツールを活用。

### 4.3 今後のトレンド
- **コンテナとVMの収束**
  セキュリティへの懸念が高まるにつれ、強力な分離とコンテナの俊敏性を組み合わせるため、軽量VM内でコンテナを実行するハイブリッドアプローチ（例：Kata Containers、Firecracker）が登場しています。
- **ユニカーネルとマイクロVM**
  AWS Firecracker（マイクロVM）やMirageOS（ユニカーネル）のようなプロジェクトは、ゲストOSを最小限に削ぎ落とし、ミリ秒単位の起動と最小の攻撃面を提供します。サーバーレスやエッジワークロードに理想的です。
- **サーバーレスと関数サンドボックス**
  長時間実行されるコンテナを超えて、サーバーレスプラットフォームはマイクロVMやセキュアなコンテナサンドボックスによる分離へと移行し、きめ細かな課金とゼロへのスケールを可能にしています。
- **宣言的インフラストラクチャとGitOps**
  Infrastructure as Codeツール（Terraform、Pulumi）やGitOpsワークフローは、コンテナクラスタとVMフリートの両方を統合されたバージョン管理された方法で管理するようになっています。
- **エッジとIoTのデプロイ**
  軽量なフットプリントへのニーズが、エッジデバイスに最適化されたコンテナランタイムを推進する一方、マイクロVMはマルチテナントIoTゲートウェイでの分離を保証します。
- **設計によるセキュリティ**
  ランタイムの堅牢化（rootlessコンテナ、seccomp、gVisor）、イメージの来歴（in-toto、Sigstore）、サプライチェーン管理が、VMとコンテナの両方のパイプラインで標準になりつつあります。

これらのトレンドは総じて、**VM**、**コンテナ**、**マイクロVM**、**ユニカーネル**が共存するエコシステムを指し示しています。それぞれが、分離、パフォーマンス、管理性の適切なバランスを求めるワークロードに応じて活用されます。

## 5 コンテナのベストプラクティス
Dockerコンテナ（またはOCI準拠のランタイム）を扱う際、以下のベストプラクティスに従うことで、より信頼性が高く、安全で、保守しやすいイメージとデプロイを構築できます：

1. **コンテナごとに1プロセス**
   - 単一のメインプロセスをフォアグラウンドで実行する。
   - サイドカー（ログコレクター、プロキシ）が必要な場合は、別のコンテナを使用し、Docker ComposeやKubernetesで連携させる。
2. **最小限のベースイメージを使用する**
   - スリムまたは「distroless」イメージ（例：`alpine`、`gcr.io/distroless/base`）を選び、攻撃面とイメージサイズを削減する。
   - マルチステージビルドを活用し、あるステージでアプリケーションをコンパイルし、ランタイム成果物のみを最終ステージにコピーする。
3. **依存関係とイメージタグを固定する**
   - OSパッケージと言語ランタイムの正確なバージョンを指定する（`apk add openjdk21-jre=21.0.0-r0`）。
   - 本番環境では`latest`タグを避け、不変のタグまたはダイジェストを使用する（`alpine:3.22` → `alpine@sha256:…`）。
4. **Dockerfileのレイヤーを賢く構成する**
   - 頻繁に変更されるもの（アプリケーションコード）を下部にまとめ、キャッシュによってリビルド速度を最大化する。
   - 長期間変わらない依存関係（システムライブラリ、言語ランタイム）を早期のレイヤーに分離する。
5. **コンテナの権限を制限する**
   - rootとして実行しない。非rootユーザーを作成して切り替える（`RUN addgroup app && adduser -S -G app app`）。
   - Dockerのユーザー名前空間リマッピングを有効にするか、セキュリティプロファイル（AppArmor、SELinux）を使用する。
6. **リソース制約を設定する**
   - コンテナがホストを独占しないようにCPU、メモリ、I/Oの制限を定義する（`--cpus`、`--memory`、`--blkio-weight`）。
   - Kubernetesでは、すべてのPod仕様に`requests`と`limits`を使用する。


[1]: [Docker static pkg](https://download.docker.com/linux/static/stable/)