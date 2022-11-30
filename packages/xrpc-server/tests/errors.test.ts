import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc, { Client, XRPCError } from '@atproto/xrpc'

const SCHEMAS = [
  {
    lexicon: 1,
    id: 'io.example.error',
    type: 'query',
    parameters: {
      type: 'object',
      properties: {
        which: { type: 'string', default: 'foo' },
      },
    },
    errors: [{ name: 'Foo' }, { name: 'Bar' }],
  },
  {
    lexicon: 1,
    id: 'io.example.query',
    type: 'query',
  },
  {
    lexicon: 1,
    id: 'io.example.procedure',
    type: 'procedure',
  },
]

const MISMATCHED_SCHEMAS = [
  {
    lexicon: 1,
    id: 'io.example.query',
    type: 'procedure',
  },
  {
    lexicon: 1,
    id: 'io.example.procedure',
    type: 'query',
  },
  {
    lexicon: 1,
    id: 'io.example.doesNotExist',
    type: 'query',
  },
]

describe('Errors', () => {
  let s: http.Server
  const server = xrpcServer.createServer(SCHEMAS)
  server.method('io.example.error', (ctx: { params: xrpcServer.Params }) => {
    if (ctx.params.which === 'foo') {
      throw new xrpcServer.InvalidRequestError('It was this one!', 'Foo')
    } else if (ctx.params.which === 'bar') {
      return { status: 400, error: 'Bar', message: 'It was that one!' }
    } else {
      return { status: 400 }
    }
  })
  server.method('io.example.query', () => {
    return undefined
  })
  server.method('io.example.procedure', () => {
    return undefined
  })
  const client = xrpc.service(`http://localhost:8893`)
  xrpc.addSchemas(SCHEMAS)
  const badXrpc = new Client()
  const badClient = badXrpc.service(`http://localhost:8893`)
  badXrpc.addSchemas(MISMATCHED_SCHEMAS)
  beforeAll(async () => {
    s = await createServer(8893, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('serves requests', async () => {
    try {
      await client.call('io.example.error', {
        which: 'foo',
      })
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('Foo')
      expect(e.message).toBe('It was this one!')
    }
    try {
      await client.call('io.example.error', {
        which: 'bar',
      })
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('Bar')
      expect(e.message).toBe('It was that one!')
    }
    try {
      await client.call('io.example.error', {
        which: 'other',
      })
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('InvalidRequest')
      expect(e.message).toBe('Invalid Request')
    }
  })

  it('serves error for missing/mismatch schemas', async () => {
    await client.call('io.example.query') // No error
    await client.call('io.example.procedure') // No error
    try {
      await badClient.call('io.example.query')
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('InvalidRequest')
      expect(e.message).toBe('Incorrect HTTP method (POST) expected GET')
    }
    try {
      await badClient.call('io.example.procedure')
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('InvalidRequest')
      expect(e.message).toBe('Incorrect HTTP method (GET) expected POST')
    }
    try {
      await badClient.call('io.example.doesNotExist')
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('MethodNotImplemented')
      expect(e.message).toBe('Method Not Implemented')
    }
  })
})
