import { AddressInfo } from 'node:net'
import { scheduler } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { decodeAll } from '@atproto/lex-cbor'
import { buildAgent, xrpc } from '@atproto/lex-client'
import { LexError, parseCid } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import {
  LexRouter,
  LexRouterAuth,
  LexRouterMethodHandler,
} from './lex-server.js'
import { serve, upgradeWebSocket } from './nodejs.js'

// ============================================================================
// Schema Definitions
// ============================================================================

const io = {
  example: {
    echo: l.procedure(
      'io.example.echo',
      l.params(),
      l.payload('*/*'),
      l.payload('*/*'),
    ),
    status: l.query(
      'io.example.status',
      l.params(),
      l.payload('application/json', l.object({ status: l.string() })),
    ),
    ipld: l.procedure(
      'io.example.ipld',
      l.params(),
      l.payload(
        'application/json',
        l.object({
          cid: l.cid(),
          bytes: l.bytes(),
        }),
      ),
      l.payload(
        'application/json',
        l.object({
          cid: l.cid(),
          bytes: l.bytes(),
        }),
      ),
    ),
    paramsToBody: l.query(
      'io.example.paramsToBody',
      l.params({
        name: l.string(),
        pronouns: l.array(l.string()),
      }),
      l.payload(
        'application/json',
        l.object({
          params: l.object({
            name: l.string(),
            pronouns: l.array(l.string()),
          }),
        }),
      ),
    ),
  },
}

const handlers: {
  [K in keyof typeof io.example]: LexRouterMethodHandler<(typeof io.example)[K]>
} = {
  echo: async ({ input }) => ({
    encoding: input.encoding,
    body: input.body.body!,
  }),
  status: async () => ({ body: { status: 'ok' } }),
  ipld: async ({ input }) => ({ body: input.body! }),
  paramsToBody: async ({ params }) => ({ body: { params } }),
}

// ============================================================================
// Basic LexRouter Tests
// ============================================================================

describe('LexRouter', () => {
  it('returns MethodNotImplemented when the route is not found', async () => {
    const router = new LexRouter()
    const request = new Request(`https://example.com/xrpc/foo.bar.baz`)
    const response = await router.fetch(request)
    expect(response.status).toBe(501)
    expect(await response.json()).toMatchObject({
      error: 'MethodNotImplemented',
    })
  })

  it('streams payloads', async () => {
    const router = new LexRouter().add(io.example.echo, handlers.echo)
    const request = new Request('https://example.com/xrpc/io.example.echo', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      // @ts-expect-error
      duplex: 'half',
      body: new ReadableStream({
        start(controller) {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode('aaa'))
            setTimeout(() => {
              controller.enqueue(new TextEncoder().encode('bbb'))
              setTimeout(() => {
                controller.error(new Error('Stream closed'))
              }, 50)
            }, 50)
          }, 50)
        },
      }),
    })
    const response = await router.fetch(request)

    const reader = response.body!.getReader()
    const chunks: string[] = []
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(new TextDecoder().decode(value))
      }
    } catch (err) {
      expect((err as Error).message).toBe('Stream closed')
    }
    expect(chunks).toEqual(['aaa', 'bbb'])
  })

  it('maps params to body', async () => {
    const router = new LexRouter().add(
      io.example.paramsToBody,
      handlers.paramsToBody,
    )

    const request = new Request(
      'https://example.com/xrpc/io.example.paramsToBody?name=Alice&pronouns=she%2Fher&pronouns=they%2Fthem',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      params: {
        name: 'Alice',
        pronouns: ['she/her', 'they/them'],
      },
    })
  })
})

