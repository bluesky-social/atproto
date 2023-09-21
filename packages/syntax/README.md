# Syntax

Validation logic for AT identifiers - DIDs, Handles, NSIDs, and AT URIs.

## Usage

```typescript
import { isValidHandle, ensureValidHandle, isValidDid } from '@atproto/syntax'

isValidHandle('alice.test') // returns true
ensureValidHandle('alice.test') // returns void

isValidHandle('al!ce.test') // returns false
ensureValidHandle('al!ce.test') // throws

ensureValidDid('did:method:val') // returns void
ensureValidDid(':did:method:val') // throws
```

## NameSpaced IDs (NSID)

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

## AT URI

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

MIT
