# ADX API

## Usage

```typescript
import API from '@adxp/api'

const client = API.service('http://example.com')

// xrpc methods
const res1 = await client.com.atproto.repoCreateRecord(
  {did: alice.did, type: 'app.bsky.post'},
  {
    $type: 'app.bsky.post',
    text: 'Hello, world!',
    createdAt: (new Date()).toISOString()
  }
)
const res2 = await client.com.atproto.repoListRecords({did: alice.did, type: 'app.bsky.post'})

// repo record methods
const res3 = await client.app.bsky.post.create({did: alice.did}, {
  text: 'Hello, world!',
  createdAt: (new Date()).toISOString()
})
const res4 = await client.app.bsky.post.list({did: alice.did})
```

## License

MIT
