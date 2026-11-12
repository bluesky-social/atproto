# @atproto/bsky: Bluesky AppView Service

TypeScript implementation of the `app.bsky` Lexicons backing the https://bsky.app microblogging application.

[![NPM](https://img.shields.io/npm/v/@atproto/bsky)](https://www.npmjs.com/package/@atproto/bsky)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Post view counts

Set `BSKY_POST_VIEW_COUNTS_START_AT` to the UTC launch timestamp (for example,
`2026-12-01T00:00:00Z`) to enable author-only view counts after that time. Leave it
unset to disable serving counts. Only posts with both indexing and sort dates at
or after the cutoff qualify, so importing an older post does not make it eligible.

AppView reads `unique_views` through Atlantis's `GetFeatures` RPC and includes
`viewCount` only at 100 views or more. The optional lookup has a 100ms total budget;
failures omit the count without failing the post response. Deploy compatible
Atlantis instances before enabling serving. The app handles under-18 age hiding;
AppView enforces author-only access.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
