# ADX API

## Usage

```typescript
import API from '@adxp/api'

const client = API.service('http://example.com')

// xrpc methods
const res1 = await client.todo.adx.repoCreateRecord(
  {did: alice.did, type: 'todo.social.post'},
  {
    $type: 'todo.social.post',
    text: 'Hello, world!',
    createdAt: (new Date()).toISOString()
  }
)
const res2 = await client.todo.adx.repoListRecords({did: alice.did, type: 'todo.social.post'})

// repo record methods
const res3 = await client.todo.social.post.create({did: alice.did}, {
  text: 'Hello, world!',
  createdAt: (new Date()).toISOString()
})
const res4 = await client.todo.social.post.list({did: alice.did})
```

## License

MIT
