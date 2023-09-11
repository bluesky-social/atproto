# XRPC Server API

## Usage

```typescript
import * as xrpc from '@atproto/xrpc-server'
import express from 'express'

// create xrpc server
const server = xrpc.createServer([
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
])

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

MIT
