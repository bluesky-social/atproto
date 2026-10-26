import type * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { byteIterableToStream } from '@atproto/common'
import type { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src/index.js'
import {
  buildAddLexicons,
  buildMethodLexicons,
  closeServer,
  createServer,
} from './_util.js'

const LEXICONS = [
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
] as const satisfies LexiconDoc[]

describe('Responses', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.readableStream', async (ctx) => {
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
})

describe.each([buildMethodLexicons, buildAddLexicons])(
  '%p redirects',
  (buildServer) => {
    it.each([301, 302, 303, 307, 308] as const)(
      'returns a %i redirect without validating a response body',
      async (status) => {
        const location =
          'https://objects.example.com/blob?signature=abc&expires=60'
        const server = await buildServer(
          LEXICONS,
          {
            'io.example.readableStream': () => ({
              status,
              location,
              headers: { 'cache-control': 'no-store' },
            }),
          },
          { validateResponse: true },
        )
        await using s = await createServer(server)
        const { port } = s.address() as AddressInfo
        const res = await fetch(
          `http://localhost:${port}/xrpc/io.example.readableStream`,
          { redirect: 'manual' },
        )
        expect(res.status).toBe(status)
        expect(res.headers.get('location')).toBe(location)
        expect(res.headers.get('cache-control')).toBe('no-store')
        expect(await res.text()).toBe('')
      },
    )
  },
)
