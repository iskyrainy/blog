---
title: Rebuilding My Blog
date: 2026-09-27T22:57:37.754235088+08:00
tag: [Rust]
category: [Tech]
---

## 1 The Old Blog

My old blog was built with `hexo`. `hexo` is very easy to use and also has a fairly rich ecosystem. But I still decided to write a similar static site generator myself to serve my blog, and the reason is fairly simple:
- `hexo` has few native features; many features need to be implemented through plugins, and the quality and security of plugins vary unevenly
- For features that have no plugin implementation, I had to write *nodejs* plugins myself, and I really did not want to write *TypeScript* (forgive me😵)
- Statically generating sites is also quite interesting; why not implement a generator myself that is complete in every way but still compact?

After a marathon lasting a full year, apart from the base theme, the Rust part was written little by little by carving out time, using old-fashioned coding. Eventually I released [`tles` v0.2](https://github.com/iskyrainy/tless/releases/tag/v0.2.1), which satisfies most of my vision.

Using `tokei` to count the lines of code, it is less than 4000 lines, roughly only 10% of `hexo`:

```bash
# v8.1.2
~/workspace/dev/js/hexo$ tokei --type=TypeScript
===============================================================================
 Language            Files        Lines         Code     Comments       Blanks
===============================================================================
 TypeScript            272        33268        26318         1193         5757
===============================================================================
 Total                 272        33268        26318         1193         5757
===============================================================================

# v0.2.1
~/workspace/dev/rust/tless$ tokei --type=Rust
===============================================================================
 Language            Files        Lines         Code     Comments       Blanks
===============================================================================
 Rust                   15         3875         3538           33          304
 |- Markdown            14          228           11          203           14
 (Total)                           4103         3549          236          318
===============================================================================
 Total                  15         3875         3538           33          304
===============================================================================
```

Below is the design of my initial vision features and the journey of thought and choices in some of the implementation.

## 2 Initial Design

### 2.1 Basic Features
Because I had been using `hexo` all along, my initial anchoring goal was `hexo`. The most basic features include:
- Support lightweight markup languages such as Markdown and render them into static `HTML` pages
- Custom themes
- Custom plugins
- Drafts and publishing
- Development API and hot reload
- A simple and easy-to-use command line
- Support for Github Pages deployment

### 2.2 tles Extended Built-in Features
[2.1](#21-basic-features) covers the basic but core features of a static site generator. Overall it is: write Markdown, publish, render HTML. Of course, besides these, I also wanted to build in some very practical features, such as native *SEO* optimization, built-in internationalization, native integration with site analytics, and so on. See the list below for details:
- **Built-in SEO optimization**: Support the Atom protocol, automatically generate `atom.xml` and `sitemap.xml`
- **Built-in LLM internationalization**: In the past, internationalization was not easy to do. Either you repeatedly wrote one blog in multiple languages, but that was too tiring, or you called translation engine APIs, but the machine translation results were unstable. But now in the age of AI LLMs, it is entirely possible to achieve high-level internationalization translation through low-cost APIs🤠
- **Built-in giscus support**: For blogging, the most important thing is sharing and communication
- **Built-in site analytics integration**: Record and analyze site traffic through Google/Bing Analysis or other site analytics tools
- **Private blogs**: Some blogs recording life may not be suitable for public viewing, so I occasionally had this idea, but for static site generators it is still somewhat incompatible
- **Cross-platform frontend**: Write blogs anytime and anywhere through a modern and easy-to-use frontend APP/web

Although there are many ideas, some of them clearly conflict with the nature of static sites, such as *private blogs*. Since it is private, dynamic authentication is definitely required. For development mode it can still be implemented, but if deployed to Github or Cloudflare, then the concept of private no longer exists.

> This part of the functionality is still being conceived to this day. At present, an immature idea is to support only self-hosted blog services, and for static proxies, private blogs are not rendered by default. For more information, please keep an eye on [#20](https://github.com/iskyrainy/tless/issues/20).

## 3 Current Implementation

As of the completion of this blog, all features of [2.1](#21-basic-features) have been implemented. As for the extensions in [2.2](#22-tles-extended-built-in-features), the ones currently completed are:
- [x] Built-in `atom.xml`/`sitemap.xml` generation
- [x] Built-in LLM internationalization
- [x] Built-in giscus support
- [x] Built-in base theme (inspired by [Cloudflare Blog](blog.cloudflare.com/), one of my favorite blogs)

Follow-up development plans:
- Continuously fix bugs encountered during use
- Built-in site analytics integration ([#5](https://github.com/iskyrainy/tless/issues/5))
- Support draft templates ([#21](https://github.com/iskyrainy/tless/issues/21))
- ...

Links:
- [https://github.com/iskyrainy/tless](https://github.com/iskyrainy/tless)
- [https://docs.rs/tles/latest/tles/](https://docs.rs/tles/latest/tles/)