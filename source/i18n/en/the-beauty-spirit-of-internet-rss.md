---
title: The Beauty of the Internet Spirit - RSS and RSSHub
category: Tech
tag: Internet
date: 2026-08-08T15:25:28+08:00
---


## Bound to Be Born, Destined to Decline
The Internet spirit—what a beautiful phrase. Every word crowned with the name "spirit" evokes, upon hearing it, a vision of a radiant future, a pure utopia. And the Internet spirit is far more than the superficial name of "spirit"; its core and practice of "openness, freedom, collaboration, and sharing" shaped the golden age of the Internet.

Compared with the movements of intellectual liberation and knowledge dissemination in human history, the birth of the Internet spirit shares a strikingly similar origin—one could almost say it is history replayed in the digital age. The Free Software Movement is a social movement that promotes users' rights to use, copy, study, modify, and distribute software, with its ultimate ideal being the liberation of every person (computer user) on the network. Countless free spirits, like the craftsmen who built cathedrals in the Middle Ages, constructed the edifice of the Internet brick by brick. The "crowdsourcing" model of open-source code unifies the sharing of ideas with the sharing of productivity, echoing the Enlightenment's core principle that "knowledge is power, and power should belong to the public."

In its early days, the Internet's development was limited by a relatively high barrier to entry, and its users were mostly highly educated and intellectual people who were subjectively anti-authority and anti-tyranny, unwilling to be manipulated by centralized power (big corporations). In the computing field, they hoped to realize "technological anarchism," so that every computer user would possess free rights rather than having them concentrated at a single point.

At bottom, free will is merely a byproduct of biological genetic diversity; in essence, it is the brain's suppression of primal instincts. Biological genetic diversity, whose evolutionary goal is survival and reproduction, corresponds to organisms' instinct to pursue advantage and avoid harm. The Internet spirit is both inevitable and contingent—inevitable in that, as development proceeds, there will always be someone who believes in and pursues it; contingent in that only a minority will ever be willing to pay the price for it.

The birth of the Internet spirit propelled the Internet's flourishing development, enabling the general public to use computers and enjoy the conveniences of the Internet. Yet facts have proven that requiring every individual to bear the costs of the Internet spirit—delayed gratification, enduring uncertainty, and paying coordination costs—is ultimately a castle in the air. Commercial capital, following the underlying code of laziness and comfort etched deep into human nature, boiled the frog in warm water, brewing it slowly, using candy to guide users into the little fenced-off plots they had carved out.

Every one of the core tenets of "openness, freedom, collaboration, and sharing" dances on the nerves of commerce. Undoubtedly, the Internet spirit harms the interests of commercial capital at every moment. This is an Oedipal destiny: those giant commercial platforms (Google, Meta) are precisely the early products of the Internet spirit, built upon open TCP/IP, open-source code, and global collaboration. But once they grew into the Internet's centers, in order to survive and report earnings, they inevitably had to betray the spirit of openness and erect closed barriers.

I have an amusing story too. Last year I attended a company event to visit an AI research institute in a certain district. At the lecture at the end of the event, the speaker, discussing the gap between Chinese and American LLM models, lamented with great pain that a large part of the reason was the abundance of garbage on the Chinese Internet and the scarcity of high-quality training data. Hearing this, I found it both a little humorous and a little ironic: "You can't only love this Internet when you're enclosing land on it to make money." Wasn't the ethos of "openness, equality, and sharing" in the early Chinese Internet destroyed precisely by you commercial companies? The most humorous example is none other than Baidu's repeated large-scale wiping of Tieba data—a glaring display of shortsightedness—and reality has proven that among BAT, only Baidu has grown ever more marginalized. And now, as Internet development hits a bottleneck but LLM AI is rising on a massive scale, they actually have the nerve to blame the Chinese Internet for failing to provide them with high-quality data—absurd to this degree. So I'd like to ask: how was all the garbage data now flooding the Internet produced, and who guided it to this state?

> BTW, the speaker was also wrong about one thing. This year's development of Chinese LLMs has also proven that the inability to produce high-performance LLMs is purely because they're incompetent (including ByteDance, Tencent, and a certain Huawei—sorry, this is the only company I dare not name directly), and has nothing whatsoever to do with what the Chinese Internet is like.

## The Beauty of RSS Lies in Sharing
RSS (Really Simple Syndication) was born in the Web 1.0 era, aiming to let users freely subscribe to and aggregate information updates from different sources through a single reader, without visiting each website one by one. Although it possesses only an extremely concise protocol, it **openly** and **equally** distributes content to all subscribers, co-building and sharing human knowledge and cognition, perfectly embodying the ever-renewing Internet spirit of "freedom through openness, free collaboration through freedom, sharing through collaboration, and openness through sharing."