describe('lex-client integration', () => {
  const router = new LexRouter()
    .add(io.example.echo, handlers.echo)
    .add(io.example.status, handlers.status)

  it('echoes text', async () => {
    const agent = buildAgent({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        return router.fetch(request)
      },
      service: 'https://example.com',
    })
    const message = 'Hello, LexRouter!'
    const response = await xrpc(agent, io.example.echo, {
      body: message,
      encoding: 'text/plain',
    })
    const responseText = new TextDecoder().decode(response.body)
    expect(responseText).toBe(message)
    expect(response.encoding).toBe('text/plain')
  })

  it('streams text', async () => {
    const agent = buildAgent({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        return router.fetch(request)
      },
      service: 'https://example.com',
    })
    const message = 'Hello, LexRouter Stream!'
    const response = await xrpc(agent, io.example.echo, {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(message))
          controller.close()
        },
      }),
      encoding: 'text/plain',
    })
    const responseText = new TextDecoder().decode(response.body)
    expect(responseText).toBe(message)
    expect(response.encoding).toBe('text/plain')
  })

  it('performs simple query', async () => {
    const agent = buildAgent({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        return router.fetch(request)
      },
      service: 'https://example.com',
    })
    const response = await xrpc(agent, io.example.status)
    expect(response.success).toBe(true)
    expect(response.status).toBe(200)
    expect(response.encoding).toBe('application/json')
    expect(response.body.status).toBe('ok')
  })
})

describe('IPLD values', () => {
  it('can send and receive ipld vals', async () => {
    const ipldHandler: LexRouterMethodHandler<typeof io.example.ipld> = vi.fn(
      async ({ input }) => {
        return { body: input.body! }
      },
    )

    const router = new LexRouter().add(io.example.ipld, ipldHandler)

    const agent = buildAgent({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        return router.fetch(request)
      },
      service: 'https://example.com',
    })

    const cid = parseCid(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )

    const bytes = new Uint8Array([0, 1, 2, 3])

    const response = await xrpc(agent, io.example.ipld, {
      body: { cid, bytes },
    })

    expect(ipldHandler).toHaveBeenCalledTimes(1)
    expect(response.success).toBe(true)
    expect(response.encoding).toBe('application/json')
    expect(response.body.cid.equals(cid)).toBe(true)
    expect(response.body.bytes).toEqual(bytes)
  })
})

// ============================================================================
// Authentication Tests (ported from xrpc-server/tests/auth.test.ts)
// ============================================================================

describe('Authentication', () => {
  // Basic auth schema
  const io = {
    example: {
      authTest: l.procedure(
        'io.example.authTest',
        l.params(),
        l.payload(
          'application/json',
          l.object({
            present: l.literal(true),
          }),
        ),
        l.payload(
          'application/json',
          l.object({
            username: l.string(),
            original: l.string(),
          }),
        ),
      ),
    },
  }

  type BasicAuthCredentials = {
    username: string
    original: string
  }

  function createBasicAuth(allowed: {
    username: string
    password: string
  }): LexRouterAuth<BasicAuthCredentials> {
    return async ({ request }) => {
      const header = request.headers.get('authorization') ?? ''
      if (!header.startsWith('Basic ')) {
        throw new LexError('AuthenticationRequired', 'Authentication required')
      }
      const original = header.slice(6)
      const [username, password] = Buffer.from(original, 'base64')
        .toString()
        .split(':')
      if (username !== allowed.username || password !== allowed.password) {
        throw new LexError('AuthenticationRequired', 'Invalid credentials')
      }
      return { username, original }
    }
  }

  function basicAuth(creds: { username: string; password: string }) {
    return `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`
  }

  const authTestHandler: LexRouterMethodHandler<
    typeof io.example.authTest,
    BasicAuthCredentials
  > = async ({ credentials }) => ({
    body: {
      username: credentials.username,
      original: credentials.original,
    },
  })

  it('fails on bad auth before invalid request payload', async () => {
    const router = new LexRouter().add(io.example.authTest, {
      auth: createBasicAuth({ username: 'admin', password: 'password' }),
      handler: authTestHandler,
    })

    const request = new Request(
      'https://example.com/xrpc/io.example.authTest',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: basicAuth({ username: 'admin', password: 'wrong' }),
        },
        body: JSON.stringify({ present: false }),
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('AuthenticationRequired')
  })

  it('fails on invalid request payload after good auth', async () => {
    const router = new LexRouter().add(io.example.authTest, {
      auth: createBasicAuth({ username: 'admin', password: 'password' }),
      handler: authTestHandler,
    })

    const request = new Request(
      'https://example.com/xrpc/io.example.authTest',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: basicAuth({ username: 'admin', password: 'password' }),
        },
        body: JSON.stringify({ present: false }),
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('InvalidRequest')
  })

  it('succeeds on good auth and payload', async () => {
    const router = new LexRouter().add(io.example.authTest, {
      auth: createBasicAuth({ username: 'admin', password: 'password' }),
      handler: authTestHandler,
    })

    const request = new Request(
      'https://example.com/xrpc/io.example.authTest',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: basicAuth({ username: 'admin', password: 'password' }),
        },
        body: JSON.stringify({ present: true }),
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.username).toBe('admin')
    expect(data.original).toBe('YWRtaW46cGFzc3dvcmQ=')
  })

  it('handles missing auth header', async () => {
    const router = new LexRouter().add(io.example.authTest, {
      auth: createBasicAuth({ username: 'admin', password: 'password' }),
      handler: authTestHandler,
    })

    const request = new Request(
      'https://example.com/xrpc/io.example.authTest',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ present: true }),
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('AuthenticationRequired')
  })
})

