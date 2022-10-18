# NameSpaced IDs (NSID) API

## Usage

```typescript
import { NSID } from '@atproto/nsid'

const id1 = NSID.parse('com.example.foo')
id1.authority  // => 'example.com'
id1.name       // => 'foo'
id1.toString() // => 'com.example.foo'

const id2 = NSID.create('example.com', 'foo')
id2.authority  // => 'example.com'
id2.name       // => 'foo'
id2.toString() // => 'com.example.foo'

const id3 = NSID.create('example.com', '*')
id3.authority  // => 'example.com'
id3.name       // => '*'
id3.toString() // => 'com.example.*'

NSID.isValid('com.example.foo') // => true
NSID.isValid('com.example.*') // => true
NSID.isValid('example.com/foo') // => false
NSID.isValid('foo') // => false
```

## License

MIT