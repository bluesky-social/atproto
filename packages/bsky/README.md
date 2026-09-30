# @atproto/bsky: Bluesky AppView Service

TypeScript implementation of the `app.bsky` Lexicons backing the https://bsky.app microblogging application.

[![NPM](https://img.shields.io/npm/v/@atproto/bsky)](https://www.npmjs.com/package/@atproto/bsky)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.

## Internal feed-generator routing

Set `BSKY_SEEEMORE_URL` to an AppView-reachable seeemore endpoint and
`BSKY_SEEEMORE_SERVICE_DID` to that generator's DID (for the production
seeemore service, `did:web:discover.bsky.app`). When both are set, feed records
whose generator DID matches use the internal endpoint for skeleton requests,
regardless of the feed publisher. Gated Iris and Iris staging overrides retain
precedence. If either setting is absent, AppView resolves the feed generator's
DID document as before. Remove either setting to roll back internal routing.
