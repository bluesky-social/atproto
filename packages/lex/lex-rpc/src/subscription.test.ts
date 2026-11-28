import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { type WebSocket, WebSocketServer } from 'ws'
import { type LexValue, encode } from '@atproto/lex-cbor'
import { l } from '@atproto/lex-schema'
import {
  CloseCode,
  CloseError,
  SocketError,
  UnexpectedResponseError,
  type WebSocketIterable,
  type WebSocketOptions,
  websocket as wsClientWebsocket,
} from '@atproto/ws-client'
import {
  type Agent,
  type WebSocketFactory,
  type WebSocketHandler,
  type WebSocketHandlerOptions,
  buildAgent,
} from './agent.js'
import type { TransientError } from './errors.js'
import {
  XrpcSubscriptionConnectionError,
  XrpcSubscriptionError,
  XrpcSubscriptionFrameError,
  XrpcSubscriptionMessageError,
  XrpcSubscriptionParamsError,
  XrpcSubscriptionServerError,
  isRetryableSubscriptionError,
} from './subscription-errors.js'
import {
  type WebSocketFactoryOptions,
  type XrpcSubscriptionIterable,
  createWebSocketFactory,
  defaultSubscriptionShouldReconnect,
  defaultWebsocket,
  xrpcSubscribe,
} from './subscription.js'

// Spied on (calling through) to check the options `createWebSocketFactory`
// passes to it.
vi.mock('@atproto/ws-client', async (importOriginal) => {
  const actual = await importOriginal<{
    websocket: typeof wsClientWebsocket
  }>()
  return { ...actual, websocket: vi.fn(actual.websocket) }
})

/* -------------------------------------------------------------------------- */
/* Test schemas                                                               */
/* -------------------------------------------------------------------------- */

type Event = {
  $type?: 'com.example.subscribeEvents#event'
  seq: number
  text: string
  lang: string
}
const event = l.typedObject<Event>(
  'com.example.subscribeEvents',
  'event',
  l.object({
    seq: l.integer(),
    text: l.string(),
    lang: l.withDefault(l.string(), 'en'),
  }),
)

type Notice = { $type?: 'com.example.notice#main'; message: string }
const notice = l.typedObject<Notice>(
  'com.example.notice',
  'main',
  l.object({ message: l.string() }),
)

const subscribeEvents = l.subscription(
  'com.example.subscribeEvents',
  l.params({ cursor: l.optional(l.integer()) }),
  l.typedUnion(
    [
      l.typedRef<Event>((() => event) as any),
      l.typedRef<Notice>((() => notice) as any),
    ],
    false,
  ),
  ['FutureCursor'],
)

const subscribeTopic = l.subscription(
  'com.example.subscribeTopic',
  l.params({ topic: l.string() }),
  l.typedUnion([l.typedRef<Event>((() => event) as any)], false),
)

/* -------------------------------------------------------------------------- */
/* Test server                                                                */
/* -------------------------------------------------------------------------- */

function frame(header: LexValue, body: LexValue): Buffer {
  return Buffer.concat([encode(header), encode(body)])
}

const eventFrame = (seq: number, text = `event ${seq}`) =>
  frame({ op: 1, t: '#event' }, { seq, text })

const errorFrame = (error: string, message?: string) =>
  frame({ op: -1 }, message ? { error, message } : { error })

type Connection = { ws: WebSocket; req: IncomingMessage; index: number }

/**
 * Starts a WebSocket server; dispose with `await using`. `onConnection` is
 * called for every accepted connection, with its 0-based index. `status`, when
 * set, rejects every upgrade request with that HTTP status instead.
 */
async function startServer(
  onConnection: (connection: Connection) => void,
  { status }: { status?: number } = {},
) {
  const requests: IncomingMessage[] = []
  const closes: number[] = []
  const server = createServer()
  const wss = new WebSocketServer({
    server,
    verifyClient: (info, callback) => {
      requests.push(info.req)
      if (status) callback(false, status)
      else callback(true)
    },
  })
  let index = 0
  wss.on('connection', (ws, req) => {
    ws.on('close', (code) => closes.push(code))
    onConnection({ ws, req, index: index++ })
  })
  await once(server.listen(0), 'listening')
  const { port } = server.address() as AddressInfo
  return {
    origin: new URL(`ws://localhost:${port}`),
    requests,
    closes,
    async [Symbol.asyncDispose]() {
      for (const ws of wss.clients) ws.terminate()
      wss.close()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    },
  }
}

