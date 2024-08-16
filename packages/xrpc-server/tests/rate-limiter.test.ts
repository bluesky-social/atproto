import * as http from 'http'
import getPort from 'get-port'
import { LexiconDoc } from '@atproto/lexicon'
import { XrpcClient } from '@atproto/xrpc'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import { RateLimiter } from '../src'
import { MINUTE } from '@atproto/common'

const LEXICONS: LexiconDoc[] = [
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
  {
    lexicon: 1,
    id: 'io.example.toggleLimit',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            shouldCount: { type: 'boolean' },
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
    id: 'io.example.noLimit',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.nonExistent',
    defs: {
      main: {
        type: 'query',
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
      creator: (opts: xrpcServer.RateLimiterOpts) =>
        RateLimiter.memory({
          bypassSecret: 'bypass',
          ...opts,
        }),
      shared: [
        {
          name: 'shared-limit',
          durationMs: 5 * MINUTE,
          points: 6,
        },
      ],
      global: [
        {
          name: 'global-ip',
          durationMs: 5 * MINUTE,
          points: 100,
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
  server.method('io.example.toggleLimit', {
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 5,
        calcPoints: ({ params }) => (params.shouldCount ? 1 : 0),
      },
      {
        durationMs: 5 * MINUTE,
        points: 10,
      },
    ],
    handler: (ctx: { params: xrpcServer.Params }) => ({
      encoding: 'json',
      body: ctx.params,
    }),
  })
  server.method('io.example.noLimit', {
    handler: () => ({
      encoding: 'json',
      body: {},
    }),
  })

  let client: XrpcClient
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    client = new XrpcClient(`http://localhost:${port}`, LEXICONS)
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

  it('applies multiple rate-limits', async () => {
    const makeCall = (shouldCount: boolean) =>
      client.call('io.example.toggleLimit', { shouldCount })
    for (let i = 0; i < 5; i++) {
      await makeCall(true)
    }
    await expect(() => makeCall(true)).rejects.toThrow('Rate Limit Exceeded')
    for (let i = 0; i < 4; i++) {
      await makeCall(false)
    }
    await expect(() => makeCall(false)).rejects.toThrow('Rate Limit Exceeded')
  })

  it('applies global limits', async () => {
    const makeCall = () => client.call('io.example.noLimit')
    const calls: Promise<unknown>[] = []
    for (let i = 0; i < 110; i++) {
      calls.push(makeCall())
    }
    await expect(Promise.all(calls)).rejects.toThrow('Rate Limit Exceeded')
  })

  it('applies global limits to xrpc catchall', async () => {
    const makeCall = () => client.call('io.example.nonExistent')
    await expect(makeCall()).rejects.toThrow('Rate Limit Exceeded')
  })

  it('can bypass rate limits', async () => {
    const makeCall = () =>
      client.call(
        'io.example.noLimit',
        {},
        {},
        { headers: { 'X-RateLimit-Bypass': 'bypass' } },
      )
    const calls: Promise<unknown>[] = []
    for (let i = 0; i < 110; i++) {
      calls.push(makeCall())
    }
    await Promise.all(calls)
  })
})
