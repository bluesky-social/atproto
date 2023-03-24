import * as http from 'http'
import { WebSocket, createWebSocketStream } from 'ws'
import getPort from 'get-port'
import { wait } from '@atproto/common'
import { byFrame, MessageFrame, ErrorFrame, Frame, Subscription } from '../src'
import {
  createServer,
  closeServer,
  createBasicAuth,
  basicAuthHeaders,
} from './_util'
import * as xrpcServer from '../src'

const LEXICONS = [
  {
    lexicon: 1,
    id: 'io.example.stream1',
    defs: {
      main: {
        type: 'subscription',
        parameters: {
          type: 'params',
          required: ['countdown'],
          properties: {
            countdown: { type: 'integer' },
          },
        },
        message: {
          schema: {
            type: 'object',
            required: ['count'],
            properties: { count: { type: 'integer' } },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.stream2',
    defs: {
      main: {
        type: 'subscription',
        parameters: {
          type: 'params',
          required: ['countdown'],
          properties: {
            countdown: { type: 'integer' },
          },
        },
        message: {
          schema: {
            type: 'union',
            refs: ['#even', '#odd'],
          },
        },
      },
      even: {
        type: 'object',
        required: ['count'],
        properties: { count: { type: 'integer' } },
      },
      odd: {
        type: 'object',
        required: ['count'],
        properties: { count: { type: 'integer' } },
      },
    },
  },
  {
    lexicon: 1,
    id: 'io.example.streamAuth',
    defs: {
      main: {
        type: 'subscription',
      },
    },
  },
]

describe('Subscriptions', () => {
  let s: http.Server

  const server = xrpcServer.createServer(LEXICONS)
  const lex = server.lex

  server.streamMethod('io.example.stream1', async function* ({ params }) {
    const countdown = Number(params.countdown ?? 0)
    for (let i = countdown; i >= 0; i--) {
      await wait(0)
      yield { count: i }
    }
  })

  server.streamMethod('io.example.stream2', async function* ({ params }) {
    const countdown = Number(params.countdown ?? 0)
    for (let i = countdown; i >= 0; i--) {
      yield {
        $type: i % 2 === 0 ? '#even' : 'io.example.stream2#odd',
        count: i,
      }
    }
    yield {
      $type: 'io.example.otherNsid#done',
    }
  })

  server.streamMethod('io.example.streamAuth', {
    auth: createBasicAuth({ username: 'admin', password: 'password' }),
    handler: async function* ({ auth }) {
      yield auth
    },
  })

  let port: number

  beforeAll(async () => {
    port = await getPort()
    s = await createServer(port, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('streams messages', async () => {
    const ws = new WebSocket(
      `ws://localhost:${port}/xrpc/io.example.stream1?countdown=5`,
    )

    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new MessageFrame({ count: 5 }),
      new MessageFrame({ count: 4 }),
      new MessageFrame({ count: 3 }),
      new MessageFrame({ count: 2 }),
      new MessageFrame({ count: 1 }),
      new MessageFrame({ count: 0 }),
    ])
  })

  it('streams messages in a union', async () => {
    const ws = new WebSocket(
      `ws://localhost:${port}/xrpc/io.example.stream2?countdown=5`,
    )

    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new MessageFrame({ count: 5 }, { type: '#odd' }),
      new MessageFrame({ count: 4 }, { type: '#even' }),
      new MessageFrame({ count: 3 }, { type: '#odd' }),
      new MessageFrame({ count: 2 }, { type: '#even' }),
      new MessageFrame({ count: 1 }, { type: '#odd' }),
      new MessageFrame({ count: 0 }, { type: '#even' }),
      new MessageFrame({}, { type: 'io.example.otherNsid#done' }),
    ])
  })

  it('resolves auth into handler', async () => {
    const ws = new WebSocket(
      `ws://localhost:${port}/xrpc/io.example.streamAuth`,
      {
        headers: basicAuthHeaders({
          username: 'admin',
          password: 'password',
        }),
      },
    )

    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new MessageFrame({
        credentials: {
          username: 'admin',
        },
        artifacts: {
          original: 'YWRtaW46cGFzc3dvcmQ=',
        },
      }),
    ])
  })

  it('errors immediately on bad parameter', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/xrpc/io.example.stream1`)

    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new ErrorFrame({
        error: 'InvalidRequest',
        message: 'Error: Params must have the property "countdown"',
      }),
    ])
  })

  it('errors immediately on bad auth', async () => {
    const ws = new WebSocket(
      `ws://localhost:${port}/xrpc/io.example.streamAuth`,
      {
        headers: basicAuthHeaders({
          username: 'bad',
          password: 'wrong',
        }),
      },
    )

    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new ErrorFrame({
        error: 'AuthenticationRequired',
        message: 'Authentication Required',
      }),
    ])
  })

  it('does not websocket upgrade at bad endpoint', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/xrpc/does.not.exist`)
    const drainStream = async () => {
      for await (const bytes of createWebSocketStream(ws)) {
        bytes // drain
      }
    }
    await expect(drainStream).rejects.toHaveProperty('code', 'ECONNRESET')
  })

  describe('Subscription consumer', () => {
    it('receives messages w/ skips', async () => {
      const sub = new Subscription({
        service: `ws://localhost:${port}`,
        method: 'io.example.stream1',
        getParams: () => ({ countdown: 5 }),
        validate: (obj) => {
          const result = lex.assertValidXrpcMessage<{ count: number }>(
            'io.example.stream1',
            obj,
          )
          if (!result.count || result.count % 2) {
            return result
          }
        },
      })

      const messages: { count: number }[] = []
      for await (const msg of sub) {
        messages.push(msg)
      }

      expect(messages).toEqual([
        { count: 5 },
        { count: 3 },
        { count: 1 },
        { count: 0 },
      ])
    })

    it('reconnects w/ param update', async () => {
      let countdown = 10
      let reconnects = 0
      const sub = new Subscription({
        service: `ws://localhost:${port}`,
        method: 'io.example.stream1',
        onReconnectError: () => reconnects++,
        getParams: () => ({ countdown }),
        validate: (obj) => {
          return lex.assertValidXrpcMessage<{ count: number }>(
            'io.example.stream1',
            obj,
          )
        },
      })

      let disconnected = false
      for await (const msg of sub) {
        expect(msg.count).toBeGreaterThanOrEqual(countdown - 1) // No skips
        countdown = Math.min(countdown, msg.count) // Only allow forward movement
        if (msg.count <= 6 && !disconnected) {
          disconnected = true
          server.subscriptions.forEach(({ wss }) => {
            wss.clients.forEach((c) => c.terminate())
          })
        }
      }

      expect(countdown).toEqual(0)
      expect(reconnects).toBeGreaterThan(0)
    })

    it('aborts with signal', async () => {
      const abortController = new AbortController()
      const sub = new Subscription({
        service: `ws://localhost:${port}`,
        method: 'io.example.stream1',
        signal: abortController.signal,
        getParams: () => ({ countdown: 10 }),
        validate: (obj) => {
          const result = lex.assertValidXrpcMessage<{ count: number }>(
            'io.example.stream1',
            obj,
          )
          return result
        },
      })

      let error
      let disconnected = false
      const messages: { count: number }[] = []
      try {
        for await (const msg of sub) {
          messages.push(msg)
          if (msg.count <= 6 && !disconnected) {
            disconnected = true
            abortController.abort(new Error('Oops!'))
          }
        }
      } catch (err) {
        error = err
      }

      expect(error).toEqual(new Error('Oops!'))
      expect(messages).toEqual([
        { count: 10 },
        { count: 9 },
        { count: 8 },
        { count: 7 },
        { count: 6 },
      ])
    })
  })
})
