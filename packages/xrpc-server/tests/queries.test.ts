import * as http from 'http'
import getPort from 'get-port'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'

const LEXICONS: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.pingOne',
    defs: {
      main: {
        type: 'query',
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
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            message: { type: 'string' },
          },
        },
        output: {
          encoding: 'application/octet-stream',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.pingThree',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            message: { type: 'string' },
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

describe('Queries', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.pingOne', (ctx: { params: xrpcServer.Params }) => {
    return { encoding: 'text/plain', body: ctx.params.message }
  })
  server.method('io.example.pingTwo', (ctx: { params: xrpcServer.Params }) => {
    return {
      encoding: 'application/octet-stream',
      body: new TextEncoder().encode(String(ctx.params.message)),
    }
  })
  server.method(
    'io.example.pingThree',
    (ctx: { params: xrpcServer.Params }) => {
      return {
        encoding: 'application/json',
        body: { message: ctx.params.message },
        headers: { 'x-test-header-name': 'test-value' },
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

  it('serves requests', async () => {
    const res1 = await client.call('io.example.pingOne', {
      message: 'hello world',
    })
    expect(res1.success).toBeTruthy()
    expect(res1.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res1.data).toBe('hello world')

    const res2 = await client.call('io.example.pingTwo', {
      message: 'hello world',
    })
    expect(res2.success).toBeTruthy()
    expect(res2.headers['content-type']).toBe('application/octet-stream')
    expect(new TextDecoder().decode(res2.data)).toBe('hello world')

    const res3 = await client.call('io.example.pingThree', {
      message: 'hello world',
    })
    expect(res3.success).toBeTruthy()
    expect(res3.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res3.data?.message).toBe('hello world')
    expect(res3.headers['x-test-header-name']).toEqual('test-value')
  })
})
