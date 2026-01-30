import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import {
  buildAddLexicons,
  buildMethodLexicons,
  closeServer,
  createServer,
} from './_util'

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
  })
}