async function drain<T>(gen: AsyncGenerator<T, void, unknown>): Promise<T[]> {
  const out: T[] = []
  for await (const m of gen) out.push(m)
  return out
}

// Drains into `out`, so a test can assert what was yielded before a rejection.
async function drainInto<T>(
  gen: AsyncGenerator<T, void, unknown>,
  out: T[],
): Promise<void> {
  for await (const m of gen) out.push(m)
}

const unusedFetchHandler = () => {
  throw new Error('Subscriptions must not use the fetch handler')
}

/**
 * {@link createWebSocketFactory}, with reconnects that don't wait
 * (`maxReconnectSeconds: 0` caps the backoff at 0ms).
 */
function wsFactory(options: WebSocketFactoryOptions = {}): WebSocketFactory {
  return createWebSocketFactory({ maxReconnectSeconds: 0, ...options })
}

function wsAgent(service: URL, options?: WebSocketFactoryOptions): Agent {
  return buildAgent({ service, websocket: wsFactory(options) })
}

/** An agent whose stream yields `frames`, then ends, without `throw()`. */
function framesAgent(frames: Uint8Array[]) {
  const returned = vi.fn()
  const agent: Agent = {
    fetchHandler: unusedFetchHandler,
    websocketHandler: () => ({
      [Symbol.asyncIterator]: () => {
        const it = frames.map((f) => new Uint8Array(f)).values()
        return {
          next: async () => it.next(),
          return: async () => {
            returned()
            return { done: true, value: undefined }
          },
        }
      },
    }),
  }
  return { agent, returned }
}

