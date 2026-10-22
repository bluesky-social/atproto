# @atproto/bsky: Bluesky AppView Service

TypeScript implementation of the `app.bsky` Lexicons backing the https://bsky.app microblogging application.

[![NPM](https://img.shields.io/npm/v/@atproto/bsky)](https://www.npmjs.com/package/@atproto/bsky)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## HTTP access logging

HTTP request completion logs are retained by default. Set
`BSKY_HTTP_LOG_SUCCESS_SAMPLE_RATE` to a number between `0` and `1` to retain
that fraction of fast, successful completion logs (for example, `0.1` retains
approximately 10%). Sampling never suppresses HTTP errors (status 400 or higher),
response errors, aborted requests, or slow requests. Existing logging enablement
and log-level settings still apply.
Slow requests take at least `BSKY_HTTP_LOG_SLOW_REQUEST_MS` milliseconds, which
defaults to `1000`. Diagnostic logs emitted by request handlers and other
subsystems are unaffected. Invalid sampling or duration values fail startup.
Use request metrics for request counts; sampled access logs are incomplete.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