// ============================================================================
// Error Handling Tests (ported from xrpc-server/tests/errors.test.ts)
// ============================================================================

describe('Error Handling', () => {
  const io = {
    example: {
      error: l.query(
        'io.example.error',
        l.params({
          which: l.optional(l.string()),
        }),
        l.payload(),
      ),
      throwFalsyValue: l.query(
        'io.example.throwFalsyValue',
        l.params(),
        l.payload(),
      ),
      invalidResponse: l.query(
        'io.example.invalidResponse',
        l.params(),
        l.payload(
          'application/json',
          l.object({
            expectedValue: l.string(),
          }),
        ),
      ),
    },
  }

  describe('Custom Errors', () => {
    it('throws custom error using LexError', async () => {
      const handler: LexRouterMethodHandler<typeof io.example.error> = async ({
        params,
      }) => {
        if (params.which === 'foo') {
          throw new LexError('Foo', 'It was this one!')
        }
        return {}
      }

      const router = new LexRouter().add(io.example.error, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.error?which=foo',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Foo')
      expect(data.message).toBe('It was this one!')
    })

    it('returns custom error via Response object', async () => {
      const handler: LexRouterMethodHandler<typeof io.example.error> = async ({
        params,
      }) => {
        if (params.which === 'bar') {
          return Response.json(
            { error: 'Bar', message: 'It was that one!' },
            { status: 400 },
          )
        }
        return {}
      }

      const router = new LexRouter().add(io.example.error, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.error?which=bar',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Bar')
      expect(data.message).toBe('It was that one!')
    })

    it('handles falsy values thrown as InternalError', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.throwFalsyValue
      > = async () => {
        throw ''
      }

      const router = new LexRouter().add(io.example.throwFalsyValue, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.throwFalsyValue',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('InternalError')
    })
  })

  describe('HTTP Method Mismatches', () => {
    it('rejects POST for query endpoints', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.error
      > = async () => ({})

      const router = new LexRouter().add(io.example.error, handler)

      const request = new Request('https://example.com/xrpc/io.example.error', {
        method: 'POST',
      })
      const response = await router.fetch(request)

      expect(response.status).toBe(405)
      const data = await response.json()
      expect(data.error).toBe('InvalidRequest')
      expect(data.message).toBe('Method not allowed')
    })

    it('rejects GET for procedure endpoints', async () => {
      const procedure = l.procedure(
        'io.example.procedure',
        l.params(),
        l.payload('application/json', l.object({ data: l.string() })),
        l.payload(),
      )

      const handler: LexRouterMethodHandler<typeof procedure> = async () => ({})

      const router = new LexRouter().add(procedure, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.procedure',
        { method: 'GET' },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(405)
      const data = await response.json()
      expect(data.error).toBe('InvalidRequest')
      expect(data.message).toBe('Method not allowed')
    })
  })

  describe('Method Not Found', () => {
    it('returns MethodNotImplemented for non-existent methods', async () => {
      const router = new LexRouter()

      const request = new Request(
        'https://example.com/xrpc/io.example.doesNotExist',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({
        error: 'MethodNotImplemented',
      })
    })
  })

  describe('Custom Error Handlers', () => {
    it('allows custom onHandlerError handler', async () => {
      const onHandlerError = vi.fn()
      const customRouter = new LexRouter({
        onHandlerError,
      })

      const handler: LexRouterMethodHandler<
        typeof io.example.error
      > = async () => {
        throw new Error('Test error')
      }

      customRouter.add(io.example.error, handler)

      const request = new Request('https://example.com/xrpc/io.example.error')
      const response = await customRouter.fetch(request)

      expect(onHandlerError).toHaveBeenCalled()
      expect(response.status).toBe(500)
    })
  })
})

// ============================================================================
// Parameter Tests (ported from xrpc-server/tests/parameters.test.ts)
// ============================================================================

describe('Parameters', () => {
  const io = {
    example: {
      paramTest: l.query(
        'io.example.paramTest',
        l.params({
          str: l.string({ minLength: 2, maxLength: 10 }),
          int: l.integer({ minimum: 2, maximum: 10 }),
          bool: l.boolean(),
          arr: l.array(l.integer(), { maxLength: 2 }),
          def: l.optional(l.withDefault(l.integer(), 0)),
        }),
        l.payload(
          'application/json',
          l.object({
            str: l.string(),
            int: l.integer(),
            bool: l.boolean(),
            arr: l.array(l.integer()),
            def: l.optional(l.integer()),
          }),
        ),
      ),
    },
  }

  const handler: LexRouterMethodHandler<typeof io.example.paramTest> = async ({
    params,
  }) => ({
    body: {
      str: params.str,
      int: params.int,
      bool: params.bool,
      arr: params.arr,
      def: params.def,
    },
  })

  const router = new LexRouter().add(io.example.paramTest, handler)

  it('validates query params - valid input', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=5&bool=true&arr=1&arr=2&def=5',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.str).toBe('valid')
    expect(data.int).toBe(5)
    expect(data.bool).toBe(true)
    expect(data.arr).toEqual([1, 2])
    expect(data.def).toBe(5)
  })

  it('applies default values', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=5&bool=true&arr=3&arr=4',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    // def should be undefined or 0 (default) when not provided
    expect(data.def).toBe(0)
  })

  it('coerces types from query strings', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=10&int=5&bool=true&arr=3&arr=4',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.str).toBe('10')
    expect(data.int).toBe(5)
    expect(data.bool).toBe(true)
    expect(data.arr).toEqual([3, 4])
  })

  it('rejects string too short', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=n&int=5&bool=true&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('str')
  })

  it('rejects string too long', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=loooooooooooooong&int=5&bool=true&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('str')
  })

  it('rejects missing required parameter str', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?int=5&bool=true&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('str')
  })

  it('rejects missing required parameter int', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&bool=true&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('int')
  })

  it('rejects missing required parameter bool', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=5&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('bool')
  })

  it('rejects integer too small', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=-1&bool=true&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('int')
  })

  it('rejects integer too large', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=11&bool=true&arr=1',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('int')
  })

  it('rejects missing required array parameter', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=5&bool=true',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.message).toContain('arr')
  })

  it('rejects array too large', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.paramTest?str=valid&int=5&bool=true&arr=1&arr=2&arr=3',
    )
    const response = await router.fetch(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.message).toContain('arr')
  })
})

