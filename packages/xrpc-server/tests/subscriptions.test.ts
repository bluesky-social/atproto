import * as http from 'http'
import { WebSocket, createWebSocketStream } from 'ws'
import { createServer, closeServer } from './_util'
import * as xrpcServer from '../src'
import { Frame } from '@atproto/xrpc-stream'

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
        output: {
          encoding: 'application/cbor',
          schema: {
            type: 'object',
            required: ['count'],
            properties: { count: { type: 'integer' } },
          },
        },
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
      await new Promise(setImmediate) // @TODO frames combined in test without this wait
      yield { count: i }
    }
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
    for await (const bytes of createWebSocketStream(ws)) {
      frames.push(Frame.fromBytes(bytes))
    }

    const items = frames.map((frame) => frame.body)
    expect(items).toEqual([
      { count: 5 },
      { count: 4 },
      { count: 3 },
      { count: 2 },
      { count: 1 },
      { count: 0 },
    ])
  })
})
