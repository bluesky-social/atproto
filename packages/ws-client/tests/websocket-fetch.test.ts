import { assert, describe, expect, it, vi } from 'vitest'
import {
  type WebSocketHandshakeInit,
  createWebSocketFetch,
  isWebSocketHandshake,
  websocket,
} from '../src/index.js'
import { SocketError, UnexpectedResponseError } from '../src/lib/errors.js'
import {
  type HandshakeWebSocketCtor,
  createTransport as createBrowserTransport,
  openWebSocket as openBrowserWebSocket,
} from '../src/transport/browser-transport.js'
import { openWebSocket } from '../src/transport/node-transport.js'
import { WebSocketResponse, takeWebSocket } from '../src/websocket-response.js'
import { startServer } from './_util/server.js'
import { transportOptionDefaults } from './_util/transport-options.js'

const HANDSHAKE = { connection: 'Upgrade', upgrade: 'websocket' }

// maxReconnectSeconds: 0 caps the backoff at 0ms, so reconnects don't wait.
const noBackoff = { maxReconnectSeconds: 0 }

async function drain<T>(gen: AsyncGenerator<T, void, unknown>): Promise<T[]> {
  const out: T[] = []
  for await (const m of gen) out.push(m)
  return out
}

// Headers computed as they are iterated (like a fresh proof would be),
// counting how many times that happens.
function countingHeaders(name: string) {
  const counter = { reads: 0 }
  const headers = {
    *[Symbol.iterator]() {
      counter.reads++
      yield [name, String(counter.reads)]
    },
  } as unknown as HeadersInit
  return { headers, counter }
}

// The http(s) URL a handshake request is made to, as a fetch caller would.
const httpUrl = (wsUrl: string, path = '/') =>
  new URL(path, wsUrl.replace(/^ws/, 'http'))

describe(isWebSocketHandshake, () => {
  it('detects a GET with an Upgrade: websocket header', () => {
    expect(isWebSocketHandshake('https://x', { headers: HANDSHAKE })).toBe(true)
    expect(
      isWebSocketHandshake(new Request('https://x', { headers: HANDSHAKE })),
    ).toBe(true)
    expect(isWebSocketHandshake('https://x')).toBe(false)
    expect(
      isWebSocketHandshake('https://x', { method: 'POST', headers: HANDSHAKE }),
    ).toBe(false)
  })
})