// ============================================================================
// Procedure Tests (ported from xrpc-server/tests/procedures.test.ts)
// ============================================================================

describe('Procedures', () => {
  const io = {
    example: {
      pingOne: l.procedure(
        'io.example.pingOne',
        l.params({
          message: l.string(),
        }),
        l.payload(),
        l.payload('text/plain'),
      ),
      pingTwo: l.procedure(
        'io.example.pingTwo',
        l.params(),
        l.payload('text/plain'),
        l.payload('text/plain'),
      ),
      pingThree: l.procedure(
        'io.example.pingThree',
        l.params(),
        l.payload('application/octet-stream'),
        l.payload('application/octet-stream'),
      ),
      pingFour: l.procedure(
        'io.example.pingFour',
        l.params(),
        l.payload(
          'application/json',
          l.object({
            message: l.string(),
          }),
        ),
        l.payload(
          'application/json',
          l.object({
            message: l.string(),
          }),
        ),
      ),
    },
  }

  const handlers = {
    pingOne: (async ({ params }) => ({
      encoding: 'text/plain',
      body: params.message,
    })) as LexRouterMethodHandler<typeof io.example.pingOne>,
    pingTwo: (async ({ input }) => ({
      encoding: 'text/plain',
      body: input.body.body!,
    })) as LexRouterMethodHandler<typeof io.example.pingTwo>,
    pingThree: (async ({ input }) => ({
      encoding: 'application/octet-stream',
      body: input.body.body!,
    })) as LexRouterMethodHandler<typeof io.example.pingThree>,
    pingFour: (async ({ input }) => ({
      body: { message: input.body.message },
    })) as LexRouterMethodHandler<typeof io.example.pingFour>,
  }

  const router = new LexRouter()
    .add(io.example.pingOne, handlers.pingOne)
    .add(io.example.pingTwo, handlers.pingTwo)
    .add(io.example.pingThree, handlers.pingThree)
    .add(io.example.pingFour, handlers.pingFour)

  it('serves procedure with params returning text', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.pingOne?message=hello%20world',
      { method: 'POST' },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(await response.text()).toBe('hello world')
  })

  it('serves procedure with text input/output', async () => {
    const request = new Request('https://example.com/xrpc/io.example.pingTwo', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello world',
    })
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(await response.text()).toBe('hello world')
  })

  it('serves procedure with binary input/output', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.pingThree',
      {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: new TextEncoder().encode('hello world'),
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream',
    )
    const responseBytes = new Uint8Array(await response.arrayBuffer())
    expect(new TextDecoder().decode(responseBytes)).toBe('hello world')
  })

  it('serves procedure with JSON input/output', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.pingFour',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hello world' }),
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    const data = await response.json()
    expect(data.message).toBe('hello world')
  })
})