// Never pulled: only used for type-level tests.
const unconnectedAgent = wsAgent(new URL('ws://example.com'))

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe(xrpcSubscribe, () => {
  describe('messages', () => {
    it('yields validated messages with their $type restored from the header', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(eventFrame(1))
        ws.send(frame({ op: 1, t: 'com.example.notice' }, { message: 'hi' }))
        ws.close(CloseCode.Normal)
      })
      const messages = await drain(
        xrpcSubscribe(wsAgent(server.origin), subscribeEvents),
      )
      expect(messages).toEqual([
        // `lang` was filled in by the schema's default
        {
          $type: 'com.example.subscribeEvents#event',
          seq: 1,
          text: 'event 1',
          lang: 'en',
        },
        { $type: 'com.example.notice', message: 'hi' },
      ])
    })

    it('passes messages of unknown types through an open union', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 1, t: '#future' }, { anything: true }))
        ws.close(CloseCode.Normal)
      })
      expect(
        await drain(xrpcSubscribe(wsAgent(server.origin), subscribeEvents)),
      ).toEqual([
        { $type: 'com.example.subscribeEvents#future', anything: true },
      ])
    })

    it('ignores frames with an unknown op', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 2, t: '#event' }, { seq: 1, text: '' }))
        ws.send(eventFrame(2))
        ws.close(CloseCode.Normal)
      })
      const messages = await drain(
        xrpcSubscribe(wsAgent(server.origin), subscribeEvents),
      )
      expect(messages.map((m) => 'seq' in m && m.seq)).toEqual([2])
    })

    it.each([
      ['no value', encode({ op: 2 })],
      [
        'several values',
        Buffer.concat([encode({ op: 2 }), encode({ seq: 1 }), encode([1, 2])]),
      ],
      [
        'undecodable data',
        Buffer.concat([encode({ op: 2 }), Buffer.from([0xff, 0x00])]),
      ],
    ])(
      'ignores frames with an unknown op and %s after their header',
      async (_, data) => {
        await using server = await startServer(({ ws }) => {
          ws.send(data)
          ws.send(eventFrame(2))
          ws.close(CloseCode.Normal)
        })
        const messages = await drain(
          xrpcSubscribe(wsAgent(server.origin), subscribeEvents),
        )
        expect(messages.map((m) => 'seq' in m && m.seq)).toEqual([2])
      },
    )

    it('types messages from the schema', () => {
      const gen = xrpcSubscribe(unconnectedAgent, subscribeEvents)
      expectTypeOf(gen).toEqualTypeOf<
        XrpcSubscriptionIterable<typeof subscribeEvents>
      >()
      expectTypeOf<
        Extract<
          XrpcSubscriptionIterable<
            typeof subscribeEvents
          > extends AsyncGenerator<infer T>
            ? T
            : never,
          { $type: 'com.example.subscribeEvents#event' }
        >
      >().toHaveProperty('lang')
    })
  })

  describe('params', () => {
    it('sends params in the query string', async () => {
      await using server = await startServer(({ ws }) => {
        ws.close(CloseCode.Normal)
      })
      await drain(
        xrpcSubscribe(wsAgent(server.origin), subscribeEvents, {
          params: { cursor: 42 },
        }),
      )
      expect(server.requests.map((r) => r.url)).toEqual([
        '/xrpc/com.example.subscribeEvents?cursor=42',
      ])
    })

    it('re-invokes a params function on every connection', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) {
          ws.send(eventFrame(7), () => ws.terminate())
        } else {
          ws.close(CloseCode.Normal)
        }
      })
      let cursor: number | undefined
      for await (const message of xrpcSubscribe(
        wsAgent(server.origin),
        subscribeEvents,
        { params: async () => ({ cursor }) },
      )) {
        if ('seq' in message) cursor = message.seq
      }
      expect(server.requests.map((r) => r.url)).toEqual([
        '/xrpc/com.example.subscribeEvents',
        '/xrpc/com.example.subscribeEvents?cursor=7',
      ])
    })

    it('rejects invalid params on the first pull', async () => {
      await using server = await startServer(() => {})
      const gen = xrpcSubscribe(wsAgent(server.origin), subscribeEvents, {
        // @ts-expect-error invalid type
        params: { cursor: 'nope' },
      })
      await expect(gen.next()).rejects.toThrow()
      expect(server.requests).toHaveLength(0)
    })

    it.each([
      ['an error', new Error('no cursor'), false],
      // e.g. an XrpcError, from a cursor looked up over XRPC
      [
        'a transient error',
        Object.assign(new Error('unavailable'), { shouldRetry: () => true }),
        true,
      ],
      [
        'a non-transient error',
        Object.assign(new Error('invalid'), { shouldRetry: () => false }),
        false,
      ],
    ])('wraps %s thrown by a params function', async (_, error, retryable) => {
      await using server = await startServer(() => {})
      const gen = xrpcSubscribe(
        wsAgent(server.origin, { shouldReconnect: false }),
        subscribeEvents,
        {
          params: () => {
            throw error
          },
        },
      )
      await expect(gen.next()).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionParamsError)
        expect(err.cause).toBe(error)
        expect(err.shouldRetry()).toBe(retryable)
        return true
      })
      expect(server.requests).toHaveLength(0)
    })

    it('wraps invalid params, without retrying', async () => {
      await using server = await startServer(() => {})
      const gen = xrpcSubscribe(wsAgent(server.origin), subscribeEvents, {
        params: { cursor: 'one' as unknown as number },
      })
      await expect(gen.next()).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionParamsError)
        expect(err.shouldRetry()).toBe(false)
        return true
      })
      expect(server.requests).toHaveLength(0)
    })

    it('retries a params function failing with a transient error', async () => {
      await using server = await startServer(({ ws }) => {
        ws.close(CloseCode.Normal)
      })
      const unavailable = Object.assign(new Error('unavailable'), {
        shouldRetry: () => true,
      })
      const params = vi
        .fn<() => { cursor: number }>()
        .mockImplementationOnce(() => {
          throw unavailable
        })
        .mockReturnValue({ cursor: 1 })
      await drain(
        xrpcSubscribe(wsAgent(server.origin), subscribeEvents, { params }),
      )
      expect(params).toHaveBeenCalledTimes(2)
      expect(server.requests.map((r) => r.url)).toEqual([
        '/xrpc/com.example.subscribeEvents?cursor=1',
      ])
    })

    it('rejects with the abort reason thrown by a params function', async () => {
      // A handler passing the URL's errors through as-is (where ws-client would
      // end with the abort reason itself)
      const agent: Agent = {
        fetchHandler: unusedFetchHandler,
        websocketHandler: (path) => ({
          [Symbol.asyncIterator]: () => ({
            next: async () => {
              await path()
              return { done: true, value: undefined }
            },
          }),
        }),
      }
      const controller = new AbortController()
      const reason = new Error('stopped')
      const gen = xrpcSubscribe(agent, subscribeEvents, {
        signal: controller.signal,
        params: () => {
          controller.abort(reason)
          throw reason
        },
      })
      await expect(gen.next()).rejects.toBe(reason)
    })

    it('requires the options argument when params are required', () => {
      // @ts-expect-error missing required "topic" param
      xrpcSubscribe(unconnectedAgent, subscribeTopic)
      xrpcSubscribe(unconnectedAgent, subscribeTopic, {
        params: { topic: 'x' },
      })
      xrpcSubscribe(unconnectedAgent, subscribeTopic, {
        params: () => ({ topic: 'x' }),
      })
    })
  })

  describe('agent', () => {
    it('throws for an agent without a websocketHandler', () => {
      expect(() =>
        xrpcSubscribe({ fetchHandler: unusedFetchHandler }, subscribeEvents),
      ).toThrow(TypeError)
      expect(() =>
        // @ts-expect-error a FetchHandler cannot subscribe
        xrpcSubscribe(unusedFetchHandler, subscribeEvents),
      ).toThrow(TypeError)
    })

    it('builds an agent with the default websocket from a service', async () => {
      await using server = await startServer(({ ws }) => {
        ws.close(CloseCode.Normal)
      })
      await drain(xrpcSubscribe(server.origin, subscribeEvents))
      await drain(xrpcSubscribe(server.origin.href, subscribeEvents))
      await drain(
        xrpcSubscribe(
          { service: server.origin, headers: { 'x-example': 'value' } },
          subscribeEvents,
        ),
      )
      expect(server.requests).toHaveLength(3)
      expect(server.requests[2].headers).toMatchObject({ 'x-example': 'value' })
    })

    it("builds an agent with the config's own websocket", async () => {
      await using server = await startServer(({ ws }) => {
        ws.close(CloseCode.Normal)
      })
      const factory = vi.fn(wsFactory())
      await drain(
        xrpcSubscribe(
          { service: server.origin, websocket: factory },
          subscribeEvents,
        ),
      )
      expect(factory).toHaveBeenCalledOnce()
      expect(server.requests).toHaveLength(1)
    })

    it("connects through the agent's websocketHandler", async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) ws.terminate()
        else ws.close(CloseCode.Normal)
      })
      const { websocketHandler: handler } = wsAgent(server.origin)
      assert(handler)
      const agent: Agent = {
        fetchHandler: unusedFetchHandler,
        websocketHandler: vi.fn<WebSocketHandler>(function (this: Agent, ...a) {
          expect(this).toBe(agent)
          return handler(...a)
        }),
      }
      let cursor = 1
      await drain(
        xrpcSubscribe(agent, subscribeEvents, {
          params: () => ({ cursor: cursor++ }),
        }),
      )
      // Invoked once per subscription, with a path resolved per connection
      expect(agent.websocketHandler).toHaveBeenCalledOnce()
      expect(server.requests.map((r) => r.url)).toEqual([
        '/xrpc/com.example.subscribeEvents?cursor=1',
        '/xrpc/com.example.subscribeEvents?cursor=2',
      ])
    })

    it("sends the agent's and the subscription's headers", async () => {
      await using server = await startServer(({ ws }) => {
        ws.close(CloseCode.Normal)
      })
      const agent = buildAgent({
        service: server.origin,
        headers: { 'x-default': 'yes', 'x-example': 'default' },
        websocket: wsFactory(),
      })
      await drain(
        xrpcSubscribe(agent, subscribeEvents, {
          headers: { 'x-example': 'value' },
        }),
      )
      expect(server.requests).toHaveLength(1)
      expect(server.requests[0].headers).toMatchObject({
        'x-default': 'yes',
        'x-example': 'value',
      })
    })

    it('ends the stream on an invalid frame when the handler cannot take it back', async () => {
      const { agent, returned } = framesAgent([
        eventFrame(1),
        new Uint8Array([0xff, 0x00]),
        eventFrame(2),
      ])
      const out: unknown[] = []
      await expect(
        drainInto(xrpcSubscribe(agent, subscribeEvents), out),
      ).rejects.toBeInstanceOf(XrpcSubscriptionFrameError)
      expect(out).toHaveLength(1)
      expect(returned).toHaveBeenCalledOnce()
    })

    it('is compatible with @atproto/ws-client', () => {
      expectTypeOf<WebSocketHandlerOptions>().toExtend<
        WebSocketOptions<'binary'>
      >()
      expectTypeOf<Parameters<WebSocketFactory>[0]>().toExtend<
        Parameters<typeof wsClientWebsocket>[0]
      >()
      expectTypeOf<WebSocketIterable<'binary'>>().toExtend<
        ReturnType<WebSocketFactory>
      >()
      expectTypeOf<UnexpectedResponseError>().toExtend<TransientError>()
    })
  })

  describe('server errors', () => {
    it('rejects with a typed error for an error frame, without retrying declared errors', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(eventFrame(1))
        ws.send(errorFrame('FutureCursor', 'Cursor in the future'))
      })
      const onError = vi.fn()
      const out: unknown[] = []
      const error = await drainInto(
        xrpcSubscribe(wsAgent(server.origin, { onError }), subscribeEvents),
        out,
      ).then(
        () => assert.fail('expected a rejection'),
        (err: unknown) => err,
      )

      assert(error instanceof XrpcSubscriptionServerError)
      expect(error.matchesSchemaErrors()).toBe(true)
      expect(error.error).toBe('FutureCursor')
      expect(error.message).toBe('Cursor in the future')
      expect(error.shouldRetry()).toBe(false)
      expect(error.method).toBe(subscribeEvents)
      expect(out).toHaveLength(1)
      expect(server.requests).toHaveLength(1)
      // The client closes the connection right after the error frame.
      await vi.waitFor(() => expect(server.closes).toEqual([CloseCode.Normal]))
      // Handed back to the handler as-is
      expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    })

    it('narrows the error code to the declared ones', () => {
      const error: XrpcSubscriptionServerError<typeof subscribeEvents> =
        new XrpcSubscriptionServerError(subscribeEvents, { error: 'Other' })
      expect(error.matchesSchemaErrors()).toBe(false)
      if (error.matchesSchemaErrors()) {
        expectTypeOf(error.error).toEqualTypeOf<'FutureCursor'>()
      }
    })

    it('hands a transient error frame back to the handler, which reconnects', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) ws.send(errorFrame('InternalServerError'))
        else ws.send(eventFrame(1), () => ws.close(CloseCode.Normal))
      })
      const onReconnect = vi.fn()
      const messages = await drain(
        xrpcSubscribe(wsAgent(server.origin, { onReconnect }), subscribeEvents),
      )
      expect(messages).toHaveLength(1)
      expect(onReconnect).toHaveBeenCalledExactlyOnceWith(
        expect.any(XrpcSubscriptionServerError),
        { attempt: 0 },
      )
    })
  })

  describe('invalid messages', () => {
    it.each([
      ['undecodable CBOR', Buffer.from([0xff, 0x00])],
      ['a missing body', encode({ op: 1 })],
      ['an extra item', Buffer.concat([eventFrame(1), encode(1)])],
      ['a non-object header', frame('op', {})],
      ['a non-integer op', frame({ op: 'one' }, {})],
      ['a typed non-object body', frame({ op: 1, t: '#event' }, 'body')],
      ['a missing error body', encode({ op: -1 })],
      [
        'an extra item after an error',
        Buffer.concat([errorFrame('InternalServerError'), encode(1)]),
      ],
      ['an invalid error body', frame({ op: -1 }, { message: 'no code' })],
      ['an invalid error code', frame({ op: -1 }, { error: 'not a code' })],
    ])('drops the connection on %s', async (_, data) => {
      await using server = await startServer(({ ws }) => ws.send(data))
      await expect(
        drain(xrpcSubscribe(wsAgent(server.origin), subscribeEvents)),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionFrameError)
        expect(err).not.toBeInstanceOf(XrpcSubscriptionMessageError)
        expect(err.shouldRetry()).toBe(false)
        return true
      })
      expect(server.requests).toHaveLength(1)
    })

    it('rejects with a validation error for a message not matching the schema', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 1, t: '#event' }, { seq: 'one', text: 'x' }))
      })
      await expect(
        drain(xrpcSubscribe(wsAgent(server.origin), subscribeEvents)),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionMessageError)
        expect(err.value).toEqual({
          $type: 'com.example.subscribeEvents#event',
          seq: 'one',
          text: 'x',
        })
        expect(err.shouldRetry()).toBe(false)
        return true
      })
    })

    it('hands an invalid message back to the handler, which may reconnect', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) {
          ws.send(frame({ op: 1, t: '#event' }, { seq: 'one', text: 'x' }))
        } else {
          ws.send(eventFrame(2), () => ws.close(CloseCode.Normal))
        }
      })
      const onReconnect = vi.fn()
      const agent = wsAgent(server.origin, {
        shouldReconnect: (error) =>
          error instanceof XrpcSubscriptionMessageError,
        onReconnect,
      })
      const messages = await drain(xrpcSubscribe(agent, subscribeEvents))
      expect(messages).toHaveLength(1)
      expect(onReconnect).toHaveBeenCalledExactlyOnceWith(
        expect.any(XrpcSubscriptionMessageError),
        { attempt: 0 },
      )
      expect(server.requests).toHaveLength(2)
    })

    it('yields messages as-is when validation is disabled', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 1, t: '#event' }, { seq: 'one', text: 'x' }))
        ws.close(CloseCode.Normal)
      })
      const messages = await drain(
        xrpcSubscribe(wsAgent(server.origin), subscribeEvents, {
          validateResponse: false,
        }),
      )
      expect(messages).toEqual([
        { $type: 'com.example.subscribeEvents#event', seq: 'one', text: 'x' },
      ])
    })

    it.each([
      ['a null error body', frame({ op: -1 }, null)],
      ['an error body without a code', frame({ op: -1 }, { message: 'x' })],
    ])(
      'checks error frames when validation is disabled, rejecting %s',
      async (_, data) => {
        const { agent } = framesAgent([data])
        await expect(
          drain(
            xrpcSubscribe(agent, subscribeEvents, { validateResponse: false }),
          ),
        ).rejects.toSatisfy((err) => {
          assert(err instanceof XrpcSubscriptionFrameError)
          return true
        })
      },
    )
  })

  describe('connection errors', () => {
    it('wraps a rejected upgrade, without retrying a 404', async () => {
      await using server = await startServer(() => {}, { status: 404 })
      const onError = vi.fn()
      const error = await drain(
        xrpcSubscribe(wsAgent(server.origin, { onError }), subscribeEvents),
      ).then(
        () => assert.fail('expected a rejection'),
        (err: unknown) => err,
      )
      assert(error instanceof XrpcSubscriptionConnectionError)
      expect(error).toBeInstanceOf(XrpcSubscriptionError)
      assert(error.cause instanceof UnexpectedResponseError)
      expect(error.cause.status).toBe(404)
      expect(error.error).toBe('UpstreamFailure')
      expect(error.shouldRetry()).toBe(false)
      expect(server.requests).toHaveLength(1)
      // The handler's own hooks see its own error
      expect(onError).toHaveBeenCalledExactlyOnceWith(error.cause)
    })

    it('wraps a dropped connection', async () => {
      await using server = await startServer(({ ws }) => ws.terminate())
      const agent = wsAgent(server.origin, { shouldReconnect: false })
      await expect(
        drain(xrpcSubscribe(agent, subscribeEvents)),
      ).rejects.toBeInstanceOf(XrpcSubscriptionConnectionError)
      expect(server.requests).toHaveLength(1)
    })

    it('wraps any handler error classifying itself', async () => {
      class CustomError extends Error {
        shouldRetry() {
          return true
        }
      }
      const cause = new CustomError('custom')
      const agent: Agent = {
        fetchHandler: unusedFetchHandler,
        websocketHandler: () => ({
          [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(cause) }),
        }),
      }
      await expect(
        drain(xrpcSubscribe(agent, subscribeEvents)),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionConnectionError)
        expect(err.cause).toBe(cause)
        expect(err.shouldRetry()).toBe(true)
        return true
      })
    })
  })

  describe('lifecycle', () => {
    it('closes the connection when the consumer breaks out', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(eventFrame(1))
      })
      for await (const _ of xrpcSubscribe(
        wsAgent(server.origin),
        subscribeEvents,
      )) {
        break
      }
      await vi.waitFor(() => expect(server.closes).toEqual([CloseCode.Normal]))
    })

    it('rejects with the abort reason, unwrapped', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(eventFrame(1))
      })
      const controller = new AbortController()
      const reason = new Error('stop')
      const onError = vi.fn()
      const gen = xrpcSubscribe(
        wsAgent(server.origin, { onError }),
        subscribeEvents,
        { signal: controller.signal },
      )
      await expect(gen.next()).resolves.toMatchObject({ done: false })
      const pull = gen.next()
      controller.abort(reason)
      await expect(pull).rejects.toBe(reason)
      expect(onError).not.toHaveBeenCalled()
    })

    it('closes with the code of a CloseError abort reason, and rejects with it', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(eventFrame(1))
      })
      const controller = new AbortController()
      const reason = new CloseError(4000, 'shutting down', true)
      const gen = xrpcSubscribe(wsAgent(server.origin), subscribeEvents, {
        signal: controller.signal,
      })
      await gen.next()
      const pull = gen.next()
      controller.abort(reason)
      await expect(pull).rejects.toBe(reason)
      await vi.waitFor(() => expect(server.closes).toEqual([4000]))
    })

    it('rejects the first pull when the signal is already aborted', async () => {
      await using server = await startServer(() => {})
      const reason = new Error('nope')
      const gen = xrpcSubscribe(wsAgent(server.origin), subscribeEvents, {
        signal: AbortSignal.abort(reason),
      })
      await expect(gen.next()).rejects.toBe(reason)
      expect(server.requests).toHaveLength(0)
    })

    it('does not connect until the first pull', async () => {
      await using server = await startServer(() => {})
      const gen = xrpcSubscribe(wsAgent(server.origin), subscribeEvents)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(server.requests).toHaveLength(0)
      await gen.return()
    })
  })
})

