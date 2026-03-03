import assert from 'node:assert'
import * as http from 'node:http'
import { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
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
] as const satisfies LexiconDoc[]

const handlers = {
  'io.example.pingOne': (ctx: xrpcServer.HandlerContext) => {
    return { encoding: 'text/plain', body: ctx.params.message }
  },
  'io.example.pingTwo': (ctx: xrpcServer.HandlerContext) => {
    return { encoding: 'text/plain', body: ctx.input?.body }
  },
  'io.example.pingThree': async (ctx: xrpcServer.HandlerContext) => {
    assert(ctx.input?.body instanceof Readable, 'Input not readable')
    const buffers: Buffer[] = []
    for await (const data of ctx.input.body) {
      buffers.push(data)
    }
    return {
      encoding: 'application/octet-stream',
      body: Buffer.concat(buffers),
    }
  },
  'io.example.pingFour': (ctx: xrpcServer.HandlerContext) => {
    return {
      encoding: 'application/json',
      body: { message: ctx.input?.body?.['message'] },
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
      const res = await client.call('io.example.pingTwo', {}, 'hello world', {
        encoding: 'text/plain',
      })
      expect(res.success).toBeTruthy()
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
      expect(res.data).toBe('hello world')
    })

    test('io.example.pingThree', async () => {
      const res = await client.call(
        'io.example.pingThree',
        {},
        new TextEncoder().encode('hello world'),
        { encoding: 'application/octet-stream' },
      )
      expect(res.success).toBeTruthy()
      expect(res.headers['content-type']).toBe('application/octet-stream')
      expect(new TextDecoder().decode(res.data)).toBe('hello world')
    })

    test('io.example.pingFour', async () => {
      const res = await client.call(
        'io.example.pingFour',
        {},
        { message: 'hello world' },
      )
      expect(res.success).toBeTruthy()
      expect(res.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(res.data?.message).toBe('hello world')
    })
  })
}