// ============================================================================
// Query Tests (ported from xrpc-server/tests/queries.test.ts)
// ============================================================================

describe('Queries', () => {
  const io = {
    example: {
      pingOne: l.query(
        'io.example.pingOne',
        l.params({
          message: l.string(),
        }),
        l.payload('text/plain'),
      ),
      pingTwo: l.query(
        'io.example.pingTwo',
        l.params({
          message: l.string(),
        }),
        l.payload('application/octet-stream'),
      ),
      pingThree: l.query(
        'io.example.pingThree',
        l.params({
          message: l.string(),
        }),
        l.payload('application/json', l.object({ message: l.string() })),
      ),
    },
  }

  const handlers = {
    pingOne: (async ({ params }) => ({
      encoding: 'text/plain',
      body: params.message,
    })) satisfies LexRouterMethodHandler<typeof io.example.pingOne>,
    pingTwo: (async ({ params }) => ({
      encoding: 'application/octet-stream',
      body: new TextEncoder().encode(params.message),
    })) satisfies LexRouterMethodHandler<typeof io.example.pingTwo>,
    pingThree: (async ({ params }) => ({
      body: { message: params.message },
      headers: { 'x-test-header-name': 'test-value' },
    })) satisfies LexRouterMethodHandler<typeof io.example.pingThree>,
  }

  const router = new LexRouter()
    .add(io.example.pingOne, handlers.pingOne)
    .add(io.example.pingTwo, handlers.pingTwo)
    .add(io.example.pingThree, handlers.pingThree)

  it('serves query with text response', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.pingOne?message=hello%20world',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(await response.text()).toBe('hello world')
  })

  it('serves query with binary response', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.pingTwo?message=hello%20world',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream',
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(new TextDecoder().decode(bytes)).toBe('hello world')
  })

  it('serves query with JSON response and custom headers', async () => {
    const request = new Request(
      'https://example.com/xrpc/io.example.pingThree?message=hello%20world',
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('x-test-header-name')).toBe('test-value')
    const data = await response.json()
    expect(data.message).toBe('hello world')
  })

  it('rejects query with content-type header', async () => {
    // GET requests can't have a body, but they can have content-type headers
    // The server should reject queries that have content-type/content-length headers
    const request = new Request(
      'https://example.com/xrpc/io.example.pingOne?message=hello',
      {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      },
    )
    const response = await router.fetch(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('InvalidRequest')
  })
})

