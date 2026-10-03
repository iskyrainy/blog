---
title: 互联网精神之美-RSS和RSSHUB
category: Tech
tag: Internet
date: 2026-08-08T15:25:28+08:00
---


## 必将诞生，终将没落
互联网精神，多美好的词。每一个冠以“精神”之名的词，在听到的时候就仿若能看到一片璀璨的未来，纯洁的理想国。而且互联网精神远不止表面的“精神”之名，其“开放，自由，协作，共享”的内核和实践塑造了互联网的黄金年代。

与人类历史上的思想解放与知识普及运动相较而言，互联网精神的诞生有着异曲同工之处，几乎可以说是历史在数字时代的重放。自由软件运动 (Free Software Movement)是一个推广用户有使用、复制、研究、修改和分发软件等权利的社会运动，运动的终极理念在于解放网络中的每个人 (计算机用户)。无数自由者像中世纪修建教堂的工匠一样，一砖一瓦构建互联网大厦。开源代码的“众包”模式把思想共享与生产力共享统一起来，这与启蒙运动“知识即力量，力量应归公众”的内核如出一辙。

早期互联网发展限于较高的准入门槛，用户大多为高知高教人群，他们主观上反权威反专制，不愿被中心化权利(大公司)操纵。其在计算机领域希冀实现“技术无政府主义”，使每个计算机使用者都拥有自由权利而非集中于一点。

说到底自由意识只算是生物基因多样性的副产品，其本质上是大脑对原始本能的抑制。而生物学上的基因多样性，其演化目标是生存与繁殖，与之对应的是生物本能地趋利避害。互联网精神既是必然又是偶然，必然在随着发展总会有人信仰追求它，偶然在只会有少数人愿意为之付出代价。

互联网精神的诞生推动了互联网蓬勃发展，使普罗大众都可以使用计算机并享受互联网的便利。然而事实证明要求每个个体都承受互联网精神的代价-延迟满足、承受不确定性、付出协调成本，终究是镜花水月。商业资本顺着刻在人类天性深处懒惰安逸的底层代码，温水煮青蛙，慢慢炮制，用糖果指引用户走入它们圈划的一亩三分地。

“开放，自由，协作，共享”的内核每一个都在商业的神经上跳舞。毫无疑问，互联网精神每时每刻都在损害商业资本的利益。这是俄狄浦斯般的宿命，那些巨大的商业平台(Google、Meta)正是互联网精神的早期产物，它们利用开放的TCP/IP、开源代码和全球协作建立起来。但当它们成长为互联网中心后，为了生存和财报，必然要背叛开放精神，制造封闭壁垒。

我这还有个有趣的故事，去年参加公司活动去某区人工智能研究院参访。活动最后的演讲会上，主讲人谈及中美LLM模型的差距，痛心疾首地表示很大一部分的原因是因为中文互联网上垃圾太多而少有高质量训练资料。闻言我只觉得有些幽默又有点讽刺，“你不能只在在互联网上圈地赚钱的时候喜欢这个互联网”。古早中文互联网“开放平等共享”的风气不就是被你们这些商业公司摧毁了吗？其中最幽默的例子莫过于百度数次大规模清空贴吧数据，鼠目寸光可见一斑，现实事实也证明BAT中唯有百度愈发没落。而现在互联网发展遇到瓶颈但LLM AI大规模兴起，居然还好意思来责怪中文互联网无法给你们提供高质量数据，荒唐至此。那我想问现在互联网上充斥的垃圾数据都是怎么产生的，又由谁引导至如此的？

> BTW，主讲人还有一点也错了，今年中国LLM发展情况也证明了，做不出来高性能LLM纯粹是因为菜(包括字节腾讯还有某为，抱歉唯有这家公司我不敢直呼其名)，而和中文互联网是怎样没有半点关系。

