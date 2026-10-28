# @atproto/lex-client

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)
- [`@atproto/lex-rpc` low-level XRPC utilities](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex-rpc/README.md)

Type-safe HTTP ([XRPC](https://atproto.com/specs/xrpc)) client for Lexicon-defined APIs: the `Client` class for working with a user's PDS (records) in the context of an authenticated session.

Authentication is supplied through an `Agent`, implemented by [`@atproto/oauth-client`](https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client) or, for scripts and bots, [`@atproto/lex-password-session`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-password-session).

This is a building block of [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex), which re-exports it -- prefer depending on that package.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