// ============================================================================
// Response Handling Tests (ported from xrpc-server/tests/responses.test.ts)
// ============================================================================

describe('Responses', () => {
  describe('Streaming Responses', () => {
    const io = {
      example: {
        readableStream: l.query(
          'io.example.readableStream',
          l.params({
            shouldErr: l.optional(l.boolean()),
          }),
          l.payload('application/vnd.ipld.car'),
        ),
      },
    }

    it('returns readable streams of bytes', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.readableStream
      > = async () => {
        const stream = new ReadableStream({
          start(controller) {
            for (let i = 0; i < 5; i++) {
              controller.enqueue(new Uint8Array([i]))
            }
            controller.close()
          },
        })

        return {
          encoding: 'application/vnd.ipld.car',
          body: stream,
        }
      }

      const router = new LexRouter().add(io.example.readableStream, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.readableStream',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe(
        'application/vnd.ipld.car',
      )

      const reader = response.body!.getReader()
      const chunks: number[] = []
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(...value)
      }
      expect(chunks).toEqual([0, 1, 2, 3, 4])
    })

    it('handles errors on readable streams of bytes', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.readableStream
      > = async ({ params }) => {
        const stream = new ReadableStream({
          start(controller) {
            for (let i = 0; i < 5; i++) {
              controller.enqueue(new Uint8Array([i]))
            }
            if (params.shouldErr) {
              controller.error(new Error('Stream error'))
            } else {
              controller.close()
            }
          },
        })

        return {
          encoding: 'application/vnd.ipld.car',
          body: stream,
        }
      }

      const router = new LexRouter().add(io.example.readableStream, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.readableStream?shouldErr=true',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)

      const reader = response.body!.getReader()
      await expect(async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }).rejects.toThrow('Stream error')
    })
  })

  describe('Empty Responses', () => {
    const io = {
      example: {
        emptyResponse: l.query(
          'io.example.emptyResponse',
          l.params(),
          l.payload(),
        ),
      },
    }

    it('handles responses with no body', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.emptyResponse
      > = async () => ({})

      const router = new LexRouter().add(io.example.emptyResponse, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.emptyResponse',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })

    it('handles responses with headers but no body', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.emptyResponse
      > = async () => ({
        headers: { 'x-custom-header': 'value' },
      })

      const router = new LexRouter().add(io.example.emptyResponse, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.emptyResponse',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('x-custom-header')).toBe('value')
      expect(response.body).toBeNull()
    })
  })

  describe('Custom Response Objects', () => {
    const io = {
      example: {
        customResponse: l.query(
          'io.example.customResponse',
          l.params({
            status: l.integer(),
          }),
          l.payload(),
        ),
      },
    }

    it('allows returning custom Response objects', async () => {
      const handler: LexRouterMethodHandler<
        typeof io.example.customResponse
      > = async ({ params }) => {
        return new Response(JSON.stringify({ code: params.status }), {
          status: params.status,
          headers: { 'content-type': 'application/json' },
        })
      }

      const router = new LexRouter().add(io.example.customResponse, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.customResponse?status=201',
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.code).toBe(201)
    })
  })
})

// ============================================================================
// Body Handling Tests (ported from xrpc-server/tests/bodies.test.ts)
// ============================================================================

