# @atproto/syntax: validation helpers for identifier strings

Validation logic for [atproto](https://atproto.com) identifiers - DIDs, Handles, NSIDs, and AT URIs.

[![NPM](https://img.shields.io/npm/v/@atproto/crypto)](https://www.npmjs.com/package/@atproto/syntax)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Usage

### Handles

Syntax specification: <https://atproto.com/specs/handle>

```typescript
import { isValidHandle, ensureValidHandle, isValidDid } from '@atproto/syntax'

isValidHandle('alice.test') // returns true
ensureValidHandle('alice.test') // returns void

isValidHandle('al!ce.test') // returns false
ensureValidHandle('al!ce.test') // throws

ensureValidDid('did:method:val') // returns void
ensureValidDid(':did:method:val') // throws
```

### NameSpaced IDs (NSID)

Syntax specification: <https://atproto.com/specs/nsid>

```typescript
import { NSID } from '@atproto/syntax'

const id1 = NSID.parse('com.example.foo')
id1.authority // => 'example.com'
id1.name // => 'foo'
id1.toString() // => 'com.example.foo'

const id2 = NSID.create('example.com', 'foo')
id2.authority // => 'example.com'
id2.name // => 'foo'
id2.toString() // => 'com.example.foo'

const id3 = NSID.create('example.com', 'someRecord')
id3.authority // => 'example.com'
id3.name // => 'someRecord'
id3.toString() // => 'com.example.someRecord'

NSID.isValid('com.example.foo') // => true
NSID.isValid('com.example.someRecord') // => true
NSID.isValid('example.com/foo') // => false
NSID.isValid('foo') // => false
```

### AT URI

Syntax specification: <https://atproto.com/specs/at-uri-scheme>

```typescript
import { AtUri } from '@atproto/syntax'

const uri = new AtUri('at://bob.com/com.example.post/1234')
uri.protocol // => 'at:'
uri.origin // => 'at://bob.com'
uri.hostname // => 'bob.com'
uri.collection // => 'com.example.post'
uri.rkey // => '1234'
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
