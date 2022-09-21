# XRPC Server API

## Usage

```typescript
import * as xrpc from '@adxp/xrpc-server'

// create xrpc server
const server = xrpc.createServer([{
    xrpc: 1,
    id: 'io.example.ping',
    type: 'query',
    parameters: { message: { type: 'string' } },
    output: {
      encoding: 'text/plain',
    },
  }
])
server.method('io.example.ping', (params: xrpcServer.Params) => {
  return { encoding: 'text/plain', body: params.message }
})

// mount in express
const app = express()
app.use(server.router)
app.listen(port)
```

## License

MIT