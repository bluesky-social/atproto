import { once } from 'node:events'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import type * as xrpcServer from '../src/index.js'
import {
  buildAddLexicons,
  buildMethodLexicons,
  closeServer,
  createServer,
} from './_util.js'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const LEXICONS = [
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
  {
    lexicon: 1,
    id: 'io.example.postPing',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
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
] as const satisfies LexiconDoc[]

const handlers = {
  'io.example.pingOne': (ctx: xrpcServer.HandlerContext) => {
    return { encoding: 'text/plain', body: ctx.params.message }
  },
  'io.example.pingTwo': (ctx: xrpcServer.HandlerContext) => {
    return {
      encoding: 'application/octet-stream',
      body: new TextEncoder().encode(String(ctx.params.message)),
    }
  },
  'io.example.pingThree': (ctx: xrpcServer.HandlerContext) => {
    return {
      encoding: 'application/json',
      body: { message: ctx.params.message },
      headers: { 'x-test-header-name': 'test-value' },
    }
  },
  'io.example.postPing': () => {
    return {
      encoding: 'application/json',
      body: { message: 'pong' },
    }
  },
}

for (const buildServer of [buildMethodLexicons, buildAddLexicons]) {
  describe(buildServer, () => {
    let s: http.Server
    let client: XrpcClient
    let url: string
    beforeAll(async () => {
      const server = await buildServer(LEXICONS, handlers)
      s = await createServer(server)
      const { port } = s.address() as AddressInfo
      url = `http://localhost:${port}`
      client = new XrpcClient(url, LEXICONS)
    })
    afterAll(async () => {
      if (s) await closeServer(s)
    })

    test('io.example.pingOne', async () => {
      const res = await client.call('io.example.pingOne', {
        message: 'hello world',
      })
      expect(res.success).toBeTruthy()
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
      expect(res.data).toBe('hello world')
    })

    test('io.example.pingTwo', async () => {
      const res = await client.call('io.example.pingTwo', {
        message: 'hello world',
      })
      expect(res.success).toBeTruthy()
      expect(res.headers['content-type']).toBe('application/octet-stream')
      expect(new TextDecoder().decode(res.data)).toBe('hello world')
    })

    test('io.example.pingThree', async () => {
      const res = await client.call('io.example.pingThree', {
        message: 'hello world',
      })
      expect(res.success).toBeTruthy()
      expect(res.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(res.data?.message).toBe('hello world')
      expect(res.headers['x-test-header-name']).toEqual('test-value')
    })

    test('aborts the handler signal when the client disconnects', async () => {
      let handlerSignal: AbortSignal | undefined
      const started = deferred<void>()
      const aborted = deferred<void>()
      const server = await buildServer(LEXICONS, {
        ...handlers,
        'io.example.pingOne': async (ctx: xrpcServer.HandlerContext) => {
          handlerSignal = ctx.signal
          ctx.signal.addEventListener('abort', () => aborted.resolve(), {
            once: true,
          })
          started.resolve()
          await aborted.promise
          return { encoding: 'text/plain', body: ctx.params.message }
        },
      })
      await using localServer = await createServer(server)
      const { port } = localServer.address() as AddressInfo
      const request = http.get(
        `http://localhost:${port}/xrpc/io.example.pingOne?message=hello`,
      )
      request.on('error', () => {})

      await started.promise
      expect(handlerSignal?.aborted).toBe(false)
      request.destroy()
      await aborted.promise
      expect(handlerSignal?.aborted).toBe(true)
    })

    test('does not abort the handler signal after a completed response', async () => {
      let handlerSignal: AbortSignal | undefined
      const server = await buildServer(LEXICONS, {
        ...handlers,
        'io.example.pingOne': (ctx: xrpcServer.HandlerContext) => {
          handlerSignal = ctx.signal
          return { encoding: 'text/plain', body: ctx.params.message }
        },
      })
      await using localServer = await createServer(server)
      const { port } = localServer.address() as AddressInfo
      const response = await new Promise<http.IncomingMessage>((resolve) => {
        http.get(
          `http://localhost:${port}/xrpc/io.example.pingOne?message=hello`,
          resolve,
        )
      })
      response.resume()
      await once(response, 'end')

      expect(handlerSignal?.aborted).toBe(false)
    })

    test('does not abort a procedure when the client disconnects', async () => {
      let handlerSignal: AbortSignal | undefined
      const started = deferred<void>()
      const proceed = deferred<void>()
      const server = await buildServer(LEXICONS, {
        ...handlers,
        'io.example.postPing': async (ctx: xrpcServer.HandlerContext) => {
          handlerSignal = ctx.signal
          started.resolve()
          await proceed.promise
          return { encoding: 'application/json', body: { message: 'pong' } }
        },
      })
      await using localServer = await createServer(server)
      const { port } = localServer.address() as AddressInfo
      const request = http.request(
        `http://localhost:${port}/xrpc/io.example.postPing`,
        { method: 'POST', headers: { 'content-type': 'application/json' } },
      )
      request.on('error', () => {})
      request.end(JSON.stringify({ message: 'hello' }))

      await started.promise
      expect(handlerSignal?.aborted).toBe(false)
      request.destroy()
      // Give the 'close' event a chance to fire before asserting.
      await new Promise((r) => setTimeout(r, 50))
      expect(handlerSignal?.aborted).toBe(false)
      proceed.resolve()
    })
  })
}
