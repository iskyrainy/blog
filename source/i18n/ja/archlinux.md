---
title: Arch Linux
category: Tech
tag: Linux
date: 2025-10-26T10:55:32+08:00
---


# Linuxのインストールと設定
## なぜLinuxなのか？
GNU/Linuxは完全にオープンソースのオペレーティングシステムカーネルであり、私たちが通常「Linux」と呼んでいるものはGNU/Linuxのディストリビューションです<sup>[1]</sup>。
使用できるディストリビューションは数多くあり、Ubuntu、Debian、Fedora、CentOS、Mint、Gentoo、Archなどがあります。しかし、なぜLinuxなのでしょうか？
1. **オープンソース**：先述のとおり、GNU/Linuxカーネルは完全なオープンソースプロジェクトであり、誰でもネットからソースコードを簡単に入手できます。つまり、自分自身でカーネルのソースコードを変更することが可能です。
2. **マルチユーザー**：Linuxはマルチユーザーを最もよくサポートしており、各ユーザーのタスクを簡単に管理・切り替えることができます。
3. **安定性と安全性**：LinuxはUnix<sup>[2]</sup>の優れた安定性と効率性を受け継いでいます。Linuxオペレーティングシステムは、サーバーのハードウェア性能を最大限に引き出すことができます。
4. **素晴らしいエコシステム**：Linuxは豊富なエコシステムを持ち、サーバー、オフィス、開発、エンターテインメントなど様々なニーズに簡単に応えることができます。Linuxはサーバーにも開発にも適しているため、開発者は最初から最後まで同じ基準に従うことができ、これは計り知れない利点です。

このブログでは、Arch Linux（*シンプルで軽量なディストリビューション*）のインストールと設定方法を詳しく説明します。

