import assert from 'node:assert'
import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import { closeServer, createServer } from './_util'

const LEXICONS: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.pingOne',
    defs: {
      main: {
        type: 'procedure',
        parameters: {
          type: 'params',
          properties: {
            message: { type: 'string' },
          },
        },
        output: {
          encoding: 'text/plain',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.pingTwo',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'text/plain',
        },
        output: {
          encoding: 'text/plain',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.pingThree',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/octet-stream',
        },
        output: {
          encoding: 'application/octet-stream',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.pingFour',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['message'],
            properties: { message: { type: 'string' } },
          },
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
  },
]

describe('Procedures', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.pingOne', (ctx) => {
    return { encoding: 'text/plain', body: ctx.params.message }
  })
  server.method('io.example.pingTwo', (ctx) => {
    return { encoding: 'text/plain', body: ctx.input?.body }
  })
  server.method('io.example.pingThree', async (ctx) => {
    assert(ctx.input?.body instanceof Readable, 'Input not readable')
    const buffers: Buffer[] = []
    for await (const data of ctx.input.body) {
      buffers.push(data)
    }
    return {
      encoding: 'application/octet-stream',
      body: Buffer.concat(buffers),
    }
  })
  server.method('io.example.pingFour', (ctx) => {
    return {
      encoding: 'application/json',
      body: { message: ctx.input?.body?.['message'] },
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

  it('serves requests', async () => {
    const res1 = await client.call('io.example.pingOne', {
      message: 'hello world',
    })
    expect(res1.success).toBeTruthy()
    expect(res1.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res1.data).toBe('hello world')

    const res2 = await client.call('io.example.pingTwo', {}, 'hello world', {
      encoding: 'text/plain',
    })
    expect(res2.success).toBeTruthy()
    expect(res2.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res2.data).toBe('hello world')

    const res3 = await client.call(
      'io.example.pingThree',
      {},
      new TextEncoder().encode('hello world'),
      { encoding: 'application/octet-stream' },
    )
    expect(res3.success).toBeTruthy()
    expect(res3.headers['content-type']).toBe('application/octet-stream')
    expect(new TextDecoder().decode(res3.data)).toBe('hello world')

    const res4 = await client.call(
      'io.example.pingFour',
      {},
      { message: 'hello world' },
    )
    expect(res4.success).toBeTruthy()
    expect(res4.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res4.data?.message).toBe('hello world')
  })
})
