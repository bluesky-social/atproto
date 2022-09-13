# ADX - Authenticated Data eXperiment

This is a working repository for Bluesky's data protocol which we've termed ADX: the Authenticated Data eXperiment. The "X" stands for "experiment" while the project lives in an early exploratory state.

The `main` branch is in active development and does not yet have documentation. We previously released a demo of our data system.

**You can check it out on the [`data-demo` branch](https://github.com/bluesky-social/adx/tree/data-demo).**

---

**⚠️ This is not production-ready or even alpha software. This project is in active development ⚠️**

---

Please do not try to build anything with this! Interfaces and data structures are likely to radically change, and we took some shortcuts on features still in development (key management, schemas, indexing, to name a few). This experiment is primarily confined to the data & authorization layer with hints at some of the other systems.

We encourage you to [open discussions](https://github.com/bluesky-social/adx/discussions) with any questions or ideas you have. This code is not meant to be perfect or 100% bug free. Therefore, while we're interested to hear about any problems you may run into (in the form of Issues), we will likely leave them for a larger rewrite and may not be resolving them in the near term.

## ℹ️ About this project

To learn more about ADX, see:

- [The Architecture document](docs/architecture.md)
- Specs
  - [Name Resolution](docs/specs/name-resolution.md)
  - [HTTP Routes](docs/specs/http-routes.md)
  - [ADX URI Scheme](docs/specs/adx-uri.md)
- The [Blogpost on self-authenticating data structures](https://blueskyweb.xyz/blog/3-6-2022-a-self-authenticating-social-protocol). 

## 📺 Demo recording

![demo.gif](./docs/img/demo.gif)