describe(createWebSocketFactory, () => {
  const url = async () => new URL('ws://example.com/xrpc/x')

  it("opens a binary @atproto/ws-client stream with its options and the subscription's signal and headers", async () => {
    vi.mocked(wsClientWebsocket).mockClear()
    const onReconnect = vi.fn()
    const signal = new AbortController().signal
    const headers = { 'x-example': 'value' }
    const websocket = createWebSocketFactory({
      idleTimeoutMs: 1_000,
      onReconnect,
    })

    // Never pulled, so it never connects
    const stream = websocket(url, { signal, headers })

    expect(wsClientWebsocket).toHaveBeenCalledExactlyOnceWith(url, {
      idleTimeoutMs: 1_000,
      onReconnect,
      shouldReconnect: defaultSubscriptionShouldReconnect,
      signal,
      headers,
      dataMode: 'binary',
    })
    await stream[Symbol.asyncIterator]().return?.()
  })

  it('replaces the default reconnect policy with its shouldReconnect', async () => {
    const shouldReconnect = () => false
    const stream = createWebSocketFactory({ shouldReconnect })(url, {})
    expect(vi.mocked(wsClientWebsocket).mock.lastCall?.[1]).toMatchObject({
      shouldReconnect,
    })
    await stream[Symbol.asyncIterator]().return?.()
  })
})

