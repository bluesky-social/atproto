# @atproto/space: Permissioned Spaces

TypeScript library for atproto permissioned spaces: the repos that hold a space's records, and the tokens, signatures and MACs used to sync them.

[![NPM](https://img.shields.io/npm/v/@atproto/space)](https://www.npmjs.com/package/@atproto/space)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

A space is a set of permissioned repos, one per writer, governed by the space's authority. Unlike a public repo, a space repo commits to its records with a homomorphic set hash (LtHash) and carries no signature: the repo host authenticates each commit or record to a syncer with a per-request MAC, keyed by a shared secret from a P-256 KEM. Repos and a space's host-side state are serialized as STAR archives.

This package covers:

- Space repo commits, set hashes, and their MACs
- Reading and writing repo and space meta STAR archives
- Delegation tokens, space credentials, and client attestations
- HTTP message signatures that bind a space credential to its audience

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