describe(createWebSocketFetch, () => {
  it('passes every other request to the wrapped fetch', async () => {
    const response = new Response('ok')
    const fetch = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => response,
    )
    const body = new ReadableStream()

    const result = await createWebSocketFetch(fetch)('https://x/y', {
      method: 'POST',
      body,
      headers: { 'x-test': '1' },
    })

    expect(result).toBe(response)
    expect(fetch).toHaveBeenCalledOnce()
    const [input, init] = fetch.mock.calls[0]
    expect(input).toBe('https://x/y')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(body)
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      'x-test': '1',
    })
  })

  it('reads the headers once, and forwards what it read', async () => {
    const { headers, counter } = countingHeaders('x-read')
    const fetch = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        new Response(new Headers(init?.headers).get('x-read')),
    )

    const response = await createWebSocketFetch(fetch)('https://x/y', {
      headers,
    })

    expect(await response.text()).toBe('1')
    expect(counter.reads).toBe(1)
  })

  it('reads the headers of a handshake once, and sends what it read', async () => {
    const seen = vi.fn()
    await using server = await startServer((ws, req) => {
      seen(req.headers['x-read'])
      ws.close()
    })
    // A handshake told apart from headers that are computed as they are read
    const counter = { reads: 0 }
    const handshakeHeaders = {
      *[Symbol.iterator]() {
        counter.reads++
        yield* Object.entries(HANDSHAKE)
        yield ['x-read', String(counter.reads)]
      },
    } as unknown as HeadersInit
    const controller = new AbortController()

    const response = await createWebSocketFetch()(httpUrl(server.url), {
      headers: handshakeHeaders,
      signal: controller.signal,
    })

    expect(response.status).toBe(101)
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith('1'))
    expect(counter.reads).toBe(1)
    controller.abort()
  })

  it('opens the connection, sending the request headers', async () => {
    const seen = vi.fn()
    await using server = await startServer((ws, req) => {
      seen(req.url, req.headers.authorization, ws.protocol)
      ws.close()
    })
    server.wss.on('headers', (headers) => headers.push('X-Handshake: yes'))

    const controller = new AbortController()
    const response = await createWebSocketFetch()(
      httpUrl(server.url, '/xrpc/x?a=1'),
      {
        signal: controller.signal,
        headers: {
          ...HANDSHAKE,
          authorization: 'Bearer token',
          'sec-websocket-protocol': 'v1, v2',
        },
      },
    )

    assert(response instanceof WebSocketResponse)
    expect(response.status).toBe(101)
    expect(response.statusText).toBe('Switching Protocols')
    expect(response.ok).toBe(false)
    expect(response.body).toBeNull()
    expect(response.headers.get('x-handshake')).toBe('yes')
    await vi.waitFor(() =>
      expect(seen).toHaveBeenCalledWith('/xrpc/x?a=1', 'Bearer token', 'v1'),
    )
    // Taken over at most once
    expect(takeWebSocket(response)).toBeDefined()
    expect(takeWebSocket(response)).toBeUndefined()
    controller.abort()
  })

  it('accepts a Request, as fetch wrappers pass along', async () => {
    await using server = await startServer((ws) => ws.close())
    const request = new Request(httpUrl(server.url), { headers: HANDSHAKE })
    const response = await createWebSocketFetch()(request)
    expect(response.status).toBe(101)
  })

  it('resolves with the response of a refused upgrade', async () => {
    await using server = await startServer(() => {}, {
      verifyClient: (_info, callback) =>
        callback(false, 401, 'Unauthorized', {
          'WWW-Authenticate': 'Bearer error="invalid_token"',
        }),
    })

    const response = await createWebSocketFetch()(httpUrl(server.url), {
      headers: HANDSHAKE,
    })

    expect(response).not.toBeInstanceOf(WebSocketResponse)
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer error="invalid_token"',
    )
    expect(await response.text()).toBe('Unauthorized')
  })

  it('rejects with a SocketError when no response was received', async () => {
    await expect(
      createWebSocketFetch()('http://localhost:1/', { headers: HANDSHAKE }),
    ).rejects.toBeInstanceOf(SocketError)
  })

  it('rejects with the reason of an abort', async () => {
    await using server = await startServer(() => {})
    const reason = new Error('stop')
    await expect(
      createWebSocketFetch()(httpUrl(server.url), {
        headers: HANDSHAKE,
        signal: AbortSignal.abort(reason),
      }),
    ).rejects.toBe(reason)
  })

  it('closes a connection nobody took over once its owner aborts', async () => {
    const closed = vi.fn()
    await using server = await startServer((ws) => ws.on('close', closed))
    const controller = new AbortController()
    await openWebSocket(httpUrl(server.url), {
      headers: HANDSHAKE,
      signal: controller.signal,
    })
    controller.abort()
    await vi.waitFor(() => expect(closed).toHaveBeenCalled())
  })
})

