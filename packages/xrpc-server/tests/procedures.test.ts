import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc from '@atproto/xrpc'

const SCHEMAS = [
  {
    lexicon: 1,
    id: 'io.example.ping1',
    type: 'procedure',
    parameters: { message: { type: 'string' } },
    output: {
      encoding: 'text/plain',
    },
  },
  {
    lexicon: 1,
    id: 'io.example.ping2',
    type: 'procedure',
    input: {
      encoding: 'text/plain',
    },
    output: {
      encoding: 'text/plain',
    },
  },
  {
    lexicon: 1,
    id: 'io.example.ping3',
    type: 'procedure',
    input: {
      encoding: 'application/octet-stream',
    },
    output: {
      encoding: 'application/octet-stream',
    },
  },
  {
    lexicon: 1,
    id: 'io.example.ping4',
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
]

describe('Procedures', () => {
  let s: http.Server
  const server = xrpcServer.createServer(SCHEMAS)
  server.method('io.example.ping1', (params: xrpcServer.Params) => {
    return { encoding: 'text/plain', body: params.message }
  })
  server.method(
    'io.example.ping2',
    (params: xrpcServer.Params, input?: xrpcServer.HandlerInput) => {
      return { encoding: 'text/plain', body: input?.body }
    },
  )
  server.method(
    'io.example.ping3',
    (params: xrpcServer.Params, input?: xrpcServer.HandlerInput) => {
      return { encoding: 'application/octet-stream', body: input?.body }
    },
  )
  server.method(
    'io.example.ping4',
    (params: xrpcServer.Params, input?: xrpcServer.HandlerInput) => {
      return {
        encoding: 'application/json',
        body: { message: input?.body?.message },
      }
    },
  )
  const client = xrpc.service(`http://localhost:8891`)
  xrpc.addSchemas(SCHEMAS)
  beforeAll(async () => {
    s = await createServer(8891, server)
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

    const res2 = await client.call('io.example.ping2', {}, 'hello world', {
      encoding: 'text/plain',
    })
    expect(res2.success).toBeTruthy()
    expect(res2.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res2.data).toBe('hello world')

    const res3 = await client.call(
      'io.example.ping3',
      {},
      new TextEncoder().encode('hello world'),
      { encoding: 'application/octet-stream' },
    )
    expect(res3.success).toBeTruthy()
    expect(res3.headers['content-type']).toBe('application/octet-stream')
    expect(new TextDecoder().decode(res3.data)).toBe('hello world')

    const res4 = await client.call(
      'io.example.ping4',
      {},
      { message: 'hello world' },
    )
    expect(res4.success).toBeTruthy()
    expect(res4.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res4.data?.message).toBe('hello world')
  })
})
