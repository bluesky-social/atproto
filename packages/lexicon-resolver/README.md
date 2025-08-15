# @atproto/lexicon-resolver

ATProto Lexicon resolution

[![NPM](https://img.shields.io/npm/v/@atproto/lexicon-resolver)](https://www.npmjs.com/package/@atproto/lexicon-resolver)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Usage

This package may be used to determine the DID authority for a Lexicon based on its NSID, and to resolve a Lexicon from its NSID based on [Lexicon Resolution](https://atproto.com/specs/lexicon#lexicon-publication-and-resolution) from the network. Resolutions always verify the inclusion proof for the Lexicon schema document published to the ATProto network.

```ts
import {
  resolveLexicon,
  resolveLexiconDidAuthority,
} from '@atproto/lexicon-resolver'

// Which DID is the authority over this Lexicon?
const didAuthority = await resolveLexiconDidAuthority('app.bsky.feed.post')
// Resolve the Lexicon document with resolution details
const resolved = await resolveLexicon('app.bsky.feed.post')
/**
 * {
 *   commit: {
 *     did: 'did:plc:4v4y5r3lwsbtmsxhile2ljac',
 *     rev: '3lnlpukgipj2c',
 *     sig: Uint8Array(64),
 *     ...
 *   },
 *   uri: AtUri(at://did:plc:4v4y5r3lwsbtmsxhile2ljac/com.atproto.lexicon.schema/app.bsky.feed.post),
 *   cid: CID(bafyreidgbehqwweghrrddfu6jgj7lyr6fwhzgazhirnszdb5lvr7iynkiy),
 *   nsid: NSID('app.bsky.feed.post'),
 *   lexicon: {
 *     '$type': 'com.atproto.lexicon.schema',
 *     lexicon: 1
 *     id: 'app.bsky.feed.post',
 *     defs: { main: [Object], ... },
 *   }
 * }
 */
```

### With identity caching

Identity data is used in order to fetch and verify record contents. The @atproto/identity package can be used to offer more control over caching and other behaviors of identity lookups.

```ts
import { IdResolver, MemoryCache } from '@atproto/identity'
import { buildLexiconResolver } from '@atproto/lexicon-resolver'

const resolveLexicon = buildLexiconResolver({
  idResolver: new IdResolver({
    didCache: new MemoryCache(),
  }),
})

const resolved = await resolveLexicon('app.bsky.feed.post')
```

### With DID authority override

You may specify a specific DID authority you'd like to use to perform a Lexicon resolution, overriding ATProto's DNS-based authority over Lexicons. This is described in some more detail in [Authority and Control](https://atproto.com/specs/lexicon#authority-and-control).

```ts
import { resolveLexicon } from '@atproto/lexicon-resolver'

const resolved = await resolveLexicon('app.bsky.feed.post', {
  didAuthority: 'did:plc:...',
})
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
