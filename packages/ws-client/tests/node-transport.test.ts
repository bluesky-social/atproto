import { assert, describe, expect, it, vi } from 'vitest'
import { CloseCode } from '../src/lib/close-codes.ts'
import { NodeTransport } from '../src/transport/node-transport.ts'
import type { TransportHandlers } from '../src/transport/transport.ts'
import { startServer } from './_util/server.ts'

function collectHandlers(): TransportHandlers & {
  opened: Promise<void>
  closed: Promise<{ code: number; reason: string; wasClean: boolean }>
  messages: (string | Uint8Array)[]
  pongs: number
  errors: Error[]
} {
  const messages: (string | Uint8Array)[] = []
  const errors: Error[] = []
  let pongs = 0
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
    get pongs() {
      return pongs
    },
    errors,
    onOpen: () => resolveOpened(),
    onMessage: (data) => messages.push(data),
    onPong: () => pongs++,
    onClose: (code, reason, wasClean) =>
      resolveClosed({ code, reason, wasClean }),
    onError: (err) => errors.push(err),
  }
}

describe(NodeTransport, () => {
  it('reports heartbeat + pauseResume capabilities', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    expect(transport.capabilities).toEqual({
      heartbeat: true,
      pauseResume: true,
    })
    transport.open()
    await handlers.closed
  })

  it('does not connect until open() is called', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    // No connection attempt yet, so onOpen cannot have fired.
    await new Promise((resolve) => setTimeout(resolve, 20))
    let opened = false
    handlers.opened.then(() => (opened = true))
    expect(opened).toBe(false)
    transport.open()
    await handlers.opened
  })

  it('reports null protocol until open, then the negotiated value', async () => {
    await using server = await startServer((ws) => ws.close(1000), {
      handleProtocols: (protocols: Set<string>) =>
        protocols.has('chat.v1') ? 'chat.v1' : false,
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers, {
      protocols: ['chat.v1'],
    })
    expect(transport.protocol).toBeNull()
    transport.open()
    await handlers.opened
    expect(transport.protocol).toBe('chat.v1')
    await handlers.closed
  })

  it('reports null protocol when none is negotiated', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    await handlers.opened
    expect(transport.protocol).toBeNull()
    await handlers.closed
  })

  it('delivers text frames as strings', async () => {
    await using server = await startServer((ws) => {
      ws.send('hello')
      ws.send('world')
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    await handlers.closed
    expect(handlers.messages).toEqual(['hello', 'world'])
  })

  it('delivers binary frames as Uint8Array without copying beyond a view', async () => {
    await using server = await startServer((ws) => {
      ws.send(Buffer.from([1, 2, 3]))
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    await handlers.closed
    expect(handlers.messages).toHaveLength(1)
    const [msg] = handlers.messages
    assert(msg instanceof Uint8Array)
    expect(Array.from(msg)).toEqual([1, 2, 3])
  })

  it('delivers pongs in response to ping()', async () => {
    // `ws` answers protocol pings automatically; keep the socket open until
    // the client closes it below.
    await using server = await startServer(() => {})
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    await handlers.opened
    transport.ping()
    await vi.waitFor(() => expect(handlers.pongs).toBe(1))
    transport.close(1000)
    await handlers.closed
  })

  it('reports close code, reason, and wasClean on a normal close', async () => {
    await using server = await startServer((ws) => {
      ws.close(1000, 'bye')
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    const detail = await handlers.closed
    expect(detail).toEqual({ code: 1000, reason: 'bye', wasClean: true })
  })

  it('reports wasClean:false for a non-normal close code', async () => {
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Policy, 'nope')
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    const detail = await handlers.closed
    expect(detail).toEqual({
      code: CloseCode.Policy,
      reason: 'nope',
      wasClean: false,
    })
  })

  it('reports errors through onError', async () => {
    const handlers = collectHandlers()
    // Nothing is listening on this port, so the connection attempt errors.
    const transport = new NodeTransport('ws://localhost:1', handlers)
    transport.open()
    await vi.waitFor(() => expect(handlers.errors).toHaveLength(1))
    assert(handlers.errors[0] instanceof Error)
  })

  it('send() resolves after the data is flushed to the server', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        seen.push(data.toString())
        ws.close(1000)
      })
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    await handlers.opened
    // The server only closes after it has processed the message, so waiting
    // for close (not just send()'s flush) is what guarantees `seen` is set.
    await transport.send('ping')
    await handlers.closed
    expect(seen).toEqual(['ping'])
  })

  it('sends custom headers on the upgrade request (record form)', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers, {
      headers: { Authorization: 'Bearer t0ken' },
    })
    transport.open()
    await handlers.closed
    expect(seenAuth).toBe('Bearer t0ken')
  })

  it('sends custom headers from a WHATWG Headers instance', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(1000)
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers, {
      headers: new Headers({ Authorization: 'Bearer hdr' }),
    })
    transport.open()
    await handlers.closed
    expect(seenAuth).toBe('Bearer hdr')
  })

  it('pause() stops delivery and resume() resumes it', async () => {
    // The server only sends 'one'/'two' once the client says it's ready, so
    // the client can pause *before* any data is in flight — otherwise the
    // frames could already be parsed by the time pause() runs.
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        if (data.toString() === 'ready') {
          ws.send('one')
          ws.send('two')
          setTimeout(() => ws.close(1000), 50)
        }
      })
    })
    const handlers = collectHandlers()
    const transport = new NodeTransport(server.url, handlers)
    transport.open()
    await handlers.opened
    transport.pause()
    await transport.send('ready')
    // Give the (unread, paused) frames a chance to arrive on the wire.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handlers.messages).toEqual([])
    transport.resume()
    await handlers.closed
    expect(handlers.messages).toEqual(['one', 'two'])
  })
})
