import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc from '@atproto/xrpc'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.ping1',
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
    id: 'io.example.ping2',
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
    id: 'io.example.ping3',
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
  server.method('io.example.ping1', (params: xrpcServer.Params) => {
    return { encoding: 'text/plain', body: params.message }
  })
  server.method('io.example.ping2', (params: xrpcServer.Params) => {
    return {
      encoding: 'application/octet-stream',
      body: new TextEncoder().encode(String(params.message)),
    }
  })
  server.method('io.example.ping3', (params: xrpcServer.Params) => {
    return { encoding: 'application/json', body: { message: params.message } }
  })
  const client = xrpc.service(`http://localhost:8890`)
  xrpc.addLexicons(LEXICONS)
  beforeAll(async () => {
    s = await createServer(8890, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('serves requests', async () => {
    const res1 = await client.call('io.example.ping1', {
      message: 'hello world',
    })
    expect(res1.success).toBeTruthy()
    expect(res1.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res1.data).toBe('hello world')

    const res2 = await client.call('io.example.ping2', {
      message: 'hello world',
    })
    expect(res2.success).toBeTruthy()
    expect(res2.headers['content-type']).toBe('application/octet-stream')
    expect(new TextDecoder().decode(res2.data)).toBe('hello world')

    const res3 = await client.call('io.example.ping3', {
      message: 'hello world',
    })
    expect(res3.success).toBeTruthy()
    expect(res3.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res3.data?.message).toBe('hello world')
  })
})
