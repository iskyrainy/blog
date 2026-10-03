---
title: 仕事用PCをWindowsからLinuxに移行する
category: Tech
tag: Linux
date: 2026-04-15T21:18:07+08:00
---


## Not Windows，But Linux
Windowsはアウトオブボックスとエコシステムにおいて間違いなく比類なき存在だ。ユーザーGUI設計は非常に直感的で（Win11を除く）、強力な互換性は他のどのOSも羨望のまなざしで見ることしかできないエコシステムをもたらしている。しかし私はWin11の一部のGUIデザインと強制アップデートが非常に嫌いだ（ちなみに愚痴ると、毎回アップデートで「更新してシャットダウン」を選んでも最後は更新完了後に再起動になる、このバグをMicrosoftも直すつもりはないようだ）。あとWindowsのコマンドターミナルはあまり使い勝手が良くなく、一部の開発シーンではWSLを使う必要がある。しかしWSLは本質的に仮想マシンで、ネットワークなどはすべてホストのWindows上で設定しなければならず、振り出しに戻る。

Windows自体への好みを除いて、もう一つ言わざるを得ない理由であり最大の理由は、会社から支給されたPCでWin11を動かすと本当にカクカクすることだ。10世代i5の*ThinkPad*でJetBrainsのIDEをいくつかプロジェクトを開いて使うと、その効率といったらもう。

そこで私は仕事環境の変更を検討し始めた。現在いくつかの選択肢がある：
1. より高性能なノートPC、Windows LaptopまたはMacBookを購入する；
  - 長所：性能問題をほぼ考える必要がなく、エコシステムが強力で互換性もある
  - 短所：金がかかる
2. Linuxに移行する；
  - 長所：Linuxの設定可能性により、より少ないリソースで済み、間接的に性能問題も解決する。統一的で直接的な開発エコシステム、必要な分だけ使う。
  - 短所：開発以外のオフィス環境、一部の業務ソフトのインストール方法、社内ネットワークへのアクセス方法を考える必要がある

周りにはMacBookを購入して使っている同僚もいるが、MacOSは私から見ればなおさらクソの塊だ。MacOSユーザーから圧縮ファイルを受け取るたびに、中には必ず悪名高い`.DS_Store`が幾重にも入っている 🤮。とにかく1番目はすぐに却下した。仕事のためにわざわざ自腹で仕事用PCを買う？No way.

間違いなく、Linuxは完璧に、いや120%のコード開発効率をもたらすと言える。しかしLinuxは本当に開発以外の日常業務を担えるのだろうか？以下は私が日常業務で遭遇するシナリオだ：
1. メールの送受信；
2. IMソフト、WeChatと社内IMを含む；
3. 社内ネットワークアクセス、社内ネットワーク接続と社内リソースアクセスを含む；
4. ドキュメントの閲覧・編集、word、excel、ppt、pdf、visioを含む；

もしこれらの基本的な点を満たせないなら、Linuxで業務をするのは夢物語だ。

そこで私はまず自宅のPCにOSを入れ直してテストすることにした。自宅のPCには以前Arch Linuxをインストールしていたが、仕事用PCでは絶対にArchは使えない。このローリングリリースはやはり不安定すぎる。それに自宅のArchは私が派手に設定していて、おもちゃとして遊ぶのは確かに非常に面白いが、正直業務で使うならこういう派手なものはあまり好きではない。本題を食いすぎている。最初はFedoraを業務用システムとして使うつもりで、自宅のArchを消してFedora KDE版に入れ替えた。

実は個人的にはRedhat系のOSを使う方が好みだ。一つはLinusがインストールに使っているのがFedoraであること、もう一つはRedhat系がサーバー分野で広く知られており、すでに慣れていることだ。OSを入れ直した後、先ほどの4点を一つずつテストした。

メールのテストは使えるソフトがあるかどうかではなく、むしろWindowsのFoxmailメールを新しいメールクライアントにどう**移行**するかが主だ。BTW、本来メールはすべてメールサーバーに保存されているはずで、新しいメールクライアントへの移行はメールサーバーから取得するだけで済む。しかし会社の網信安部は情報セキュリティのために7日前のメールを自動削除するよう要求している。😅ちょっとユーモアがある。メールをサーバーに保存する方がユーザークライアントに保存するより安全でないなんて？テストではThunderbirdを使い、プラグイン<sup>[1]</sup>をインストールすることでEMLメールのインポートを実現できた。

