---
title: A Funny Story About Javaers
category: Tech
tag: Java
date: 2026-08-23T22:31:39+08:00
---

I have to say, Javaers really rarely write asynchronous code. A while ago, I saw the following conversation in a work group chat:

```
A: What's the approximate response time of your API right now? We've currently set a 300-second timeout here, but an excessively long timeout will exhaust the Tomcat threads on our side
B: The longest on my side should be about 100 seconds
A: Then let's lower it to 100s for now
```

"Let's lower it to 100s for now" is nothing more than treating the symptom by chopping off the head. Perhaps it's because Javaers use Spring too much, and the mainstream of Spring is writing synchronous MVC, with few projects using asynchronous frameworks like webflux/vertx/netty, which has caused some Javaers to have a very poor understanding and use of asynchrony.

The problem in the conversation is a typical case of long synchronous blocking exhausting the thread pool's threads and rendering the service unavailable. If this were switched to another native async/await language, such as js/rust, incidents of pool thread exhaustion wouldn't happen because of something like this. Even with golang, using green threads like goroutines, scheduling wouldn't run into this kind of problem.

Surely someone will ask: since Java 21 natively supports virtual threads, why does this kind of problem still occur? Of course, it's because a large number of Java projects are still using Java 8 😇. Jokes aside, using Java 17 already counts as a relatively modern Java project. If the frequency of upgrading the language JDK in projects of other languages (such as go/rust) is like flying in the sky, the speed of upgrading the JDK in Java projects can be said to be like digging underground.