describe('websocket() through a handshake function', () => {
  it('takes the connection over without losing early messages', async () => {
    await using server = await startServer((ws) => {
      // Sent as soon as the server accepts, before the client took it over.
      for (let i = 0; i < 5; i++) ws.send(`m${i}`)
      ws.close(1000)
    })
    const fetch = createWebSocketFetch()

    const messages = await drain(
      websocket(async (init) => {
        const response = await fetch(httpUrl(server.url), init)
        // Give the server's frames time to arrive before the takeover.
        await new Promise((resolve) => setTimeout(resolve, 20))
        return response
      }, noBackoff),
    )

    expect(messages).toEqual(['m0', 'm1', 'm2', 'm3', 'm4'])
  })

  it('hands the function the handshake request, with the caller headers', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const fetch = createWebSocketFetch()
    const inits: WebSocketHandshakeInit[] = []

    await drain(
      websocket(
        (init) => {
          inits.push(init)
          return fetch(httpUrl(server.url), init)
        },
        { ...noBackoff, headers: { 'x-caller': '1' }, protocols: ['v1'] },
      ),
    )

    expect(inits).toHaveLength(1)
    expect(inits[0].method).toBe('GET')
    expect(Object.fromEntries(inits[0].headers)).toEqual({
      connection: 'Upgrade',
      upgrade: 'websocket',
      'sec-websocket-protocol': 'v1',
      'x-caller': '1',
    })
    expect(inits[0].signal.aborted).toBe(true) // torn down at the end
  })

  it('lets a fetch wrapper retry a refused handshake', async () => {
    // The DPoP nonce dance, in short: the first attempt is refused with a
    // challenge, which the wrapper answers by retrying.
    await using server = await startServer((ws) => ws.close(1000), {
      verifyClient: ({ req }, callback) => {
        if (req.headers['x-nonce'] === 'n1') callback(true)
        else callback(false, 401, 'Unauthorized', { 'X-Nonce': 'n1' })
      },
    })
    const base = createWebSocketFetch()
    const attempts: (string | null)[] = []
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const headers = new Headers(init?.headers)
      attempts.push(headers.get('x-nonce'))
      const response = await base(input, { ...init, headers })
      const nonce = response.headers.get('x-nonce')
      if (response.status !== 401 || !nonce) return response
      await response.body?.cancel()
      headers.set('x-nonce', nonce)
      attempts.push(nonce)
      return base(input, { ...init, headers })
    }

    const onReconnect = vi.fn()
    await drain(
      websocket((init) => fetch(httpUrl(server.url), init), {
        ...noBackoff,
        onReconnect,
      }),
    )

    expect(attempts).toEqual([null, 'n1'])
    expect(onReconnect).not.toHaveBeenCalled()
  })

  it('reads the headers option once per connection attempt', async () => {
    const seen: unknown[] = []
    let connections = 0
    await using server = await startServer((ws, req) => {
      seen.push(req.headers['x-attempt'])
      if (connections++ === 0) ws.terminate()
      else ws.close(1000)
    })
    const fetch = createWebSocketFetch()

    for (const target of [
      server.url,
      (init: WebSocketHandshakeInit) => fetch(httpUrl(server.url), init),
    ]) {
      seen.length = 0
      connections = 0
      const { headers, counter } = countingHeaders('x-attempt')
      await drain(websocket(target, { ...noBackoff, headers }))
      expect(counter.reads).toBe(2)
      expect(seen).toEqual(['1', '2'])
    }
  })

  it('invokes the function again on reconnect', async () => {
    let connections = 0
    await using server = await startServer((ws) => {
      if (connections++ === 0) ws.terminate()
      else ws.close(1000)
    })
    const fetch = createWebSocketFetch()
    const handshake = vi.fn((init: WebSocketHandshakeInit) =>
      fetch(httpUrl(server.url), init),
    )

    await drain(websocket(handshake, noBackoff))

    expect(handshake).toHaveBeenCalledTimes(2)
  })

  it.each([
    [404, false],
    [503, true],
  ])('classifies a refused upgrade (%i) by status', async (status, retried) => {
    let dials = 0
    await using server = await startServer((ws) => ws.close(1000), {
      verifyClient: (_info, callback) => {
        if (dials++ === 0) callback(false, status)
        else callback(true)
      },
    })
    const fetch = createWebSocketFetch()
    const gen = websocket((init) => fetch(httpUrl(server.url), init), noBackoff)

    if (retried) {
      await drain(gen)
      expect(dials).toBe(2)
    } else {
      await expect(drain(gen)).rejects.toSatisfy((err) => {
        assert(err instanceof UnexpectedResponseError)
        expect(err.status).toBe(status)
        return true
      })
      expect(dials).toBe(1)
    }
  })

  it('fails, without retrying, on a response that was not upgraded', async () => {
    const handshake = vi.fn(
      async () => new Response('Upgrade required', { status: 426 }),
    )
    await expect(drain(websocket(handshake, noBackoff))).rejects.toSatisfy(
      (err) => err instanceof UnexpectedResponseError && err.status === 426,
    )
    expect(handshake).toHaveBeenCalledOnce()
  })

  it('closes a connection the function failed to return', async () => {
    const closed = vi.fn()
    await using server = await startServer((ws) => ws.on('close', closed))
    const fetch = createWebSocketFetch()
    const error = new Error('dropped')

    await expect(
      drain(
        websocket(
          async (init) => {
            await fetch(httpUrl(server.url), init)
            throw error
          },
          { shouldReconnect: false },
        ),
      ),
    ).rejects.toBe(error)
    await vi.waitFor(() => expect(closed).toHaveBeenCalled())
  })
})

describe('browser handshake', () => {
  const globalWebSocket =
    globalThis.WebSocket as unknown as HandshakeWebSocketCtor

  it('replays what the socket received before it was taken over', async () => {
    await using server = await startServer((ws) => {
      ws.send('early')
      ws.close(1000, 'bye')
    })
    const controller = new AbortController()
    const response = await openBrowserWebSocket(
      httpUrl(server.url),
      { headers: HANDSHAKE, signal: controller.signal },
      globalWebSocket,
    )
    // Both the message and the close are dispatched before the takeover.
    await new Promise((resolve) => setTimeout(resolve, 50))

    const socket = takeWebSocket(response)
    assert(socket)
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const transport = createBrowserTransport({
      ...transportOptionDefaults,
      url: undefined,
      socket,
      dataMode: 'text',
      signal: controller.signal,
      onOpen,
      onClose,
    })
    const messages: string[] = []
    for await (const message of transport) messages.push(message)

    expect(messages).toEqual(['early'])
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledWith({
      code: 1000,
      reason: 'bye',
      wasClean: true,
    })
  })

  it('refuses a handshake carrying headers', async () => {
    await expect(
      openBrowserWebSocket(
        'https://example.com',
        { headers: { ...HANDSHAKE, authorization: 'Bearer token' } },
        globalWebSocket,
      ),
    ).rejects.toThrow(TypeError)
  })
})
