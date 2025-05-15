# AT Protocol Reference Implementation (TypeScript)

Welcome friends!

This repository contains Bluesky's reference implementation of AT Protocol, and of the `app.bsky` microblogging application service backend.

## What is in here?

**TypeScript Packages:**

| Package                                                                       | Docs                                       | NPM                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `@atproto/api`: client library                                                | [README](./packages/api/README.md)         | [![NPM](https://img.shields.io/npm/v/@atproto/api)](https://www.npmjs.com/package/@atproto/api)                 |
| `@atproto/common-web`: shared code and helpers which can run in web browsers  | [README](./packages/common-web/README.md)  | [![NPM](https://img.shields.io/npm/v/@atproto/common-web)](https://www.npmjs.com/package/@atproto/common-web)   |
| `@atproto/common`: shared code and helpers which doesn't work in web browsers | [README](./packages/common/README.md)      | [![NPM](https://img.shields.io/npm/v/@atproto/common)](https://www.npmjs.com/package/@atproto/common)           |
| `@atproto/crypto`: cryptographic signing and key serialization                | [README](./packages/crypto/README.md)      | [![NPM](https://img.shields.io/npm/v/@atproto/crypto)](https://www.npmjs.com/package/@atproto/crypto)           |
| `@atproto/identity`: DID and handle resolution                                | [README](./packages/identity/README.md)    | [![NPM](https://img.shields.io/npm/v/@atproto/identity)](https://www.npmjs.com/package/@atproto/identity)       |
| `@atproto/lexicon`: schema definition language                                | [README](./packages/lexicon/README.md)     | [![NPM](https://img.shields.io/npm/v/@atproto/lexicon)](https://www.npmjs.com/package/@atproto/lexicon)         |
| `@atproto/repo`: data storage structure, including MST                        | [README](./packages/repo/README.md)        | [![NPM](https://img.shields.io/npm/v/@atproto/repo)](https://www.npmjs.com/package/@atproto/repo)               |
| `@atproto/syntax`: string parsers for identifiers                             | [README](./packages/syntax/README.md)      | [![NPM](https://img.shields.io/npm/v/@atproto/syntax)](https://www.npmjs.com/package/@atproto/syntax)           |
| `@atproto/xrpc`: client-side HTTP API helpers                                 | [README](./packages/xrpc/README.md)        | [![NPM](https://img.shields.io/npm/v/@atproto/xrpc)](https://www.npmjs.com/package/@atproto/xrpc)               |
| `@atproto/xrpc-server`: server-side HTTP API helpers                          | [README](./packages/xrpc-server/README.md) | [![NPM](https://img.shields.io/npm/v/@atproto/xrpc-server)](https://www.npmjs.com/package/@atproto/xrpc-server) |

**TypeScript Services:**

- `pds`: "Personal Data Server", hosting repo content for atproto accounts. Most implementation code in `packages/pds`, with runtime wrapper in `services/pds`. See [bluesky-social/pds](https://github.com/bluesky-social/pds) for directions on self-hosting.
- `bsky`: AppView implementation of the `app.bsky.*` API endpoints. Running on main network at `api.bsky.app`. Most implementation code in `packages/bsky`, with runtime wrapper in `services/bsky`.

**Lexicons:** for both the `com.atproto.*` and `app.bsky.*` are canonically versioned in this repo, for now, under `./lexicons/`. These are JSON files in the [Lexicon schema definition language](https://atproto.com/specs/lexicon), similar to JSON Schema or OpenAPI.

**Interoperability Test Data:** the language-neutral test files in `./interop-test-files/` may be useful for other protocol implementations to ensure that they follow the specification correctly

The source code for the Bluesky Social client app (for web and mobile) can be found at [bluesky-social/social-app](https://github.com/bluesky-social/social-app).

Go programming language source code is in [bluesky-social/indigo](https://github.com/bluesky-social/indigo), including the BGS implementation.

## Developer Quickstart

We recommend [`nvm`](https://github.com/nvm-sh/nvm) for managing Node.js installs. This project requires Node.js version 18. `pnpm` is used to manage the workspace of multiple packages. You can install it with `npm install --global pnpm`.

There is a Makefile which can help with basic development tasks:

```shell
# use existing nvm to install node 18 and pnpm
make nvm-setup

# pull dependencies and build all local packages
make deps
make build

# run the tests, using Docker services as needed
make test

# run a local PDS and AppView with fake test accounts and data
# (this requires a global installation of `jq` and `docker`)
make run-dev-env

# show all other commands
make help
```

## About AT Protocol

The Authenticated Transfer Protocol ("ATP" or "atproto") is a decentralized social media protocol, developed by [Bluesky Social PBC](https://bsky.social). Learn more at:

- [Overview and Guides](https://atproto.com/guides/overview) 👈 Best starting point
- [Github Discussions](https://github.com/bluesky-social/atproto/discussions) 👈 Great place to ask questions
- [Protocol Specifications](https://atproto.com/specs/atp)
- [Blogpost on self-authenticating data structures](https://bsky.social/about/blog/3-6-2022-a-self-authenticating-social-protocol)

The Bluesky Social application encompasses a set of schemas and APIs built in the overall AT Protocol framework. The namespace for these "Lexicons" is `app.bsky.*`.

## Contributions

> While we do accept contributions, we prioritize high quality issues and pull requests. Adhering to the below guidelines will ensure a more timely review.

**Rules:**

- We may not respond to your issue or PR.
- We may close an issue or PR without much feedback.
- We may lock discussions or contributions if our attention is getting DDOSed.
- We do not provide support for build issues.

**Guidelines:**

- Check for existing issues before filing a new one, please.
- Open an issue and give some time for discussion before submitting a PR.
- If submitting a PR that includes a lexicon change, please get sign off on the lexicon change _before_ doing the implementation.
- Issues are for bugs & feature requests related to the TypeScript implementation of atproto and related services.
  - For high-level discussions, please use the [Discussion Forum](https://github.com/bluesky-social/atproto/discussions).
  - For client issues, please use the relevant [social-app](https://github.com/bluesky-social/social-app) repo.
- Stay away from PRs that:
  - Refactor large parts of the codebase
  - Add entirely new features without prior discussion
  - Change the tooling or frameworks used without prior discussion
  - Introduce new unnecessary dependencies

Remember, we serve a wide community of users. Our day-to-day involves us constantly asking "which top priority is our top priority." If you submit well-written PRs that solve problems concisely, that's an awesome contribution. Otherwise, as much as we'd love to accept your ideas and contributions, we really don't have the bandwidth.

## Are you a developer interested in building on atproto?

Bluesky is an open social network built on the AT Protocol, a flexible technology that will never lock developers out of the ecosystems that they help build. With atproto, third-party can be as seamless as first-party through custom feeds, federated services, clients, and more.

## Security disclosures

If you discover any security issues, please send an email to security@bsky.app. The email is automatically CCed to the entire team, and we'll respond promptly. See [SECURITY.md](https://github.com/bluesky-social/atproto/blob/main/SECURITY.md) for more info.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
