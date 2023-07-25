import * as http from 'http'
import getPort from 'get-port'
import xrpc, { ServiceClient } from '@atproto/xrpc'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import { RateLimiter } from '../src'
import { MINUTE } from '@atproto/common'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.routeLimit',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['str'],
          properties: {
            str: { type: 'string' },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.sharedLimitOne',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['points'],
          properties: {
            points: { type: 'integer' },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.sharedLimitTwo',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['points'],
          properties: {
            points: { type: 'integer' },
          },
        },
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
]

describe('Parameters', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS, {
    rateLimits: {
      creator: RateLimiter.memory,
      limits: [
        {
          name: 'shared-limit',
          durationMs: 5 * MINUTE,
          points: 6,
        },
      ],
    },
  })
  server.method('io.example.routeLimit', {
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 5,
      calcKey: ({ params }) => params.str as string,
    },
    handler: (ctx: { params: xrpcServer.Params }) => ({
      encoding: 'json',
      body: ctx.params,
    }),
  })

  server.method('io.example.sharedLimitOne', {
    rateLimit: {
      name: 'shared-limit',
      calcPoints: ({ params }) => params.points as number,
    },
    handler: (ctx: { params: xrpcServer.Params }) => ({
      encoding: 'json',
      body: ctx.params,
    }),
  })
  server.method('io.example.sharedLimitTwo', {
    rateLimit: {
      name: 'shared-limit',
      calcPoints: ({ params }) => params.points as number,
    },
    handler: (ctx: { params: xrpcServer.Params }) => ({
      encoding: 'json',
      body: ctx.params,
    }),
  })

  xrpc.addLexicons(LEXICONS)

  let client: ServiceClient
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    client = xrpc.service(`http://localhost:${port}`)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('rate limits a given route', async () => {
    const makeCall = () => client.call('io.example.routeLimit', { str: 'test' })
    for (let i = 0; i < 5; i++) {
      await makeCall()
    }
    await expect(makeCall).rejects.toThrow('Rate Limit Exceeded')
  })

  it('rate limits on a shared route', async () => {
    await client.call('io.example.sharedLimitOne', { points: 1 })
    await client.call('io.example.sharedLimitTwo', { points: 1 })
    await client.call('io.example.sharedLimitOne', { points: 2 })
    await client.call('io.example.sharedLimitTwo', { points: 2 })
    await expect(
      client.call('io.example.sharedLimitOne', { points: 1 }),
    ).rejects.toThrow('Rate Limit Exceeded')
    await expect(
      client.call('io.example.sharedLimitTwo', { points: 1 }),
    ).rejects.toThrow('Rate Limit Exceeded')
  })
})
