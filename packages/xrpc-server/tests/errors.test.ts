import * as http from 'http'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc, { XRPCError } from '@atproto/xrpc'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.error',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            which: { type: 'string', default: 'foo' },
          },
        },
        errors: [{ name: 'Foo' }, { name: 'Bar' }],
      },
    },
  },
]

describe('Procedures', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.error', (params: xrpcServer.Params) => {
    if (params.which === 'foo') {
      throw new xrpcServer.InvalidRequestError('It was this one!', 'Foo')
    } else if (params.which === 'bar') {
      return { status: 400, error: 'Bar', message: 'It was that one!' }
    } else {
      return { status: 400 }
    }
  })
  const client = xrpc.service(`http://localhost:8893`)
  xrpc.addLexicons(LEXICONS)
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
    } catch (e) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect((e as XRPCError).success).toBeFalsy()
      expect((e as XRPCError).error).toBe('Foo')
      expect((e as XRPCError).message).toBe('It was this one!')
    }
    try {
      await client.call('io.example.error', {
        which: 'bar',
      })
      throw new Error('Didnt throw')
    } catch (e) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect((e as XRPCError).success).toBeFalsy()
      expect((e as XRPCError).error).toBe('Bar')
      expect((e as XRPCError).message).toBe('It was that one!')
    }
    try {
      await client.call('io.example.error', {
        which: 'other',
      })
      throw new Error('Didnt throw')
    } catch (e) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect((e as XRPCError).success).toBeFalsy()
      expect((e as XRPCError).error).toBe('InvalidRequest')
      expect((e as XRPCError).message).toBe('Invalid Request')
    }
  })
})
