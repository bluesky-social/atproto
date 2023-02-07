# ATP API

## Usage

```typescript
import AtpAgent from '@atproto/api'

const agent = new AtpAgent({service: 'https://example.com'})

// provide a custom fetch implementation (shouldnt be needed in node or the browser)
import {AtpAgentFetchHeaders, AtpAgentFetchHandlerResponse} from '@atproto/api'
AtpAgent.configure({
  async fetch(
    httpUri: string,
    httpMethod: string,
    httpHeaders: AtpAgentFetchHeaders,
    httpReqBody: any,
  ): Promise<AtpAgentFetchHandlerResponse> {
    // insert definition here...
    return {status: 200, /*...*/}
  }
})
```

### Session management

```typescript
import AtpAgent, {AtpSessionEvent, AtpSessionData} from '@atproto/api'
const agent = new AtpAgent({
  service: 'https://example.com',
  persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) {
    // store the session-data for reuse 
  }
})

await agent.login({identifier: 'alice@mail.com', password: 'hunter2'})
await agent.resumeSession(savedSessionData)
await agent.createAccount({
  email: 'alice@mail.com',
  password: 'hunter2',
  handle: 'alice.example.com'
})
```

### API calls

```typescript
// xrpc methods
const res1 = await agent.api.com.atproto.repo.createRecord(
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
const res2 = await agent.api.com.atproto.repo.listRecords({did: alice.did, type: 'app.bsky.feed.post'})

// repo record methods
const res3 = await agent.api.app.bsky.feed.post.create({did: alice.did}, {
  text: 'Hello, world!',
  createdAt: (new Date()).toISOString()
})
const res4 = await agent.api.app.bsky.feed.post.list({did: alice.did})
```

## License

MIT
