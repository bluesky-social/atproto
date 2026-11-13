# @atproto/lex-resolver

- [Changelog](./CHANGELOG.md)
- [`@atproto/lex` documentation](https://github.com/bluesky-social/atproto/blob/main/packages/lex/lex/README.md)

Resolves [Lexicon](https://atproto.com/specs/lexicon) documents from the AT Protocol network by [NSID](https://atproto.com/specs/nsid).

```typescript
import { LexResolver } from '@atproto/lex-resolver'

const resolver = new LexResolver({})
const { lexicon, uri, cid } = await resolver.get('app.bsky.feed.post')
```

Resolution looks up the `_lexicon.<authority>` DNS TXT record to find the controlling [DID](https://atproto.com/specs/did), resolves that DID to a PDS, then fetches and cryptographically verifies the Lexicon record. Hooks allow caching at the fetch layer.

Part of the [`@atproto/lex`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex) SDK family, used by [`@atproto/lex-installer`](https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex-installer) to implement `lex install`.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
