# @atproto/xrpc: atproto HTTP API Client

TypeScript client library for talking to [atproto](https://atproto.com) services, with Lexicon schema validation.

[![NPM](https://img.shields.io/npm/v/@atproto/xrpc)](https://www.npmjs.com/package/@atproto/xrpc)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Usage

```typescript
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'

const pingLexicon = {
  lexicon: 1,
  id: 'io.example.ping',
  defs: {
    main: {
      type: 'query',
      description: 'Ping the server',
      parameters: {
        type: 'params',
        properties: { message: { type: 'string' } },
      },
      output: {
        encoding: 'application/json',
        schema: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string' } },
        },
      },
    },
  },
} satisfies LexiconDoc

const xrpc = new XrpcClient('https://ping.example.com', [
  // Any number of lexicon here
  pingLexicon,
])

const res1 = await xrpc.call('io.example.ping', {
  message: 'hello world',
})
res1.encoding // => 'application/json'
res1.body // => {message: 'hello world'}
```

### With a custom fetch handler

```typescript
import { XrpcClient } from '@atproto/xrpc'

const session = {
  serviceUrl: 'https://ping.example.com',
  token: '<my-token>',
  async refreshToken() {
    const { token } = await fetch('https://auth.example.com/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    }).then((res) => res.json())

    this.token = token

    return token
  },
}

const sessionBasedFetch: FetchHandler = async (
  url: string,
  init: RequestInit,
) => {
  const headers = new Headers(init.headers)

  headers.set('Authorization', `Bearer ${session.token}`)

  const response = await fetch(new URL(url, session.serviceUrl), {
    ...init,
    headers,
  })

  if (response.status === 401) {
    // Refresh token, then try again.
    const newToken = await session.refreshToken()
    headers.set('Authorization', `Bearer ${newToken}`)
    return fetch(new URL(url, session.serviceUrl), { ...init, headers })
  }

  return response
}

const xrpc = new XrpcClient(sessionBasedFetch, [
  // Any number of lexicon here
  pingLexicon,
])

//
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