## RSS之美，在于共享
RSS(Really Simple Syndication，简易内容聚合)诞生于Web 1.0时代，旨在让用户无需逐个访问网站，就能通过一个阅读器自由订阅和聚合来自不同来源的信息更新。它虽然仅拥有极简洁的协议内容，却**开放**、**平等**地使内容分发给所有订阅者，将人类的知识和认知共享共建，完美诠释了“因开放而自由，自由带来自由协作，协作产生最后又共享，共享又带来开放”的生生不息的互联网精神。

但显然RSS是商业互联网跑马圈地的极端对立面。RSS开放且去中心化，其绕过网站直接获取内容且不带广告的模式，无法为商业公司带来流量和广告收入，自然而然地被边缘化。目前仍有一部分公司/组织/个人维护的系统支持通过RSS分发内容，但还有更多的内容被商业互联网隔离，不仅不支持自由分发内容，还严格使用反爬虫隔离数据。

这篇博客主要想介绍一整套可自部署、可自由分发万物的RSS架构。主要包括：
- 原生支持RSS/Atom协议的内容；
- 不支持自由分发的内容；
- 安全的自部署架构；

### 如何分发内容
[RSSHub](https://docs.rsshub.app/zh/)号称是世界上最大的RSS网络，其目标是万物皆可RSS。RSSHub只需要通过编写对应的路由就可以将各公司围墙花园内的内容转为RSS订阅源，然后转交给RSS阅读器进行阅览。

使用官方的RSSHub，可能会触发内容归属公司的反爬策略，因此自部署是比较推荐的方式。根据官方部署文档，我做了一些精简，尽量减少自部署压力并提高性能和部署简易度。

我个人推荐使用`docker-compose`进行部署RSShub，并使用`redis`缓存来提升使用体验，根据个人需求来选择是否部署`browserless/chrome`。

无`browserless/chrome`的`docker-compose.yaml`如下：
```bash
services:
    rsshub:
        image: diygod/rsshub # or ghcr.io/diygod/rsshub
        restart: always
        ports:
            - '1200:1200'
        environment:
            ALLOW_ORIGIN: '*'
            NODE_ENV: production
            CACHE_TYPE: redis
            REDIS_URL: 'redis://redis:6379/'
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:1200/healthz']
            interval: 30s
            timeout: 10s
            retries: 3
        depends_on:
            - redis

    redis:
        image: redis:alpine
        restart: always
        volumes:
            - redis-data:/data
        healthcheck:
            test: ['CMD', 'redis-cli', 'ping']
            interval: 30s
            timeout: 10s
            retries: 5
            start_period: 5s

volumes:
    redis-data:

```

如果需要`browserless/chrome`可以参考官方提供的yaml，记得允许跨域：
```bash
services:
    rsshub:
        # two ways to enable Playwright:
        # * comment out marked lines, then use this image instead: diygod/rsshub:chromium-bundled
        # * (consumes more disk space and memory) leave everything unchanged
        image: diygod/rsshub # or ghcr.io/diygod/rsshub
        restart: always
        ports:
            - '1200:1200'
        environment:
            ALLOW_ORIGIN: '*'
            NODE_ENV: production
            CACHE_TYPE: redis
            REDIS_URL: 'redis://redis:6379/'
            PLAYWRIGHT_WS_ENDPOINT: 'ws://browserless:3000' # marked
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:1200/healthz']
            interval: 30s
            timeout: 10s
            retries: 3
        depends_on:
            - redis
            - browserless # marked

    browserless: # marked
        image: browserless/chrome # marked
        restart: always # marked
        ulimits: # marked
            core: # marked
                hard: 0 # marked
                soft: 0 # marked
        healthcheck: # marked
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/pressure'] # marked
            interval: 30s # marked
            timeout: 10s # marked
            retries: 3 # marked

    redis:
        image: redis:alpine
        restart: always
        volumes:
            - redis-data:/data
        healthcheck:
            test: ['CMD', 'redis-cli', 'ping']
            interval: 30s
            timeout: 10s
            retries: 5
            start_period: 5s

volumes:
    redis-data:

```

确保服务器已安装`docker`/`podman`，运行：
```bash
# docker
# up
sudo docker-compose up -d
# down
sudo docker-compose down

# podman
# up
podman compose up -d
# down
podman compose down
```

`docker`/`podman`会自动去拉取缺失镜像。国内拉取镜像需要科学上网或者通过镜像站。推荐使用云服务商提供的镜像加速或者[public-image-mirror](https://github.com/DaoCloud/public-image-mirror)。

安装完RSSHub，便可以通过自部署实例完成对内容的路由。至于生成RSS订阅源，推荐在浏览器安装官方插件[RSSHub Radar](https://addons.mozilla.org/zh-CN/firefox/addon/rsshub-radar/)。它可以扫描当前网页内容，并检测可用路由，然后生成对应RSS订阅源。
[![RSSHub-Radar.png](https://i.postimg.cc/d11zYfjX/RSSHub-Radar.png)](https://postimg.cc/f3GH7BFj)

要使用个人的实例需要将生成链接的域名替换为自部署实例的地址。如生成的RSS订阅源：`https://rsshub.app/zhihu/people/activities/61-8-91-53-69` 替换为 `http://[ip]:1200/zhihu/people/activities/61-8-91-53-69`。

### RSS阅读器
> *Miniflux is a minimalist and opinionated feed reader.*

自部署的RSS阅读器推荐使用`miniflux`。没有太多花哨的功能，*for content for simple*，完美遵循了**Less is more**的哲学思想。

我服务器的OS使用的是`Debian`，可以通过包管理器直接安装：
```bash
# add apt source
sudo echo "deb [trusted=yes] https://repo.miniflux.app/apt/ * *" | sudo tee /etc/apt/sources.list.d/miniflux.list > /dev/null

# update apt
sudo apt update

# install miniflux
sudo apt install miniflux
```

`miniflux`依赖PostgreSQL(版本11及以上，使用pg而非mysql好评)。`miniflux`安装会自动创建miniflux.service，可以通过`systemctl`进行管理。其配置文件为`/etc/miniflux.conf`。

安装完需要对`miniflux`进行配置，并使用nginx ssl代理`miniflux`服务来保证安全。配置`/etc/miniflux.conf`如下，其中pg密码和域名需要进行更改：
```conf
# See https://miniflux.app/docs/configuration.html

RUN_MIGRATIONS=1
PORT=18080
DATABASE_URL=user=postgres password=[pwd] dbname=miniflux2 sslmode=disable
BASE_URL=https://[domain]/miniflux
```

添加nginx对`miniflux`的代理：
```conf
location /miniflux/ {
        add_header Content-Security-Policy upgrade-insecure-requests;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://127.0.0.1:18080/miniflux/;
        proxy_redirect http://127.0.0.1:18080/ /miniflux/;
        proxy_redirect https://$host/ /miniflux/;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
}
```

最后为`miniflux`创建管理员账号。
```bash
# 确保pg正常运行，账号密码已配置，数据库miniflux2已建立
# restart miniflux
sudo systemctl restart miniflux

# create admin user
miniflux -create-admin
Enter Username: ****
Enter Password: ****
```

最后访问`https://[domain]/miniflux`然后就可以正常使用`miniflux`了。在`miniflux`内添加订阅源(RSS, Atom, RSSHub)，就可以在`miniflux`看到订阅的内容。最终效果图：

[![miniflux-rsshub.png](https://i.postimg.cc/SKTD4xsP/miniflux-rsshub.png)](https://postimg.cc/bGnQH810)

如果需要移动端访问，除浏览器外还可以使用第三方应用，具体参考[Third-Party Applications](https://miniflux.app/docs/apps.html)。

Links:
- [RSSHub 官方文档](https://docs.rsshub.app/zh/)
- [miniflux 官方文档](https://miniflux.app/index.html)
