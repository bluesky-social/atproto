# ATP API

## Usage

```typescript
import API from '@atproto/api'

const client = API.service('http://example.com')

// xrpc methods
const res1 = await client.com.atproto.repo.createRecord(
  {
    did: alice.did,
    collection: 'app.bsky.feed.post',
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Hello, world!',
      createdAt: (new Date()).toISOString()
    }
  }
)
const res2 = await client.com.atproto.repo.listRecords({did: alice.did, type: 'app.bsky.feed.post'})

// repo record methods
const res3 = await client.app.bsky.feed.post.create({did: alice.did}, {
  text: 'Hello, world!',
  createdAt: (new Date()).toISOString()
})
const res4 = await client.app.bsky.feed.post.list({did: alice.did})
```

## License

MIT