IMソフトは国産化信創代替の発展のおかげで、ほとんどのIMが一種または複数の信創システムに適応している。WeChat公式はdeb/rpm/AppImage形式のインストールパッケージを提供しており、社内IMもdebインストールパッケージを提供している。FedoraはRedhat系ディストリビューションで、rpmパッケージを使う。私は社内IMのdebパッケージをrpmパッケージに変換し、何度も試したが最後まで正常に動作させられなかった。Linux用のパッケージングは確かに面倒だと感嘆せざるを得ない。Linus本人でさえLinux用のディストリビューションパッケージを作りたがらない。😮‍💨

ドキュメントは最も簡単で、LibreOfficeを選べるだけでなくWPSも使える。ドキュメント業務の使用シーンをほぼ全面的にカバーしている。注意すべきは、一部のLinuxには宋体/仿宋/黒体/楷体などドキュメント業務用の中文字体が標準で入っていないか管理されていないことだ。

最も最も重要な社内ネットワークアクセス。会社が調達した新しいログイン認証サービス360は、Windowsでは問題なく動作する。しかしLinuxでは信創OSのデスクトップ版しかサポートしておらず、Ubuntuなどその他はserver版のみサポートしているようだ。半日試したが今のところ社内ネットワークへの接続に成功していない。😓そのため現在もVirtualBoxのWindows仮想マシン＋VPNで社内ネットワークにアクセスしている。またwinboatもテストした。詳細は後の章で述べる。

> テストの結果、やはりdeb系のサポートの方が良い。

以下はDebian 13への移行の一部の過程だ。👉

## Let's go!
> !!! 新しいシステムをインストールする前に、必ずすべての資料がバックアップされていることを確認してください。

パーティションテーブルを削除し、Debian 13 KDE版をインストール。

### 科学上网
この部分は基本的に言うことはほとんどない。ほとんどのソフトはクロスプラットフォームをサポートしている。例えば*v2rayn*など。debをダウンロードしてインストールし、設定をインポートする。
```bash
sudo apt install ./v2rayN-linux-64.deb
```

### 入力メソッド
間違いなくもちろんfcitx5 + rimeを使う。
```bash
sudo apt install fcitx5-rime

# 詞庫可以選擇万象或者霧凇等
cd $HOME/.local/share/fcitx5
# 以霧凇為例
git clone https://github.com/iDvel/rime-ice.git rime --depth 1
```
まず「キーボード」->「仮想キーボード」で「Fcitx5 Wayland」を選択する。次にKDE settingの「言語と時刻」->「入力メソッド」で、デフォルトの入力メソッドをすべて削除し、rime（中州韻）を追加する。

### フォント
フォントのインストールには英字フォントと中国語フォントが含まれる。
```bash
sudo apt install fonts-roboto fonts-dejavu-core fonts-cantarell fonts-liberation
```

