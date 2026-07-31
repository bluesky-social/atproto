# @atproto/lex-cbor

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)

CBOR ([DRISL](https://dasl.ing/drisl.html)) encoding and decoding for the AT Protocol [data model](https://atproto.com/specs/data-model), as used for [repository](https://atproto.com/specs/repository) storage and signing.

```typescript
import { decode, encode, cidForLex } from '@atproto/lex-cbor'

const bytes = encode(someLexValue)
const value = decode(bytes)
const cid = await cidForLex(someLexValue)
```

Part of the [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex) SDK family. Unlike the JSON codec, this package is _not_ re-exported by `@atproto/lex` and must be installed directly.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
