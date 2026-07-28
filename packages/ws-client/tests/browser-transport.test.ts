import { assert, describe, expect, it, vi } from 'vitest'
import { BrowserTransport } from '../src/transport/browser-transport.ts'
import type { TransportHandlers } from '../src/transport/transport.ts'
import { startServer } from './_util/server.ts'

// Node 24+ has a global WHATWG WebSocket; bind it explicitly so these tests
// don't depend on ambient global state. Under this package's test tsconfig
// (Node types + DOM lib together), the ambient `WebSocket` resolves to
// @types/node's undici-based declaration, which is structurally close to but
// not identical to the DOM-lib WebSocket that BrowserTransport's internal
// WHATWGWebSocket type is written against — hence the cast.
const WebSocketImpl: ConstructorParameters<typeof BrowserTransport>[3] =
  globalThis.WebSocket as never

function collectHandlers(): TransportHandlers & {
  opened: Promise<void>
  closed: Promise<{ code: number; reason: string; wasClean: boolean }>
  messages: (string | Uint8Array)[]
  errors: Error[]
} {
  const messages: (string | Uint8Array)[] = []
  const errors: Error[] = []
  let resolveOpened!: () => void
  let resolveClosed!: (v: {
    code: number
    reason: string
    wasClean: boolean
  }) => void
  const opened = new Promise<void>((resolve) => (resolveOpened = resolve))
  const closed = new Promise<{
    code: number
    reason: string
    wasClean: boolean
  }>((resolve) => (resolveClosed = resolve))
  return {
    opened,
    closed,
    messages,
    errors,
    onOpen: () => resolveOpened(),
    onMessage: (data) => messages.push(data),
    onPong: () => {
      throw new Error('onPong should never be called in the browser')
    },
    onClose: (code, reason, wasClean) =>
      resolveClosed({ code, reason, wasClean }),
    onError: (err) => errors.push(err),
  }
}

const noopHandlers: TransportHandlers = {
  onOpen() {},
  onMessage() {},
  onPong() {},
  onClose() {},
  onError() {},
}

describe(BrowserTransport, () => {
  it('reports heartbeat:false, pauseResume:false', () => {
    const transport = new BrowserTransport(
      'ws://x',
      noopHandlers,
      undefined,
      WebSocketImpl,
    )
    expect(transport.capabilities).toEqual({
      heartbeat: false,
      pauseResume: false,
    })
  })

  it('does not connect until open() is called', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    let opened = false
    handlers.opened.then(() => (opened = true))
    expect(opened).toBe(false)
    transport.open()
    await handlers.opened
  })

  it('reports null protocol when none is negotiated', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    expect(transport.protocol).toBeNull()
    transport.open()
    await handlers.opened
    expect(transport.protocol).toBeNull()
    await handlers.closed
  })

  it('reports the negotiated subprotocol', async () => {
    await using server = await startServer((ws) => ws.close(1000), {
      handleProtocols: (protocols: Set<string>) =>
        protocols.has('chat.v1') ? 'chat.v1' : false,
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      { protocols: ['chat.v1'] },
      WebSocketImpl,
    )
    transport.open()
    await handlers.opened
    expect(transport.protocol).toBe('chat.v1')
    await handlers.closed
  })

  it('delivers text frames as strings', async () => {
    await using server = await startServer((ws) => {
      ws.send('hi')
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    await handlers.closed
    expect(handlers.messages).toEqual(['hi'])
  })

  it('delivers binary frames as Uint8Array', async () => {
    await using server = await startServer((ws) => {
      ws.send(Buffer.from([9, 8, 7]))
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    await handlers.closed
    expect(handlers.messages).toHaveLength(1)
    const [msg] = handlers.messages
    assert(msg instanceof Uint8Array)
    expect(Array.from(msg)).toEqual([9, 8, 7])
  })

  it('reports close code, reason, and wasClean', async () => {
    await using server = await startServer((ws) => {
      ws.close(1000, 'bye')
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    const detail = await handlers.closed
    expect(detail).toEqual({ code: 1000, reason: 'bye', wasClean: true })
  })

  it('send() resolves once the data is handed off', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        seen.push(data.toString())
        ws.close(1000)
      })
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    await handlers.opened
    // The server only closes after it has processed the message, so waiting
    // for close (not just send() hand-off) is what guarantees `seen` is set.
    await transport.send('yo')
    await handlers.closed
    expect(seen).toEqual(['yo'])
  })

  it('ping() is an inert no-op (no heartbeat capability)', async () => {
    await using server = await startServer((ws) => {
      ws.on('ping', () => {
        throw new Error('server should never see a protocol ping')
      })
      setTimeout(() => ws.close(1000), 20)
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    await handlers.opened
    expect(() => transport.ping()).not.toThrow()
    await handlers.closed
  })

  it('pause() and resume() are inert no-ops (no backpressure capability)', async () => {
    await using server = await startServer((ws) => {
      ws.send('one')
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    expect(() => transport.pause()).not.toThrow()
    expect(() => transport.resume()).not.toThrow()
    await handlers.closed
    // Messages still arrive: pause() never actually gated delivery.
    expect(handlers.messages).toEqual(['one'])
  })

  it('terminate() maps to a polite close', async () => {
    await using server = await startServer(() => {
      /* server just accepts the connection */
    })
    const handlers = collectHandlers()
    const transport = new BrowserTransport(
      server.url,
      handlers,
      undefined,
      WebSocketImpl,
    )
    transport.open()
    await handlers.opened
    transport.terminate()
    const detail = await handlers.closed
    expect(detail.wasClean).toBe(true)
  })

  it('throws a TypeError on construction when headers are provided (record form)', () => {
    expect(
      () =>
        new BrowserTransport(
          'ws://x',
          noopHandlers,
          { headers: { Authorization: 'Bearer t0ken' } },
          WebSocketImpl,
        ),
    ).toThrow(TypeError)
  })

  it('throws a TypeError on construction when headers are provided (Headers form)', () => {
    expect(
      () =>
        new BrowserTransport(
          'ws://x',
          noopHandlers,
          { headers: new Headers({ Authorization: 'Bearer t0ken' }) },
          WebSocketImpl,
        ),
    ).toThrow(TypeError)
  })

  it('does not throw for absent or empty headers', () => {
    expect(
      () =>
        new BrowserTransport('ws://x', noopHandlers, undefined, WebSocketImpl),
    ).not.toThrow()
    expect(
      () =>
        new BrowserTransport(
          'ws://x',
          noopHandlers,
          { headers: {} },
          WebSocketImpl,
        ),
    ).not.toThrow()
    expect(
      () =>
        new BrowserTransport(
          'ws://x',
          noopHandlers,
          { headers: new Headers() },
          WebSocketImpl,
        ),
    ).not.toThrow()
  })

  it('throws a TypeError when no WebSocket implementation is available', () => {
    // Explicitly passing `undefined` for the constructor parameter falls
    // through to its default (`globalThis.WebSocket`), same as omitting it —
    // so to exercise the "genuinely absent" path, stub the global away too.
    vi.stubGlobal('WebSocket', undefined)
    try {
      expect(
        () =>
          new BrowserTransport('ws://x', noopHandlers, undefined, undefined),
      ).toThrow(TypeError)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
