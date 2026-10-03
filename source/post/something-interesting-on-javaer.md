---
title: 关于Javaer的趣事
category: Tech
tag: Java
date: 2026-08-23T22:31:39+08:00
---

不得不说，javaer是真的很少写异步。前段时间在工作群中看到了下面的对话:

```
A: 现在你们这边接口的返回速度大概在多少？这边现在设置的是300秒的超时时间，但是超时时间过长会把这边的tomcat线程占满
B: 我这边最长应该是100秒
A: 那这边先降到100s
```

"先降到100s"只能算是头痛砍头。也许是因为javaer使用spring太多了，而spring的主流是写同步mvc，少有项目使用webflux/vertx/netty之类的异步框架，所以造成了一些javaer对异步的理解和使用都很差。

对话中的问题是典型的长同步阻塞耗尽线程池线程导致服务不可用。如果换到别的原生异步async/await语言，如js/rust等，也不会因为这种事导致池线程耗尽的事故。即使是golang，使用go协程这种green thread，调度也不会出现这种问题。

那肯定有人要问了，java21开始原生支持virtual thread，为什么还会出现这种问题呢？当然是因为大量的java项目还在使用java8了😇。不开玩笑，使用java17的已经算是比较现代的java项目了。如果说其他语言项目(如go/rust)升级language dk的频次是在天上飞，java项目升级jdk速度可以说是在地下刨了。
