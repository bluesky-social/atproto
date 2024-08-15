import * as http from 'http'
import getPort from 'get-port'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import { byteIterableToStream } from '@atproto/common'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'

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
  server.method(
    'io.example.readableStream',
    async (ctx: { params: xrpcServer.Params }) => {
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
    },
  )

  let client: XrpcClient
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
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
})