describe('ws-client errors', () => {
  it.each([
    'BufferOverflowError',
    'CloseCode',
    'CloseError',
    'DataModeError',
    'HeartbeatTimeoutError',
    'IdleTimeoutError',
    'SocketError',
    'UnexpectedResponseError',
    'WebSocketClientError',
    'isReconnectableClose',
  ] as const)(
    're-exports %s, as the instance ws-client reports',
    async (name) => {
      const subscription = await import('./subscription.js')
      const wsClient = await import('@atproto/ws-client')
      expect(subscription[name]).toBeDefined()
      expect(subscription[name]).toBe(wsClient[name])
    },
  )

  it('tells apart the closes reported to the reconnect hooks', async () => {
    const subscription = await import('./subscription.js')
    await using server = await startServer(({ ws, index }) => {
      if (index === 0) ws.close(CloseCode.GoingAway)
      else ws.send(eventFrame(1), () => ws.close(CloseCode.Normal))
    })
    const onReconnect = vi.fn()
    const messages = await drain(
      xrpcSubscribe(wsAgent(server.origin, { onReconnect }), subscribeEvents),
    )
    expect(messages).toHaveLength(1)
    expect(onReconnect).toHaveBeenCalledExactlyOnceWith(
      expect.any(subscription.CloseError),
      { attempt: 0 },
    )
    expect(onReconnect.mock.calls[0][0]).toMatchObject({
      code: subscription.CloseCode.GoingAway,
    })
  })
})