## インストール
### インストール前の準備
ArchをPCにインストールするには、少なくとも**8GB**のストレージ容量を持つUSBフラッシュドライブを用意する必要があります。
インストールには*ventoy*の使用を推奨します。以下の手順に従ってください：
1. [ventoy download](https://www.ventoy.net/cn/download.html)からventoyをダウンロードする
2. ventoyをUSBデバイスにインストールする<sup>[3]</sup>
3. ミラーサイトからArchのisoをダウンロードする（どこでも構いませんが、ここでは[aliyun-archlinux](https://mirrors.aliyun.com/archlinux/iso/)を使用します）
4. isoファイルをventoyのUSBに入れる

### Archのインストール
USBの準備ができたら、インストールを開始します。
1. PCにUSBを挿入し、PCを起動する
2. BIOSに入り、USBを最初の起動項目に設定し、保存して終了すると、ventoyシステムに入ります
3. リストからArch Linuxの項目を選択し、最初の項目に進んでインストール環境（tty）に入る
    ![arch-1](https://i.postimg.cc/kXkG6QYv/Arch-1.png)
4. 有線ネットワーク環境でのインストールを推奨しますが、[`iwctl`](https://man.archlinux.org/man/iwctl.1)を使用してWi-Fi接続を設定することもできます。最も重要なのは、インストール全体がネットワーク環境で行われることを確認することです
    ![arch-2](https://i.postimg.cc/jdWCSgcF/Arch-2.png)
5. keyringを更新し、archinstallをインストールする：
    ```shell
    pacman -Sy archlinux-keyring
    pacman -S archinstall
    ```
6. [archinstall](https://archinstall.archlinux.page/installing/guided.html)を起動する：
    ```shell
    archinstall
    ```
    **UKI**、**Swap**、**NTP同期**を有効にすることを推奨します。ブートローダーには`systmed`を推奨します。
    1. language（言語）：English
        ![arch-3](https://i.postimg.cc/KvdjkPp5/Arch-3.png)
    2. locale（ロケール）：あなたの地域を選択する
        ![arch-4](https://i.postimg.cc/SNwR261V/Arch-4.png)
        ![arch-5](https://i.postimg.cc/wTSMyX4S/Arch-5.png)
    3. disk config（ディスク設定）：*ブートローダー用に1024MB*、*Linux swap用にメインメモリと同サイズ*、*残りをディスクに*
        ![arch-8](https://i.postimg.cc/SNwR26t0/Arch-8.png)
        ここではディスクに**btrfs**<sup>[4]</sup>の使用を推奨しますが、**ext4**を選択することもできます。
        また、ディスクに2つのサブボリュームを追加します：
        ![arch-7](https://i.postimg.cc/jdG2wHkr/Arch-7.png)
    4. auth（認証）：rootのパスワードを設定し、通常使用するための非rootユーザーを追加します。
        ![arch-9](https://i.postimg.cc/mgCDQP0B/Arch-9.png)
    5. profile（プロファイル）：archinstallは様々なシーン向けに多くのプロファイルを提供しています。ニーズに合ったものを選んでください。
        ![arch-10](https://i.postimg.cc/Cxk1jRWw/Arch-10.png)
    6. application（アプリケーション）：主にBluetoothとオーディオ用
        ![arch-11](https://i.postimg.cc/t4WThsLT/Arch-11.png)
    7. kernel（カーネル）：4つから選択できます。違いは表を参照してください
        | Kernel             | 説明                                                                                                              | 主な目標                                                                        | 長所                                                                                                                               | 短所                                                                                           |
        | ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
        | **linux**          | **メインラインカーネル**。頻繁に更新され、Linus Torvaldsとカーネルチームによって直接維持されています。              | **最新の安定版**カーネルリリースを提供します。                                  | – 最新のハードウェアサポート<br>– 頻繁な更新<br>– 安定性とパフォーマンスの良いバランス                                              | – 時折リグレッションを引き起こす可能性がある<br>– LTSよりやや安定性が劣る                    |
        | **linux-lts**      | **長期サポート**カーネル。長期間（通常2〜6年）維持されます。                                                        | 最先端の機能よりも**安定性と長期的な信頼性**を優先します。                       | – 非常に安定<br>– リグレッションが少ない<br>– サーバー、本番システム、古いハードウェアに最適                                                | – 新しいハードウェアサポートの受信が遅い<br>– 最近のカーネル改善の一部が欠けている             |
        | **linux-hardened** | **追加のセキュリティ強化パッチ**を適用したカーネル変種。コミュニティとArchメンテナーによって開発されています。     | **セキュリティと攻撃対象領域の削減**に焦点を当てています。                      | – 強化されたセキュリティ（例：より厳格なメモリ保護、カーネルエクスプロイトへの対策）<br>– セキュリティを重視するシステムに最適 | – わずかなパフォーマンスオーバーヘッド<br>– 一部の機能やドライバが制限または非互換になる可能性がある |
        | **linux-zen**      | **デスクトップのパフォーマンスと応答性**に調整されたカーネル。Zenカーネルプロジェクトによって維持されています。     | **低レイテンシ**とスムーズなデスクトップ体験のために最適化されています。        | – より良いインタラクティブ性と応答性<br>– デスクトップとゲーミングのパフォーマンス改善                                              | – メインラインよりやや安定性が劣る<br>– サポート期間が短い<br>– サーバーには理想的ではない      |
        
        ![arch-12](https://i.postimg.cc/Z5pRrW15/Arch-12.png)
    8. network（ネットワーク）：NetworkManagerの使用を推奨します
        ![arch-13](https://i.postimg.cc/rwxmSDvz/Arch-13.png)
    9. pkgs（パッケージ）：`linux-zen`を使用する場合、`linux-zen-header`を追加する必要があります
        ![arch-14](https://i.postimg.cc/dVr18hzL/Arch-14.png)
    10. timezone（タイムゾーン）：あなたの地域を選択する
        ![arch-15](https://i.postimg.cc/13wtp8LV/Arch-15.png)
7. Arch Linuxに入り、systemdのブート項目を設定する：
    ```shell
    # Arch Linuxに入る
    arch-chroot /mnt
    
    # インストールと設定
    bootctl install
    bootctl list
    exit

    # 再起動
    reboot
    ```
これで、すべてのインストールが完了しました。

## 設定
TTY<sup>[5]</sup>は、サービスや開発のあらゆる機能要件を完全に満たすことができますが、ほとんどの人にとって、GUIは間違いなく使いやすさと効率のバランスを取るものです。
> 中国本土にいる場合、ロックを回避するために何らかの方法を使用する必要があるかもしれません

### Gnome/KDE
GNOME/KDEはほとんど設定が不要で、すべての基本機能がすぐに使えます。もちろん、プラグインをインストールしてシステムをカスタマイズしたり、機能を強化したりすることもできます。

### Hyprland
[Hyprland](https://github.com/hyprwm/Hyprland)は、見た目を犠牲にしない100%独立した動的タイル型Waylandコンポジタです。
スタック型ウィンドウ管理と比較して、タイル型ウィンドウ管理は、画面の隅々まで最大限に活用し、より多くの情報を提供できるという利点があります。

現在、完全で成熟したHyprland設定ソリューションが多数あります。例えば、[HYDE](https://github.com/HyDE-Project/HyDE)、[Omarchy](https://omarchy.org/)などです。
ここでは[end_4 hyprland dotfiles](https://github.com/end-4/dots-hyprland)を推奨します：
```shell
# このコマンドを実行してend_4 hyprland dotfilesをインストール
bash <(curl -s https://ii.clsty.link/get)
```

### Niri
[Niri](https://github.com/YaLTeR/niri)も動的タイル型Waylandコンポジタの一種ですが、Hyprlandとは異なります。
Niriでは、ユーザーが現在のウィンドウを水平方向に無制限に拡張できます。さらに、Niriはグローバルな動的ウィンドウプレビューを提供し、ユーザーが使用中のウィンドウを簡単に切り替えられるようにします。
Niriの無限拡張を一度体験すると、Hyprlandのウィンドウ体験は著しく見劣りすることは言うまでもありません。
![niri-preview](https://i.postimg.cc/C57FXq2H/niri-preview.png)

Niriの簡単な設定を以下に示します：
```kdl
environment {
    QT_QPA_PLATFORM "wayland;xcb"
    QT_QPA_PLATFORMTHEME "qt6ct"
    QT_WAYLAND_DISABLE_WINDOWDECORATION "1"
    DISPLAY ":0"
}
input {
    keyboard {
        xkb {
        }
        numlock
    }
    touchpad {
        tap
        natural-scroll
    }

    warp-mouse-to-focus
    focus-follows-mouse max-scroll-amount="100%"
}
output "HKC OVERSEAS LIMITED OG27QK 0000000000000" {
    mode "2560x1440@120.000"
    scale 1
    transform "normal"
    position x=0 y=0
}

layout {
    background-color "transparent"
    gaps 4
    always-center-single-column
    center-focused-column "never"

    preset-column-widths {
        proportion 0.33333
        proportion 0.5
        proportion 0.66667
    }

    default-column-width { proportion 0.5; }

    focus-ring {
        width 2
        active-color "#7fc8ff"
        inactive-color "#505050"
        active-gradient from="#80c8ff" to="#c7ff7f" angle=45
    }

    border {
        off

        width 4
        active-color "#ffc87f"
        inactive-color "#505050"
        urgent-color "#9b0000"
    }

    shadow {
        on
        draw-behind-window true
        softness 30
        spread 7
        offset x=0 y=5
        color "#0007"
    }

    struts {
        left 4
        right 4
        top 4
        bottom 4
    }
}

spawn-at-startup "waybar"
spawn-at-startup "xwayland-satellite"

prefer-no-csd
screenshot-path "~/Pictures/Screenshots/Screenshot from %Y-%m-%d %H-%M-%S.png"
animations {
    slowdown 1.5
}

window-rule {
    match app-id=r#"^org\.wezfurlong\.wezterm$"#
    default-column-width {}
}

window-rule {
    match app-id=r#"firefox$"# title="^Picture-in-Picture$"
    open-floating true
}

window-rule {
    match app-id=r#"^org\.keepassxc\.KeePassXC$"#
    match app-id=r#"^org\.gnome\.World\.Secrets$"#
    block-out-from "screen-capture"
}

window-rule {
    geometry-corner-radius 15
    clip-to-geometry true
}
```

### fcitx5
中国語の入出力をサポートするには、システムは出力用のフォントと入力用のfcitx5をインストールする必要があります。
```shell
# フォントのインストール
sudo pacman -S noto-fonts-cjk wqy-microhei

# fcitx5のインストール
sudo pacman -S fcitx5-im fcitx5-chinese-addons

# /etc/environmentに環境変数を追加
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS="@im=fcitx"
SDL_IM_MODULE=fcitx
```

fcitx5のさらなる設定については、`fcitx5-configtool`を使用してGUIで設定を更新してください。詳細は[fcitx5](https://wiki.archlinuxcn.org/wiki/Fcitx5)と[簡体字中国語](https://wiki.archlinuxcn.org/wiki/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%E6%9C%AC%E5%9C%B0%E5%8C%96)を参照してください

### NetworkManager
NetworkManagerは、システムがネットワークに自動接続するための検出と設定を提供するプログラムです。`networkmanager`パッケージには、デーモンプログラム、コマンドクライアント（nmcli）、TUIクライアント（nmtui）が含まれています。
```shell
# インストール
sudo pacman -S networkmanager
```

`nmcli`の使用法：
```shell
# Wi-Fiリストの検出
nmcli device wifi list

# Wi-Fiへの接続
nmcli device wifi connect [SSID/BSSID] [password]

# 隠しWi-Fiへの接続
nmcli device wifi connect [SSID/BSSID] [password] hidden yes

# 全ネットワークデバイスの状態を表示
nmcli device

# Wi-Fiをオフにする
nmcli radio wifi off

# 接続情報を表示
nmcli connection show

# 保存された設定で接続
nmcli connection up [name/uuid]

# 保存された設定を削除
nmcli connection delete [name/uuid]
```

### steam
SteamOS<sup>[6]</sup>は、Valveが開発したゲームに焦点を当てたLinuxディストリビューションで、Arch Linuxをベースにしており、同社のビデオゲームストアであるSteamを組み込んでいます。
Valveの[Proton](https://github.com/ValveSoftware/Proton)互換レイヤーのおかげで、Steamライブラリの大多数のゲームがLinuxで実行できます。ゲームの互換性に関する情報は[ProtonDB](https://www.protondb.com/)で入手できます。

以下の手順に従ってArch LinuxにSteamをインストールしてください：
```shell
# PCがIntel CPU + NVIDIA GPUの場合、vulkan-intelを選択；
# PCがAMD CPU/GPUの場合、amdvlkを選択
sudo pacman -S steam

# Steamは現在までX11のみをサポートしているため、Wayland用にxwayland-satelliteをインストールして実行する必要があります
sudo pacman -S xwayland-satellite
```

詳細は[ArchWiki-Steam](https://wiki.archlinuxcn.org/wiki/Steam)を参照してください。

### 音楽プレイヤー
オンライン音楽ストリーミングは、NetEase Cloud MusicやQQ Musicなどの公式プラットフォームを通じて利用できますが、Linuxでの体験は貧弱で、これらのサービスは長期間更新されていません。明らかに、これらの企業はLinuxデスクトップ環境にリソースを投資することを望んでいません。
ここでは、オンラインで音楽を再生するために[YesPlayMusic](https://github.com/qier222/YesPlayMusic)の使用を推奨します。
```shell
# yay/paruでアプリをインストール
paru -S yesplaymusic
```

リンク：
[1]: 詳細は[LinuxとGNUプロジェクト](https://www.gnu.org/gnu/linux-and-gnu.html)を参照
[2]: 1970年代にAT&T研究所のKen Thompson、Dennis Ritchie、その他多くの人々によって開発された革新的または画期的なオペレーティングシステム。詳細は[Unix](https://unix.org/)を参照
[3]: ventoyのインストールは[doc](https://www.ventoy.net/cn/doc_start.html)を参照
[4]: Linux用に開発された最新のコピーオンライト（CoW）ファイルシステムで、高度な機能を提供すると同時に、フォールトトレランス、修復、管理の容易さを重視して設計されています。
[5]: Teletypewriter（テレタイプライター）。現代のUnix系オペレーティングシステムでは、端末デバイスの入出力はttyを介してシステムに渡されます。ttyは端末とシェルの間に位置し、文字ストリームの伝送と基本的な制御を処理して、端末とシェル間の通信を可能にします。
```shell
# コマンドのワークフロー
ユーザー入力/表示
      ↓ 
端末デバイス
      ↓ 
tty（カーネルキャラクタデバイスインターフェース。入力、出力、制御を伝送する）
      ↓ 
Shell（コマンドラインインタプリタ。コマンドを解析して実行する）
      ↓ 
オペレーティングシステムカーネル（コマンドを実行し、リソースを管理する）
```
[6]: 詳細は[SteamOS](https://store.steampowered.com/steamos)を参照