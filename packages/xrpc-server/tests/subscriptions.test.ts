import * as http from 'http'
import { WebSocket, createWebSocketStream } from 'ws'
import { byFrame, MessageFrame, ErrorFrame, Frame } from '../src'
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
          codes: {
            '#even': 0,
            'io.example.stream2#odd': 1,
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

  server.streamMethod('io.example.stream1', async function* ({ params }) {
    const countdown = Number(params.countdown ?? 0)
    for (let i = countdown; i >= 0; i--) {
      yield { count: i }
    }
  })

  server.streamMethod('io.example.stream2', async function* ({ params }) {
    const countdown = Number(params.countdown ?? 0)
    for (let i = countdown; i >= 0; i--) {
      yield {
        $type:
          i % 2 === 0 ? 'io.example.stream2#even' : 'io.example.stream2#odd',
        count: i,
      }
    }
    yield { $type: 'io.example.stream2#done' }
  })

  server.streamMethod('io.example.streamAuth', {
    auth: createBasicAuth({ username: 'admin', password: 'password' }),
    handler: async function* ({ auth }) {
      yield auth
    },
  })

  beforeAll(async () => {
    s = await createServer(8895, server)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('streams messages', async () => {
    const ws = new WebSocket(
      'ws://localhost:8895/xrpc/io.example.stream1?countdown=5',
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
      'ws://localhost:8895/xrpc/io.example.stream2?countdown=5',
    )

    const frames: Frame[] = []
    for await (const frame of byFrame(ws)) {
      frames.push(frame)
    }

    expect(frames).toEqual([
      new MessageFrame({ count: 5 }, { type: 1 }),
      new MessageFrame({ count: 4 }, { type: 0 }),
      new MessageFrame({ count: 3 }, { type: 1 }),
      new MessageFrame({ count: 2 }, { type: 0 }),
      new MessageFrame({ count: 1 }, { type: 1 }),
      new MessageFrame({ count: 0 }, { type: 0 }),
      new MessageFrame({ $type: 'io.example.stream2#done' }),
    ])
  })

  it('resolves auth into handler', async () => {
    const ws = new WebSocket('ws://localhost:8895/xrpc/io.example.streamAuth', {
      headers: basicAuthHeaders({
        username: 'admin',
        password: 'password',
      }),
    })

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
    const ws = new WebSocket('ws://localhost:8895/xrpc/io.example.stream1')

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
    const ws = new WebSocket('ws://localhost:8895/xrpc/io.example.streamAuth', {
      headers: basicAuthHeaders({
        username: 'bad',
        password: 'wrong',
      }),
    })

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
    const ws = new WebSocket('ws://localhost:8895/xrpc/does.not.exist')
    const drainStream = async () => {
      for await (const bytes of createWebSocketStream(ws)) {
        bytes // drain
      }
    }
    expect(drainStream).rejects.toThrow('ECONNREFUSED')
  })
})
