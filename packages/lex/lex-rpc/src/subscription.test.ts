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
  UnexpectedResponseError,
  createWebSocketFetch,
} from '@atproto/ws-client'
import { type FetchHandler, buildAgent } from './agent.js'
import {
  XrpcSubscriptionConnectionError,
  XrpcSubscriptionError,
  XrpcSubscriptionInvalidMessageError,
  XrpcSubscriptionServerError,
  XrpcSubscriptionValidationError,
} from './subscription-errors.js'
import { type XrpcSubscriptionIterable, xrpcSubscribe } from './subscription.js'

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
 * set, rejects every upgrade request with that HTTP status instead, as does
 * `authorize` with a `401`, for the requests it returns `false` for.
 */
async function startServer(
  onConnection: (connection: Connection) => void,
  {
    status,
    authorize,
  }: { status?: number; authorize?: (req: IncomingMessage) => boolean } = {},
) {
  const requests: IncomingMessage[] = []
  const closes: number[] = []
  const server = createServer()
  const wss = new WebSocketServer({
    server,
    verifyClient: (info, callback) => {
      requests.push(info.req)
      if (status) callback(false, status)
      else if (authorize && !authorize(info.req)) callback(false, 401)
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
    origin: `http://localhost:${port}`,
    requests,
    closes,
    async [Symbol.asyncDispose]() {
      for (const ws of wss.clients) ws.terminate()
      wss.close()
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
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

// maxReconnectSeconds: 0 caps the backoff at 0ms, so reconnects don't wait.
const noBackoff = { maxReconnectSeconds: 0 }

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
        xrpcSubscribe(server.origin, subscribeEvents, noBackoff),
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
        await drain(xrpcSubscribe(server.origin, subscribeEvents, noBackoff)),
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
        xrpcSubscribe(server.origin, subscribeEvents, noBackoff),
      )
      expect(messages.map((m) => 'seq' in m && m.seq)).toEqual([2])
    })

    it('types messages from the schema', () => {
      const gen = xrpcSubscribe('https://example.com', subscribeEvents)
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
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
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
        server.origin,
        subscribeEvents,
        { ...noBackoff, params: async () => ({ cursor }) },
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
      const gen = xrpcSubscribe(server.origin, subscribeEvents, {
        // @ts-expect-error invalid type
        params: { cursor: 'nope' },
      })
      await expect(gen.next()).rejects.toThrow()
      expect(server.requests).toHaveLength(0)
    })

    it('requires the options argument when params are required', () => {
      // @ts-expect-error missing required "topic" param
      xrpcSubscribe('https://example.com', subscribeTopic)
      xrpcSubscribe('https://example.com', subscribeTopic, {
        params: { topic: 'x' },
      })
      xrpcSubscribe('https://example.com', subscribeTopic, {
        params: () => ({ topic: 'x' }),
      })
    })
  })

  describe('service url', () => {
    it.each([['ws:'], ['http:']])(
      'connects over ws:// for a %s service',
      async (protocol) => {
        await using server = await startServer(({ ws }) => {
          ws.close(CloseCode.Normal)
        })
        const url = new URL(server.origin)
        url.protocol = protocol
        // The path of the service is replaced, like for XRPC requests
        url.pathname = '/some/prefix'
        await drain(xrpcSubscribe(url, subscribeEvents, noBackoff))
        expect(server.requests.map((r) => r.url)).toEqual([
          '/xrpc/com.example.subscribeEvents',
        ])
      },
    )

    it('rejects a non-http(s), non-ws(s) service', async () => {
      const gen = xrpcSubscribe('ftp://example.com', subscribeEvents)
      await expect(gen.next()).rejects.toThrow(TypeError)
    })

    it('fails, without retrying, when the agent cannot open WebSockets', async () => {
      await using server = await startServer(() => {})
      // A custom fetch is used as is, and the global fetch() refuses upgrades.
      const agent = buildAgent({
        service: server.origin,
        fetch: globalThis.fetch,
      })
      await expect(
        drain(xrpcSubscribe(agent, subscribeEvents, noBackoff)),
      ).rejects.toThrow(TypeError)
      expect(server.requests).toHaveLength(0)
    })
  })

  describe('agent', () => {
    it('connects through the fetchHandler of the agent, every time', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) ws.terminate()
        else ws.close(CloseCode.Normal)
      })
      const fetch = createWebSocketFetch()
      const fetchHandler = vi.fn<FetchHandler>((path, init) =>
        fetch(new URL(path, server.origin), init),
      )

      await drain(
        xrpcSubscribe({ fetchHandler }, subscribeEvents, {
          ...noBackoff,
          params: { cursor: 1 },
        }),
      )

      expect(fetchHandler).toHaveBeenCalledTimes(2)
      const [path, init] = fetchHandler.mock.calls[0]
      expect(path).toBe('/xrpc/com.example.subscribeEvents?cursor=1')
      expect(init.method).toBe('GET')
      expect(new Headers(init.headers).get('upgrade')).toBe('websocket')
    })

    it('lets the agent authenticate the handshake, and retry it', async () => {
      await using server = await startServer(
        ({ ws }) => ws.send(eventFrame(1), () => ws.close(CloseCode.Normal)),
        { authorize: (req) => req.headers.authorization === 'Bearer fresh' },
      )
      // A session-like agent: refreshes its token on a 401, and retries.
      const fetch = createWebSocketFetch()
      const tokens: string[] = []
      let token = 'stale'
      const fetchHandler: FetchHandler = async (path, init) => {
        const headers = new Headers(init.headers)
        const send = () => {
          tokens.push(token)
          headers.set('authorization', `Bearer ${token}`)
          return fetch(new URL(path, server.origin), { ...init, headers })
        }
        const response = await send()
        if (response.status !== 401) return response
        await response.body?.cancel()
        token = 'fresh'
        return send()
      }
      const onReconnect = vi.fn()

      const messages = await drain(
        xrpcSubscribe({ fetchHandler }, subscribeEvents, {
          ...noBackoff,
          onReconnect,
        }),
      )

      expect(messages).toHaveLength(1)
      expect(tokens).toEqual(['stale', 'fresh'])
      expect(onReconnect).not.toHaveBeenCalled()
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
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          onError,
        }),
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

    it('reconnects after a transient error frame', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) ws.send(errorFrame('InternalServerError'))
        else ws.send(eventFrame(1), () => ws.close(CloseCode.Normal))
      })
      const onReconnect = vi.fn()
      const messages = await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          onReconnect,
        }),
      )
      expect(messages).toHaveLength(1)
      expect(onReconnect).toHaveBeenCalledExactlyOnceWith(
        expect.any(XrpcSubscriptionServerError),
        { attempt: 0 },
      )
    })

    it('lets shouldReconnect retry a declared error', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) ws.send(errorFrame('FutureCursor'))
        else ws.close(CloseCode.Normal)
      })
      await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          shouldReconnect: (error) =>
            error instanceof XrpcSubscriptionServerError &&
            error.error === 'FutureCursor',
        }),
      )
      expect(server.requests).toHaveLength(2)
    })
  })

  describe('invalid messages', () => {
    it.each([
      ['undecodable CBOR', Buffer.from([0xff, 0x00])],
      ['a missing body', encode({ op: 1 })],
      ['an extra item', Buffer.concat([eventFrame(1), encode(1)])],
      ['a non-object header', frame('op', {})],
      ['a typed non-object body', frame({ op: 1, t: '#event' }, 'body')],
      ['an invalid error body', frame({ op: -1 }, { message: 'no code' })],
    ])('drops the connection on %s', async (_, data) => {
      await using server = await startServer(({ ws }) => ws.send(data))
      await expect(
        drain(xrpcSubscribe(server.origin, subscribeEvents, noBackoff)),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionInvalidMessageError)
        expect(err).not.toBeInstanceOf(XrpcSubscriptionValidationError)
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
        drain(xrpcSubscribe(server.origin, subscribeEvents, noBackoff)),
      ).rejects.toSatisfy((err) => {
        assert(err instanceof XrpcSubscriptionValidationError)
        expect(err.value).toEqual({
          $type: 'com.example.subscribeEvents#event',
          seq: 'one',
          text: 'x',
        })
        expect(err.shouldRetry()).toBe(false)
        return true
      })
    })

    it('skips invalid messages when onInvalidMessage returns', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 1, t: '#event' }, { seq: 'one', text: 'x' }))
        ws.send(eventFrame(2), () => ws.close(CloseCode.Normal))
      })
      const onInvalidMessage = vi.fn()
      const messages = await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          onInvalidMessage,
        }),
      )
      expect(messages).toHaveLength(1)
      expect(onInvalidMessage).toHaveBeenCalledExactlyOnceWith(
        expect.any(XrpcSubscriptionValidationError),
      )
    })

    it('passes errors thrown by onInvalidMessage through to the policy and iterator', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 1, t: '#event' }, { seq: 'one', text: 'x' }))
      })
      const custom = new Error('custom')
      const shouldReconnect = vi.fn(() => false)
      await expect(
        drain(
          xrpcSubscribe(server.origin, subscribeEvents, {
            ...noBackoff,
            shouldReconnect,
            onInvalidMessage: () => {
              throw custom
            },
          }),
        ),
      ).rejects.toBe(custom)
      expect(shouldReconnect).toHaveBeenCalledWith(custom, 0)
    })

    it('yields messages as-is when validation is disabled', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(frame({ op: 1, t: '#event' }, { seq: 'one', text: 'x' }))
        ws.close(CloseCode.Normal)
      })
      const messages = await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          validateResponse: false,
        }),
      )
      expect(messages).toEqual([
        { $type: 'com.example.subscribeEvents#event', seq: 'one', text: 'x' },
      ])
    })
  })

  describe('connection errors', () => {
    it('wraps a rejected upgrade, without retrying a 404', async () => {
      await using server = await startServer(() => {}, { status: 404 })
      const onError = vi.fn()
      const error = await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          onError,
        }),
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
      // The same instance everywhere it surfaces
      expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    })

    it('hands wrapped errors to the reconnect policy and hooks', async () => {
      await using server = await startServer(({ ws, index }) => {
        if (index === 0) ws.terminate()
        else ws.close(CloseCode.Normal)
      })
      // A server's 1000 close goes to the policy too, so this mirrors the
      // default classification rather than retrying every connection error.
      const shouldReconnect = vi.fn(
        (error: unknown) =>
          error instanceof XrpcSubscriptionConnectionError &&
          error.shouldRetry(),
      )
      const onReconnect = vi.fn()
      await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          shouldReconnect,
          onReconnect,
        }),
      )
      expect(onReconnect).toHaveBeenCalledOnce()
      const [error] = onReconnect.mock.calls[0]
      assert(error instanceof XrpcSubscriptionConnectionError)
      expect(shouldReconnect).toHaveBeenCalledWith(error, 0)
    })

    it('never reconnects when shouldReconnect is false', async () => {
      await using server = await startServer(({ ws }) => ws.terminate())
      await expect(
        drain(
          xrpcSubscribe(server.origin, subscribeEvents, {
            shouldReconnect: false,
          }),
        ),
      ).rejects.toBeInstanceOf(XrpcSubscriptionConnectionError)
      expect(server.requests).toHaveLength(1)
    })
  })

  describe('lifecycle', () => {
    it('closes the connection when the consumer breaks out', async () => {
      await using server = await startServer(({ ws }) => {
        ws.send(eventFrame(1))
      })
      for await (const _ of xrpcSubscribe(server.origin, subscribeEvents)) {
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
      const gen = xrpcSubscribe(server.origin, subscribeEvents, {
        signal: controller.signal,
        onError,
      })
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
      const gen = xrpcSubscribe(server.origin, subscribeEvents, {
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
      const gen = xrpcSubscribe(server.origin, subscribeEvents, {
        signal: AbortSignal.abort(reason),
      })
      await expect(gen.next()).rejects.toBe(reason)
      expect(server.requests).toHaveLength(0)
    })

    it('does not connect until the first pull', async () => {
      await using server = await startServer(() => {})
      const gen = xrpcSubscribe(server.origin, subscribeEvents)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(server.requests).toHaveLength(0)
      await gen.return()
    })

    it('fires onConnect without exposing a sender', async () => {
      await using server = await startServer(({ ws }) => {
        ws.close(CloseCode.Normal)
      })
      const onConnect = vi.fn()
      await drain(
        xrpcSubscribe(server.origin, subscribeEvents, {
          ...noBackoff,
          onConnect,
        }),
      )
      expect(onConnect).toHaveBeenCalledExactlyOnceWith()
    })
  })
})
