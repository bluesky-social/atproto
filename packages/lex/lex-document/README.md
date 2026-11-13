# @atproto/lex-document

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)

Validation of Lexicon documents themselves — the JSON files written in the [Lexicon schema definition language](https://atproto.com/specs/lexicon).

Where [`@atproto/lex-schema`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-schema) validates _data_ against a schema, this package validates the _schema documents_, and turns them into runtime schemas by resolving refs across documents.

Part of the [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex) SDK family, used by [`lex-builder`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-builder), [`lex-installer`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-installer) and [`lex-resolver`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-resolver).

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
