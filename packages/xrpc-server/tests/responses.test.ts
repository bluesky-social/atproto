import type * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { byteIterableToStream } from '@atproto/common'
import type { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src/index.js'
import { closeServer, createServer } from './_util.js'

const LEXICONS: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.readableStream',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            shouldErr: { type: 'boolean' },
            closeListeners: { type: 'integer' },
            maxListeners: { type: 'integer' },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
]

describe('Responses', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  let closeListenersExceeded = false
  server.method('io.example.readableStream', async (ctx) => {
    // Stand-ins for middleware listeners (logging, tracing)
    for (let i = 0; i < Number(ctx.params.closeListeners ?? 0); i++) {
      ctx.res.on('close', () => {})
    }
    if (ctx.params.maxListeners !== undefined) {
      ctx.res.setMaxListeners(Number(ctx.params.maxListeners))
    }
    ctx.res.on('newListener', (event) => {
      const max = ctx.res.getMaxListeners()
      if (
        event === 'close' &&
        max > 0 &&
        ctx.res.listenerCount('close') >= max
      ) {
        closeListenersExceeded = true
      }
    })
    async function* iter(): AsyncIterable<Uint8Array> {
      for (let i = 0; i < 5; i++) {
        yield new Uint8Array([i])
      }
      if (ctx.params.shouldErr) {
        throw new Error('error')
      }
    }
    return {
      encoding: 'application/vnd.ipld.car',
      body: byteIterableToStream(iter()),
    }
  })

  let client: XrpcClient
  beforeAll(async () => {
    s = await createServer(server)
    const { port } = s.address() as AddressInfo
    client = new XrpcClient(`http://localhost:${port}`, LEXICONS)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('returns readable streams of bytes', async () => {
    const res = await client.call('io.example.readableStream', {
      shouldErr: false,
    })
    const expected = new Uint8Array([0, 1, 2, 3, 4])
    expect(res.data).toEqual(expected)
  })

  it('handles errs on readable streams of bytes', async () => {
    const attempt = client.call('io.example.readableStream', {
      shouldErr: true,
    })
    await expect(attempt).rejects.toThrow()
  })

  it('streams without exceeding the listener limit', async () => {
    await client.call('io.example.readableStream', { closeListeners: 3 })
    expect(closeListenersExceeded).toBe(false)
  })

  it('leaves an unlimited listener limit unlimited', async () => {
    await client.call('io.example.readableStream', {
      closeListeners: 3,
      maxListeners: 0,
    })
    expect(closeListenersExceeded).toBe(false)
  })
})