describe(defaultSubscriptionShouldReconnect, () => {
  it.each([
    ['a ws-client connection failure', new SocketError(null), true],
    [
      'a transient error frame',
      new XrpcSubscriptionServerError(subscribeEvents, {
        error: 'InternalServerError',
      }),
      true,
    ],
    ['a normal close', new CloseError(CloseCode.Normal, '', true), false],
    [
      'a declared error frame',
      new XrpcSubscriptionServerError(subscribeEvents, {
        error: 'FutureCursor',
      }),
      false,
    ],
    [
      'an invalid frame',
      new XrpcSubscriptionFrameError(subscribeEvents, 'Invalid frame'),
      false,
    ],
    ['another error', new Error('other'), false],
  ])('classifies %s', (_, error, expected) => {
    expect(defaultSubscriptionShouldReconnect(error)).toBe(expected)
  })
})

describe(defaultWebsocket, () => {
  it('is a WebSocketFactory', () => {
    expectTypeOf(defaultWebsocket).toEqualTypeOf<WebSocketFactory>()
  })

  it('has the default options', async () => {
    vi.mocked(wsClientWebsocket).mockClear()
    const url = async () => new URL('ws://example.com/xrpc/x')
    const signal = new AbortController().signal

    // Never pulled, so it never connects
    const stream = defaultWebsocket(url, { signal })

    expect(wsClientWebsocket).toHaveBeenCalledExactlyOnceWith(url, {
      shouldReconnect: defaultSubscriptionShouldReconnect,
      signal,
      headers: undefined,
      dataMode: 'binary',
    })
    await stream[Symbol.asyncIterator]().return?.()
  })
})

describe(isRetryableSubscriptionError, () => {
  it.each([
    [
      'a transient server error',
      new XrpcSubscriptionServerError(subscribeEvents, {
        error: 'InternalServerError',
      }),
      true,
    ],
    [
      'a declared server error',
      new XrpcSubscriptionServerError(subscribeEvents, {
        error: 'FutureCursor',
      }),
      false,
    ],
    [
      'an invalid message',
      new XrpcSubscriptionFrameError(subscribeEvents, 'Invalid'),
      false,
    ],
    ['a ws-client error', new CloseError(1011, 'unexpected', true), false],
    ['a non-error', 'InternalServerError', false],
  ])('classifies %s', (_, error, expected) => {
    expect(isRetryableSubscriptionError(error)).toBe(expected)
  })
})
