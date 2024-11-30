# @atproto/repo: Repository and MST

TypeScript library for atproto repositories, and in particular the Merkle Search Tree (MST) data structure.

[![NPM](https://img.shields.io/npm/v/@atproto/repo)](https://www.npmjs.com/package/@atproto/repo)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

Repositories in atproto are signed key/value stores containing CBOR-encoded data records. The structure and implementation details are described in [the specification](https://atproto.com/specs/repository). This includes MST node format, serialization, structural constraints, and more.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
