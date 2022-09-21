# NameSpaced IDs (NSID) API

## Usage

```typescript
import * as nsid from '@adxp/nsid'

const id1 = nsid.parse('com.example.foo')
id1.authority  // => 'example.com'
id1.name       // => 'foo'
id1.toString() // => 'com.example.foo'

const id2 = nsid.create('example.com', 'foo')
id2.authority  // => 'example.com'
id2.name       // => 'foo'
id2.toString() // => 'com.example.foo'

const id3 = nsid.create('example.com', '*')
id3.authority  // => 'example.com'
id3.name       // => '*'
id3.toString() // => 'com.example.*'

nsid.isValid('com.example.foo') // => true
nsid.isValid('com.example.*') // => true
nsid.isValid('example.com/foo') // => false
nsid.isValid('foo') // => false
```

## License

MIT