# @atproto/lex-json

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)

JSON encoding and decoding for the AT Protocol [data model](https://atproto.com/specs/data-model), including the `$link` (CID) and `$bytes` representations used by [XRPC](https://atproto.com/specs/xrpc).

Provides `lexParse` / `lexStringify` to go between JSON strings and data-model values, and `jsonToLex` / `lexToJson` to convert already-parsed JSON objects. For the CBOR codec used by repository storage, see [`@atproto/lex-cbor`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-cbor).

This is a building block of [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex), which re-exports it — prefer depending on that package.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