describe('Body Handling', () => {
  describe('Input Validation', () => {
    const io = {
      example: {
        validationTest: l.procedure(
          'io.example.validationTest',
          l.params(),
          l.payload(
            'application/json',
            l.object({
              foo: l.string(),
              bar: l.optional(l.integer()),
            }),
          ),
          l.payload(
            'application/json',
            l.object({
              foo: l.string(),
              bar: l.optional(l.integer()),
            }),
          ),
        ),
      },
    }

    const handler: LexRouterMethodHandler<
      typeof io.example.validationTest
    > = async ({ input }) => ({
      body: input.body!,
    })

    const router = new LexRouter().add(io.example.validationTest, handler)

    it('validates input and output bodies', async () => {
      const request = new Request(
        'https://example.com/xrpc/io.example.validationTest',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ foo: 'hello', bar: 123 }),
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.foo).toBe('hello')
      expect(data.bar).toBe(123)
    })

    it('rejects missing required fields', async () => {
      const request = new Request(
        'https://example.com/xrpc/io.example.validationTest',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.message).toContain('foo')
    })

    it('rejects wrong types', async () => {
      const request = new Request(
        'https://example.com/xrpc/io.example.validationTest',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ foo: 123 }),
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.message).toContain('foo')
    })

    it('rejects wrong content-type', async () => {
      const request = new Request(
        'https://example.com/xrpc/io.example.validationTest',
        {
          method: 'POST',
          headers: { 'content-type': 'image/jpeg' },
          body: new Uint8Array([1, 2, 3]),
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('InvalidRequest')
    })
  })

  describe('Binary Data Support', () => {
    const io = {
      example: {
        blobTest: l.procedure(
          'io.example.blobTest',
          l.params(),
          l.payload('*/*'),
          l.payload('application/octet-stream'),
        ),
      },
    }

    const handler: LexRouterMethodHandler<typeof io.example.blobTest> = async ({
      input,
    }) => {
      return {
        encoding: 'application/octet-stream',
        body: new Uint8Array(await input.body.arrayBuffer()),
      }
    }

    const router = new LexRouter().add(io.example.blobTest, handler)

    it('supports ArrayBuffers', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5])
      const request = new Request(
        'https://example.com/xrpc/io.example.blobTest',
        {
          method: 'POST',
          // @NOTE content-type will default to application/octet-stream
          body: bytes,
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      const responseBytes = new Uint8Array(await response.arrayBuffer())
      expect(responseBytes).toEqual(bytes)
      expect(response.headers.get('content-type')).toBe(
        'application/octet-stream',
      )
    })

    it('supports empty payload', async () => {
      const bytes = new Uint8Array(0)
      const request = new Request(
        'https://example.com/xrpc/io.example.blobTest',
        {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: bytes,
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      const responseBytes = new Uint8Array(await response.arrayBuffer())
      expect(responseBytes).toEqual(bytes)
    })

    it('supports ReadableStream', async () => {
      const message = 'hello world'
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(message))
          controller.close()
        },
      })

      const request = new Request(
        'https://example.com/xrpc/io.example.blobTest',
        {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          // @ts-expect-error
          duplex: 'half',
          body: stream,
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      const responseBytes = new Uint8Array(await response.arrayBuffer())
      expect(new TextDecoder().decode(responseBytes)).toBe(message)
    })

    it('requires any parsable Content-Type for blob uploads', async () => {
      const bytes = new Uint8Array([1, 2, 3])
      const request = new Request(
        'https://example.com/xrpc/io.example.blobTest',
        {
          method: 'POST',
          headers: { 'content-type': 'some/thing' },
          body: bytes,
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Edge Cases', () => {
    it('errors on missing Content-Type for JSON payload', async () => {
      const io = {
        example: {
          emptyContentType: l.procedure(
            'io.example.emptyContentType',
            l.params(),
            l.payload('application/json', l.object({ data: l.string() })),
            l.payload('application/json', l.object({ data: l.string() })),
          ),
        },
      }

      const handler: LexRouterMethodHandler<
        typeof io.example.emptyContentType
      > = async ({ input }) => ({
        body: { data: input.body!.data },
      })

      const router = new LexRouter().add(io.example.emptyContentType, handler)

      const request = new Request(
        'https://example.com/xrpc/io.example.emptyContentType',
        {
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        },
      )

      const response = await router.fetch(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('InvalidRequest')
    })

    it('defaults to application/octet-stream for empty Content-Type', async () => {
      const io = {
        example: {
          emptyContentTypeBlob: l.procedure(
            'io.example.emptyContentTypeBlob',
            l.params(),
            l.payload('*/*'),
            l.payload('application/json', l.object({ encoding: l.string() })),
          ),
        },
      }

      const handler: LexRouterMethodHandler<
        typeof io.example.emptyContentTypeBlob
      > = async ({ input }) => ({
        body: { encoding: input.encoding },
      })

      const router = new LexRouter().add(
        io.example.emptyContentTypeBlob,
        handler,
      )

      const request = new Request(
        'https://example.com/xrpc/io.example.emptyContentTypeBlob',
        {
          method: 'POST',
          body: new Uint8Array([1, 2, 3]),
        },
      )
      const response = await router.fetch(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(data.encoding).toBe('application/octet-stream')
    })
  })
})

describe('Subscription', () => {
  const io = {
    example: {
      subscribe: l.subscription(
        'io.example.subscribe',
        l.params({
          message: l.withDefault(l.string(), 'hello'),
        }),
        l.object({
          message: l.string(),
          count: l.integer(),
        }),
      ),
    },
  }

  it('handles subscriptions with cleanup', async () => {
    let sentCount = 0

    const { resolve, promise: finallyPromise } = timeoutDeferred(5000)

    const router = new LexRouter({ upgradeWebSocket }).add(
      io.example.subscribe,
      async function* ({ params: { message }, signal }) {
        try {
          for (; sentCount < 10; ) {
            await scheduler.wait(5, { signal })
            yield { message, count: ++sentCount }
          }
        } finally {
          resolve()
        }
      },
    )

    await using server = await serve(router)

    const { port } = server.address() as AddressInfo
    const ws = new WebSocket(
      `ws://localhost:${port}/xrpc/io.example.subscribe?message=ping`,
    )
    ws.binaryType = 'arraybuffer'

    const messages: unknown[] = []
    ws.addEventListener('message', (event) => {
      try {
        const bytes = new Uint8Array(event.data as ArrayBuffer)
        const data = [...decodeAll(bytes)]
        messages.push(data)
      } catch (err) {
        messages.push(err)
      }
      if (messages.length >= 3) {
        ws.close()
      }
    })

    // Ensures that "finally" block is indeed called
    await finallyPromise

    expect(messages).toStrictEqual([
      [{ op: 1 }, { message: 'ping', count: 1 }],
      [{ op: 1 }, { message: 'ping', count: 2 }],
      [{ op: 1 }, { message: 'ping', count: 3 }],
    ])

    expect(sentCount).toBeGreaterThanOrEqual(3)
    expect(sentCount).toBeLessThan(5)
  })

  it('returns 405 for non-GET request', async () => {
    const router = new LexRouter({ upgradeWebSocket }).add(
      io.example.subscribe,
      async function* () {},
    )

    await using server = await serve(router)
    const { port } = server.address() as AddressInfo

    const response = await fetch(
      `http://localhost:${port}/xrpc/io.example.subscribe?message=ping`,
      { method: 'POST' },
    )

    expect(response.status).toBe(405)
    const data = await response.json()
    expect(data.error).toBe('InvalidRequest')
    expect(data.message).toBe('Method not allowed')
  })

  it('returns 426 for non-WebSocket request', async () => {
    const router = new LexRouter({ upgradeWebSocket }).add(
      io.example.subscribe,
      async function* () {},
    )

    await using server = await serve(router)
    const { port } = server.address() as AddressInfo

    const response = await fetch(
      `http://localhost:${port}/xrpc/io.example.subscribe?message=ping`,
      { method: 'GET' },
    )

    expect(response.status).toBe(426)
    expect(response.headers.get('upgrade')).toBe('websocket')
    expect(response.headers.get('connection')).toBe('Upgrade')
    const data = await response.json()
    expect(data.error).toBe('InvalidRequest')
    expect(data.message).toBe(
      'XRPC subscriptions are only available over WebSocket',
    )
  })
})

function timeoutDeferred(ms: number) {
  let resolve: () => void
  let reject: (err: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  const to = setTimeout(() => reject(new Error('Timed out')), ms).unref()
  promise.finally(() => {
    clearTimeout(to)
  })
  return { resolve: resolve!, promise }
}
