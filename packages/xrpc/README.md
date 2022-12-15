# XRPC API

## Usage

```typescript
import xrpc from '@atproto/xrpc'

xrpc.addLexicon({
  lexicon: 1,
  id: 'io.example.ping',
  defs: {
    main: {
      type: 'query',
      description: 'Ping the server',
      parameters: {
        type: 'params',
        properties: {message: { type: 'string' }}
      },
      output: {
        encoding: 'application/json',
        schema: {
          type: 'object',
          required: ['message'],
          properties: {message: { type: 'string' }},
        },
      }
    },
  },
})

const res1 = await xrpc.call('https://example.com', 'io.example.ping', {message: 'hello world'})
res1.encoding // => 'application/json'
res1.body // => {message: 'hello world'}
const res2 = await xrpc.service('https://example.com').call('io.example.ping', {message: 'hello world'})
res2.encoding // => 'application/json'
res2.body // => {message: 'hello world'}

xrpc.addLexicon({
  lexicon: 1,
  id: 'io.example.writeJsonFile',
  defs: {
    main: {
      type: 'procedure',
      description: 'Write a JSON file',
      parameters: {
        type: 'params',
        properties: {fileName: { type: 'string' }},
      },
      input: {
        encoding: 'application/json'
      },
    },
  },
})

const res3 = await xrpc
  .service('https://example.com')
  .call('io.example.writeJsonFile',
    {fileName: 'foo.json'}, // query parameters
    {hello: 'world', thisIs: 'the file to write'} // input body
  )
```

## License

MIT
