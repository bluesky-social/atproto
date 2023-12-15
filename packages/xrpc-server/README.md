# @atproto/xrpc-server: atproto HTTP API server library

TypeScript library for implementing [atproto](https://atproto.com) HTTP API services, with Lexicon schema validation.

[![NPM](https://img.shields.io/npm/v/@atproto/xrpc-server)](https://www.npmjs.com/package/@atproto/xrpc-server)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Usage

```typescript
import { LexiconDoc } from '@atproto/lexicon'
import * as xrpc from '@atproto/xrpc-server'
import express from 'express'

const lexicons: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.ping',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: { message: { type: 'string' } },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
]

// create xrpc server
const server = xrpc.createServer(lexicons)

function ping(ctx: {
  auth: xrpc.HandlerAuth | undefined
  params: xrpc.Params
  input: xrpc.HandlerInput | undefined
  req: express.Request
  res: express.Response
}) {
  return { encoding: 'application/json', body: { message: ctx.params.message } }
}

server.method('io.example.ping', ping)

// mount in express
const app = express()
app.use(server.router)
app.listen(8080)
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