But clearly, RSS is the extreme opposite of the commercial Internet's land-grabbing. RSS is open and decentralized; its mode of bypassing websites to directly obtain content without advertisements cannot bring traffic or advertising revenue to commercial companies, and so it was naturally marginalized. At present, some systems maintained by companies/organizations/individuals still support distributing content via RSS, but even more content is isolated by the commercial Internet—not only unsupported for free distribution, but strictly guarded by anti-scraping measures.

This blog mainly aims to introduce a complete RSS architecture that is self-deployable and capable of freely distributing everything. It mainly includes:
- Content that natively supports the RSS/Atom protocol;
- Content that does not support free distribution;
- A secure self-deployed architecture;

### How to Distribute Content
[RSSHub](https://docs.rsshub.app/zh/) claims to be the world's largest RSS network, with the goal that everything can be RSS. RSSHub only needs the corresponding route to be written to convert content within various companies' walled gardens into RSS feeds, which are then handed off to an RSS reader for browsing.

Using the official RSSHub may trigger the anti-scraping strategies of the companies that own the content, so self-deployment is the more recommended approach. Based on the official deployment documentation, I've made some simplifications to minimize self-deployment pressure while improving performance and ease of deployment.

I personally recommend using `docker-compose` to deploy RSSHub, and using `redis` caching to improve the experience. Whether to deploy `browserless/chrome` depends on individual needs.

The `docker-compose.yaml` without `browserless/chrome` is as follows:
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

If you need `browserless/chrome`, you can refer to the official yaml, and remember to allow cross-origin:
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

Make sure the server has `docker`/`podman` installed, then run:
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

`docker`/`podman` will automatically pull the missing images. Pulling images in China requires a VPN or a mirror site. It is recommended to use the image acceleration provided by cloud service providers or [public-image-mirror](https://github.com/DaoCloud/public-image-mirror).

After installing RSSHub, you can route content through your self-deployed instance. As for generating RSS feeds, it is recommended to install the official browser extension [RSSHub Radar](https://addons.mozilla.org/zh-CN/firefox/addon/rsshub-radar/). It can scan the current webpage content, detect available routes, and then generate the corresponding RSS feed.
[![RSSHub-Radar.png](https://i.postimg.cc/d11zYfjX/RSSHub-Radar.png)](https://postimg.cc/f3GH7BFj)

To use your personal instance, you need to replace the domain of the generated link with the address of your self-deployed instance. For example, the generated RSS feed `https://rsshub.app/zhihu/people/activities/61-8-91-53-69` should be replaced with `http://[ip]:1200/zhihu/people/activities/61-8-91-53-69`.

### RSS Reader
> *Miniflux is a minimalist and opinionated feed reader.*

For a self-deployed RSS reader, `miniflux` is recommended. It doesn't have too many fancy features, *for content for simple*, perfectly following the philosophy of **Less is more**.

My server's OS is `Debian`, so it can be installed directly via the package manager:
```bash
# add apt source
sudo echo "deb [trusted=yes] https://repo.miniflux.app/apt/ * *" | sudo tee /etc/apt/sources.list.d/miniflux.list > /dev/null

# update apt
sudo apt update

# install miniflux
sudo apt install miniflux
```

`miniflux` depends on PostgreSQL (version 11 or above; using pg rather than mysql is a plus). Installing `miniflux` will automatically create miniflux.service, which can be managed via `systemctl`. Its configuration file is `/etc/miniflux.conf`.

After installation, `miniflux` needs to be configured, and nginx SSL should be used to proxy the `miniflux` service to ensure security. Configure `/etc/miniflux.conf` as follows, where the pg password and domain need to be changed:
```conf
# See https://miniflux.app/docs/configuration.html

RUN_MIGRATIONS=1
PORT=18080
DATABASE_URL=user=postgres password=[pwd] dbname=miniflux2 sslmode=disable
BASE_URL=https://[domain]/miniflux
```

Add the nginx proxy for `miniflux`:
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

Finally, create an admin account for `miniflux`.
```bash
# Ensure pg is running properly, the account and password are configured, and the database miniflux2 has been created
# restart miniflux
sudo systemctl restart miniflux

# create admin user
miniflux -create-admin
Enter Username: ****
Enter Password: ****
```

Finally, visit `https://[domain]/miniflux` and you can use `miniflux` normally. Add feeds (RSS, Atom, RSSHub) within `miniflux`, and you can see the subscribed content in `miniflux`. Final result picture:

[![miniflux-rsshub.png](https://i.postimg.cc/SKTD4xsP/miniflux-rsshub.png)](https://postimg.cc/bGnQH810)

If you need mobile access, besides the browser, you can also use third-party applications; refer to [Third-Party Applications](https://miniflux.app/docs/apps.html) for details.

Links:
- [RSSHub official documentation](https://docs.rsshub.app/zh/)
- [miniflux official documentation](https://miniflux.app/index.html)