手動インストール部分：
- 英字フォント: [Nerd Font](https://www.nerdfonts.com/)。
- 中国語フォント: [文档全家桶](https://flc.zjnu.edu.cn/2024/1110/c18580a485306/page.htm), 微软雅黑<sup>[2]</sup>。

手動でのフォントインストールは以下の手順で行う：
```bash
sudo apt install fontconfig xfonts-utils
mkdir -p ~/.local/share/fonts

cp /path/to/your/font.tty ~/.local/share/fonts/
cp /path/to/your/font.ttc ~/.local/share/fonts/

chmod 644 ~/.local/share/fonts/*
fc-cache -fv
```

### オフィスソフト
よく使うオフィスソフト：
- [WeChat](https://linux.weixin.qq.com/)
- [QQ](https://im.qq.com/linuxqq/download.html)
- [WPS](https://www.wps.cn/product/wpslinux#)
- [MoeKoe](https://music.moekoe.cn/)
- [listen1_desktop](https://github.com/listen1/listen1_desktop)

インストールパッケージをダウンロードした後、ダウンロードディレクトリで`sudo apt install ./xxx.deb`を実行する

メールはThunderbirdを使用し、`sudo apt install thunderbird`を実行してインストールする。Thunderbirdでメールアカウントを設定した後、ImportExportTools NGプラグインをインストールし、受信トレイを右クリックしてEMLメールのインポートを開始する。

### Virtual VM
私が現在使用しているのはOracle VirtualBoxだ。vboxの仮想化はkvmではなくvboxdrvを通じて行われるが、システムはデフォルトでkvmをロードする。以下のスクリプトでkvmとvboxdrvを素早く切り替える。
```bash
#!/usr/bin/env bash

set -euo pipefail

KVM_MODULE=""
CPU_VENDOR=$(grep -E 'vendor_id' /proc/cpuinfo | head -1)

if [[ $CPU_VENDOR == *"Intel"* ]]; then
    KVM_MODULE="kvm_intel"
elif [[ $CPU_VENDOR == *"AMD"* ]]; then
    KVM_MODULE="kvm_amd"
else
    echo "Unsupported CPU vendor"
    exit 1
fi

is_loaded() {
    lsmod | awk '{print $1}' | grep -qx "$1"
}

load_vbox() {
    echo "[+] Switching to VirtualBox"

    if is_loaded "kvm"; then
        sudo modprobe -r "$KVM_MODULE" kvm
    fi

    sudo modprobe vboxdrv

    echo "[+] VirtualBox modules loaded"
}

load_kvm() {
    echo "[+] Switching to KVM"

    if is_loaded "vboxdrv"; then
        sudo modprobe -r vboxnetadp vboxnetflt vboxdrv || true
    fi

    sudo modprobe kvm
    sudo modprobe "$KVM_MODULE"

    echo "[+] KVM modules loaded"
}

case "${1:-}" in
    vbox)
        load_vbox
        ;;
    kvm)
        load_kvm
        ;;
    *)
        echo "Usage: $0 {vbox|kvm}"
        exit 1
        ;;
esac
```

360セキュリティターミナルは非信創OSをすべてサーバー側と認識してしまう。たとえdesktop版が使えても、使用体験はあまり良くないだろう（デュアルクロスができない）。では両方を兼ね備えた方法はないだろうか？

ある。Winboat<sup>[3]</sup>は理論上、要件を完全に実現できる。winboatはコンテナでWindowsを実行し、RDPプロトコルを通じてWindowsネイティブアプリをLinuxのデスクトップに転送する。

したがって理論上、コンテナ内のWindowsにVPNをインストールして接続し、winboatを使ってWindowsネイティブサービスを利用すれば、既定の要件を達成できる。しかしなぜ「理論上」と言うかというと、WindowsがVPNに接続すると、VPNがLAN通信もブロックしてしまい、winboat APIも無効になるからだ。

VPN接続後にスクリプトを実行するかその他の何らかの方法でLAN通信を正常に保てれば、うまくいくはずだ。後で時間があるときにまたテストしてみる。

### 開発環境
開発環境の設定は人それぞれだ。git cloneする前にdotfilesをローカルに持ってくるのを忘れないように。ただ、国内での開発にミラーサイトは欠かせないだろう、はは。😅
よく使うミラーサイト：
- [阿里雲](https://developer.aliyun.com/mirror/)
- [中科大](https://mirrors.ustc.edu.cn/)
- [清華](https://mirrors.tuna.tsinghua.edu.cn/)
- [docker镜像站-南大](https://doc.nju.edu.cn/books/e1654)
- [docker镜像站-github](https://github.com/dongyubin/DockerHub)

### KDEプラグイン
言わざるを得ないが、デフォルトのKDEは確かに少し美しくない。🤔
おすすめのプラグインいくつか：
- [KdeControlStation](https://store.kde.org/p/2196105): 総合コントロールパネル、ネットワーク/Bluetoothなどを含む
- [Kurve - Audio Visualizer](https://store.kde.org/p/2299506): オーディオビジュアライザー
- [Panel Colorizer](https://store.kde.org/p/2130967)：dockの美化
- [Advanced Weather Widget](https://store.kde.org/p/2349879)：より良い天気ウィジェット

> 少し残念、あまり使いやすい万年暦ウィジェットがないようだ😓

Links:
[1]: [ImortExportTools NG](https://addons.thunderbird.net/zh-CN/thunderbird/addon/importexporttools-ng/?src=hp-dl-mostpopular)
[2]: 最も簡単な方法はWindowsからコピーすること、C:/Windows/Fonts/msyh*.ttc
[3]: Linux上でネイティブにWindowsアプリを使うことを目的としたソフト。詳細は[winboat](https://winboat.app/)を参照。