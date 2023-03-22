import * as http from 'http'
import getPort from 'get-port'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import xrpc, {
  Client,
  ServiceClient,
  XRPCError,
  XRPCInvalidResponseError,
} from '@atproto/xrpc'

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
  {
    lexicon: 1,
    id: 'io.example.query',
    defs: {
      main: {
        type: 'query',
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.procedure',
    defs: {
      main: {
        type: 'procedure',
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.invalidResponse',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['expectedValue'],
            properties: {
              expectedValue: { type: 'string' },
            },
          },
        },
      },
    },
  },
]

const MISMATCHED_LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.query',
    defs: {
      main: {
        type: 'procedure',
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.procedure',
    defs: {
      main: {
        type: 'query',
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.doesNotExist',
    defs: {
      main: {
        type: 'query',
      },
    },
  },
]

describe('Errors', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS, { validateResponse: false }) // disable validateResponse to test client validation
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
  // @ts-ignore We're intentionally giving the wrong response! -prf
  server.method('io.example.invalidResponse', () => {
    return { encoding: 'json', body: { something: 'else' } }
  })
  server.method('io.example.procedure', () => {
    return undefined
  })
  xrpc.addLexicons(LEXICONS)
  const badXrpc = new Client()
  badXrpc.addLexicons(MISMATCHED_LEXICONS)

  let client: ServiceClient
  let badClient: ServiceClient
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    client = xrpc.service(`http://localhost:${port}`)
    badClient = badXrpc.service(`http://localhost:${port}`)
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
    try {
      await client.call('io.example.invalidResponse')
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e instanceof XRPCError).toBeTruthy()
      expect(e instanceof XRPCInvalidResponseError).toBeTruthy()
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('Invalid Response')
      expect(e.message).toBe(
        'The server gave an invalid response and may be out of date.',
      )
      const err = e as XRPCInvalidResponseError
      expect(err.validationError.message).toBe(
        'Output must have the property "expectedValue"',
      )
      expect(err.responseBody).toStrictEqual({ something: 'else' })
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
