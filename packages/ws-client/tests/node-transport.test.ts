import { type LookupOptions, lookup } from 'node:dns'
import { once } from 'node:events'
import { type AddressInfo, type Socket, createServer } from 'node:net'
import { assert, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { WebSocket as WsSocket } from 'ws'
import { CloseCode, isReconnectableClose } from '../src/lib/close-codes.js'
import {
  CloseError,
  HandshakeRejectedError,
  HandshakeTimeoutError,
  HeartbeatTimeoutError,
  MessageTooBigError,
  WebSocketClientError,
} from '../src/lib/errors.js'
import type { CloseEventDetail, MessageOf } from '../src/message-channel.js'
import { createTransport } from '../src/transport/node-transport.js'
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  type LookupFunction,
  type Sender,
  type Transport,
} from '../src/transport/transport.js'
import { startServer } from './_util/server.js'
import { transportOptionDefaults } from './_util/transport-options.js'

// Drains a transport's iteration into an array, returning rather than throwing
// whatever terminal error it surfaces.
async function drain<M extends 'auto' | 'text' | 'binary'>(
  transport: Transport<M>,
): Promise<{ messages: MessageOf<M>[]; error: unknown }> {
  const messages: MessageOf<M>[] = []
  try {
    for await (const message of transport) {
      messages.push(message)
    }
    return { messages, error: undefined }
  } catch (error) {
    return { messages, error }
  }
}

describe(createTransport, () => {
  it('round-trips text and binary frames through iteration', async () => {
    await using server = await startServer((ws) => {
      ws.send('hello')
      ws.send(Buffer.from([1, 2, 3]))
      ws.close(CloseCode.Normal)
    })
    const controller = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const { messages, error } = await drain(transport)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toBe('hello')
    assert(messages[1] instanceof Uint8Array)
    expect(Array.from(messages[1])).toEqual([1, 2, 3])
    // A clean close completes the iteration; the code is reported via onClose.
    expect(error).toBeUndefined()
  })

  it('honors dataMode typing by failing on a mismatched frame', async () => {
    await using server = await startServer((ws) => {
      ws.send(Buffer.from([9, 9, 9]))
    })
    const controller = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    await expect(iterator.next()).rejects.toSatisfy((err: unknown) => {
      // DataModeError, surfaced from the channel.
      expect((err as Error).name).toBe('DataModeError')
      return true
    })
    controller.abort()
  })

  it('delivers headers from a plain record to the server upgrade request', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(CloseCode.Normal)
    })
    const controller = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      headers: { Authorization: 'Bearer t0ken' },
      onOpen: () => {},
      onClose: () => {},
    })
    await drain(transport)
    expect(seenAuth).toBe('Bearer t0ken')
  })

  it('delivers headers from a WHATWG Headers instance', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(CloseCode.Normal)
    })
    const controller = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      headers: new Headers({ Authorization: 'Bearer hdr' }),
      onOpen: () => {},
      onClose: () => {},
    })
    await drain(transport)
    expect(seenAuth).toBe('Bearer hdr')
  })

  it('completes iteration and reports the detail on a clean server close', async () => {
    // A transport signals an orderly close by completing, per the ordinary
    // iterator contract, and reports the detail through onClose. It doesn't
    // invent an error for something that isn't one; the reconnect loop builds a
    // classifiable CloseError from that detail itself.
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Normal, 'bye')
    })
    const controller = new AbortController()
    const closes: CloseEventDetail[] = []
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: (detail) => closes.push(detail),
    })
    const { error } = await drain(transport)
    expect(error).toBeUndefined()
    expect(closes).toEqual([
      { code: CloseCode.Normal, reason: 'bye', wasClean: true },
    ])
  })

  it('reports an abnormal, retryable close when the server drops abruptly', async () => {
    await using server = await startServer((ws) => {
      // @ts-expect-error accessing the underlying socket to force an abrupt drop
      ws._socket.destroy()
    })
    const controller = new AbortController()
    const closes: CloseEventDetail[] = []
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: (detail) => closes.push(detail),
    })
    const { error } = await drain(transport)
    // An abrupt drop reaches `ws` as a 1006 close event or as a socket error,
    // depending on timing, so the transport may complete or reject. What matters
    // either way is that the reported detail is abnormal: that's what the
    // reconnect loop classifies, and 1006 is retryable.
    const detail = error instanceof CloseError ? error : closes.at(-1)
    assert(detail)
    expect(detail.wasClean).toBe(false)
    expect(isReconnectableClose(detail.code)).toBe(true)
  })

  it('resolves send() once the message is flushed to the server', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        seen.push(data.toString())
        ws.close(CloseCode.Normal)
      })
    })
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: (s) => {
        sender = s
      },
      onClose: () => {},
    })
    const drained = drain(transport)
    await vi.waitFor(() => assert(sender))
    // The server only closes after processing the message, so waiting for the
    // connection to end — not just send()'s own flush — is what proves the
    // message actually reached it.
    await sender.send('ping')
    await drained
    expect(seen).toEqual(['ping'])
  })

  it('rejects send() before the connection opens', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    await expect(transport.send('too-soon')).rejects.toBeInstanceOf(
      WebSocketClientError,
    )
    controller.abort()
  })

  it('rejects send() after the connection closes', async () => {
    await using server = await startServer((ws) => ws.close(CloseCode.Normal))
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: (s) => {
        sender = s
      },
      onClose: () => {},
    })
    await drain(transport)
    await expect(sender.send('too-late')).rejects.toBeInstanceOf(
      WebSocketClientError,
    )
  })

  it('fires onOpen and onClose each exactly once with correct detail', async () => {
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Policy, 'nope')
    })
    const controller = new AbortController()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen,
      onClose,
    })
    await drain(transport)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // `wasClean` reports whether the closing handshake completed, not whether the
    // code was 1000 — so a policy close the peer announced properly is clean. The
    // reconnect loop keys its own decisions on the code, not on this flag.
    expect(onClose).toHaveBeenCalledWith({
      code: CloseCode.Policy,
      reason: 'nope',
      wasClean: true,
    })
  })

  it('bounds a polite close against a peer that never answers it', async () => {
    // ws.close(code) sends a close frame and then waits for the peer's answer —
    // so a dead or hung peer controls how long our own teardown takes. `ws`
    // bounds that wait via its closeTimeout option (destroying the socket and
    // firing 'close' anyway), which the transport pins to ~1s in place of the
    // 30s default. Pausing the server's raw socket simulates the hung peer: the
    // close frame is delivered but never read.
    await using server = await startServer((ws) => {
      // @ts-expect-error reaching into ws internals to stop the peer reading
      ws._socket.pause()
    })
    const controller = new AbortController()
    const onClose = vi.fn()
    let opened = false
    createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {
        opened = true
      },
      onClose,
    })
    // The close-handshake wait only exists on an *open* socket: aborting while
    // still CONNECTING tears down immediately and would pass vacuously.
    await vi.waitFor(() => assert(opened))
    const started = Date.now()
    // A bare AbortError asks for a polite 1000 close — the path that waits.
    controller.abort()
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), {
      timeout: 5_000,
    })
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(3_000) // well under ws's 30s default
    expect(onClose).toHaveBeenCalledWith({
      code: CloseCode.Abnormal,
      reason: '',
      wasClean: false,
    })
  })

  it('ends iteration and closes the socket when signal aborts', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const onClose = vi.fn()
    let opened = false
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {
        opened = true
      },
      onClose,
    })
    const drained = drain(transport)
    // Wait for a real open: asserting `onClose` has *not* fired passes on the
    // first tick and waits for nothing, leaving the abort to race the handshake.
    await vi.waitFor(() => assert(opened))
    const reason = new Error('stop')
    controller.abort(reason)
    const { error } = await drained
    expect(error).toBe(reason)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies real backpressure: a slow consumer pauses a fast server', async () => {
    let serverWs: WsSocket | undefined
    let interval: ReturnType<typeof setInterval> | undefined
    await using server = await startServer((ws) => {
      serverWs = ws
      ws.on('message', (data) => {
        if (data.toString() === 'go') {
          // Blast far more data than the client's watermark permits. Once the
          // transport pauses its socket, the client stops draining its kernel
          // receive buffer, TCP flow control kicks in, and the server's own
          // `bufferedAmount` climbs and stays high. That's the observable proxy
          // for real backpressure, without reaching into client internals.
          interval = setInterval(() => ws.send('x'.repeat(65536)), 0)
        }
      })
    })
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    // Never iterated: an unconsumed transport is exactly the slow-consumer
    // scenario under test, so only `send()` is exercised here.
    createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      highWaterMark: 1024,
      onOpen: (s) => {
        sender = s
      },
      onClose: () => {},
    })
    await vi.waitFor(() => assert(sender))
    await sender.send('go')
    await vi.waitFor(
      () => {
        assert(serverWs)
        expect(serverWs.bufferedAmount).toBeGreaterThan(1_000_000)
      },
      { timeout: 5000, interval: 20 },
    )
    clearInterval(interval)
    controller.abort()
  })

  it('keeps an idle connection alive via heartbeat against a real server', async () => {
    // `ws` answers protocol pings automatically (autoPong defaults to true),
    // so a server that never sends anything still keeps the heartbeat happy.
    let pingCount = 0
    let resolveThreePings!: () => void
    const threePings = new Promise<void>((resolve) => {
      resolveThreePings = resolve
    })
    await using server = await startServer((ws) => {
      ws.on('ping', () => {
        if (++pingCount === 3) resolveThreePings()
      })
    })
    const controller = new AbortController()
    const onClose = vi.fn()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      heartbeat: { intervalMs: 100 },
      onOpen: () => {},
      onClose,
    })
    const iterator = transport[Symbol.asyncIterator]()
    const pending = iterator.next()
    await Promise.race([threePings, pending])
    expect(onClose).not.toHaveBeenCalled()
    controller.abort()
    await pending.catch(() => {})
  })

  it('fails with HeartbeatTimeoutError when the server stops answering pings', async () => {
    await using server = await startServer((ws) => {
      // Disable the automatic pong response so pings go unanswered.
      // @ts-expect-error reaching into ws internals to disable autoPong
      ws._autoPong = false
    })
    const controller = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      heartbeat: { intervalMs: 20 },
      onOpen: () => {},
      onClose: () => {},
    })
    const { error } = await drain(transport)
    assert(error instanceof HeartbeatTimeoutError)
    expect(error.shouldRetry()).toBe(true)
  })

  it('stops delivering messages as soon as the signal aborts', async () => {
    // A polite close is a handshake: the socket stays readable until the peer
    // answers it, so frames already in flight keep arriving. None of them may be
    // yielded — the consumer asked to stop, and delivering more would mean an
    // abort no longer promptly ends delivery. The transport therefore fails the
    // channel when the abort lands, not when the close event arrives.
    let socket!: WsSocket
    await using server = await startServer((ws) => {
      socket = ws
      ws.send('one')
    })
    const ac = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
    })
    const iterator = transport[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: 'one', done: false })

    const reason = new Error('stop')
    ac.abort(reason)
    // Frames sent after the abort, while the close handshake is still settling.
    socket.send('two')
    socket.send('three')

    await expect(iterator.next()).rejects.toBe(reason)
    // And nothing leaked through on a later pull either.
    await expect(iterator.next()).rejects.toBe(reason)
  })

  it('completes rather than erroring on a pull after the consumer stops', async () => {
    await using server = await startServer((ws) => {
      ws.send('one')
      ws.send('two')
    })
    const ac = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: 'one', done: false })
    // A consumer stop is not the connection ending, so neither the return() nor
    // any later pull may surface an error. A pull after the stop used to
    // synthesize a *retryable* error, making a deliberate stop look like
    // transient trouble to the reconnect policy — whose `yield*` can pull again
    // after a downstream return() propagates.
    await expect(iterator.return!()).resolves.toEqual({
      value: undefined,
      done: true,
    })
    await expect(iterator.next()).resolves.toEqual({
      value: undefined,
      done: true,
    })
    ac.abort(new Error('test cleanup'))
  })

  it('settles iteration only once the socket has closed', async () => {
    // The contract a consumer relies on to treat the end of iteration as
    // "teardown is done": whatever ends the stream, the socket's close event has
    // already fired by the time the iterator settles. Observed through onClose,
    // which the transport invokes from that event.
    //
    // Checked on the three paths that end an *open* connection, since each
    // settles the channel from a different place: a consumer stop, a polite
    // abort, and a destructive abort.
    const stops: Array<{ name: string; stop: (ac: AbortController) => void }> =
      [
        { name: 'polite abort', stop: (ac) => ac.abort() },
        {
          name: 'destructive abort',
          stop: (ac) => ac.abort(new Error('boom')),
        },
      ]
    for (const { name, stop } of stops) {
      await using server = await startServer(() => {
        // Never sends, so the consumer's pull parks until the stop lands.
      })
      const ac = new AbortController()
      let closedAt: number | undefined
      let opened = false
      const transport = createTransport({
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'text',
        signal: ac.signal,
        onOpen: () => {
          opened = true
        },
        onClose: () => {
          closedAt = performance.now()
        },
      })
      const iterator = transport[Symbol.asyncIterator]()
      const parked = iterator.next().catch(() => 'rejected')
      await vi.waitFor(() => assert(opened))
      stop(ac)
      await parked
      const settledAt = performance.now()
      assert(closedAt !== undefined, `${name}: onClose never fired`)
      expect(closedAt, name).toBeLessThanOrEqual(settledAt)
    }

    // A consumer stop, which reaches the socket through the channel's return()
    // rather than the signal.
    await using server = await startServer((ws) => ws.send('one'))
    const ac = new AbortController()
    let closedAt: number | undefined
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
      onOpen: () => {},
      onClose: () => {
        closedAt = performance.now()
      },
    })
    const iterator = transport[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: 'one', done: false })
    await iterator.return!()
    const settledAt = performance.now()
    assert(closedAt !== undefined, 'consumer stop: onClose never fired')
    expect(closedAt).toBeLessThanOrEqual(settledAt)
  })

  it('rejects a parked pull with the abort reason', async () => {
    // The reconnect loop depends on this: a `yield*` parked on a pull can't
    // observe an abort by itself, so the transport has to reject the pull rather
    // than leave it hanging.
    await using server = await startServer(() => {
      // Never sends, so the consumer's pull parks.
    })
    const ac = new AbortController()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    const pull = iterator.next()
    const reason = new Error('stopped')
    ac.abort(reason)
    await expect(pull).rejects.toBe(reason)
  })

  it('does not arm the heartbeat before the socket opens', async () => {
    // `ws.ping()` throws while the socket is CONNECTING, and a throw inside a
    // timer callback is an uncaught exception nothing can catch — so a connect
    // slower than the interval would take the whole process down. 10.255.255.1:9
    // is a black hole: the connect hangs rather than being refused, holding the
    // socket in CONNECTING well past the 20ms interval below.
    //
    // Observed by prepending a process listener, ahead of the runner's own:
    // `process.once` alone sits behind vitest's handler and never sees it.
    const seen: string[] = []
    const onUncaught = (err: Error) => seen.push(err.message)
    process.prependListener('uncaughtException', onUncaught)
    const controller = new AbortController()
    try {
      createTransport({
        ...transportOptionDefaults,
        url: 'ws://10.255.255.1:9/',
        dataMode: 'text',
        signal: controller.signal,
        heartbeat: { intervalMs: 20 },
        onOpen: () => {},
        onClose: () => {},
      })
      // Outlive several intervals while the socket is still connecting.
      await new Promise((resolve) => setTimeout(resolve, 200))
    } finally {
      controller.abort(new Error('test cleanup'))
      process.removeListener('uncaughtException', onUncaught)
    }
    expect(seen).toEqual([])
  })

  it('arms a heartbeat by default, without being asked to', async () => {
    // WebSocketKeepAlive started a heartbeat unconditionally at 10s, and no
    // consumer ever passed the option — so an opt-in default would silently cost
    // every one of them dead-connection detection, and a black-holed connection
    // would park forever with no error.
    //
    // Asserted on the scheduled interval rather than an observed ping: 10s is too
    // long to wait for, and not worth pinning a fake-timer dance to a live socket
    // for. What regressed was whether a timer is armed at all.
    using setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    await using server = await startServer(() => {})
    const controller = new AbortController()
    let opened!: () => void
    const isOpen = new Promise<void>((resolve) => {
      opened = resolve
    })
    createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      // No `heartbeat` option: the default is what's under test.
      onOpen: () => opened(),
      onClose: () => {},
    })
    await isOpen
    controller.abort(new Error('test cleanup'))

    const delays = setIntervalSpy.mock.calls.map(([, ms]) => ms)
    expect(delays).toContain(DEFAULT_HEARTBEAT_INTERVAL_MS)
  })

  it('does not ping when the heartbeat is disabled', async () => {
    let pings = 0
    await using server = await startServer((socket) => {
      socket.on('ping', () => pings++)
    })
    const controller = new AbortController()
    createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      heartbeat: false,
      onOpen: () => {},
      onClose: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 120))
    controller.abort(new Error('test cleanup'))
    expect(pings).toBe(0)
  })

  it('fails with MessageTooBigError, closing with 1009, past maxPayload', async () => {
    let serverSaw: number | undefined
    await using server = await startServer((ws) => {
      ws.on('close', (code) => {
        serverSaw = code
      })
      ws.send('x'.repeat(2048))
    })
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: new AbortController().signal,
      maxPayload: 1024,
    })
    const { messages, error } = await drain(transport)
    expect(messages).toEqual([])
    assert(error instanceof MessageTooBigError)
    expect(error.maxPayload).toBe(1024)
    expect(error.shouldRetry()).toBe(false)
    await vi.waitFor(() => expect(serverSaw).toBe(CloseCode.MessageTooBig))
  })

  it('carries the status and headers of a refused upgrade', async () => {
    await using server = await startServer(() => {}, {
      verifyClient: (_info, cb) =>
        cb(false, 401, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' }),
    })
    const onClose = vi.fn()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: new AbortController().signal,
      onClose,
    })
    const { error } = await drain(transport)
    assert(error instanceof HandshakeRejectedError)
    expect(error.status).toBe(401)
    expect(error.headers.get('www-authenticate')).toBe('Bearer')
    expect(error.shouldRetry()).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fails with HandshakeTimeoutError when the upgrade never completes', async () => {
    // Accepts the TCP connection, then never answers the upgrade request.
    const sockets = new Set<Socket>()
    const tcp = createServer((socket) => sockets.add(socket))
    await once(tcp.listen(0), 'listening')
    try {
      const { port } = tcp.address() as AddressInfo
      const onClose = vi.fn()
      const transport = createTransport({
        ...transportOptionDefaults,
        url: `ws://localhost:${port}`,
        dataMode: 'text',
        signal: new AbortController().signal,
        handshakeTimeoutMs: 50,
        onClose,
      })
      const { error } = await drain(transport)
      assert(error instanceof HandshakeTimeoutError)
      expect(error.shouldRetry()).toBe(true)
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      for (const socket of sockets) socket.destroy()
      tcp.close()
    }
  })

  it('times a heartbeat out after timeoutMs rather than a full round', async () => {
    await using server = await startServer((ws) => {
      // @ts-expect-error reaching into ws internals to disable autoPong
      ws._autoPong = false
    })
    let openedAt = 0
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: new AbortController().signal,
      heartbeat: { intervalMs: 300, timeoutMs: 20 },
      onOpen: () => {
        openedAt = Date.now()
      },
    })
    const { error } = await drain(transport)
    assert(error instanceof HeartbeatTimeoutError)
    // ~320ms (ping, then the deadline), where a missed round takes ~600ms.
    expect(Date.now() - openedAt).toBeLessThan(500)
  })

  describe('sender.close()', () => {
    async function closeWith(code: number, reason?: string) {
      let serverSaw: { code: number; reason: string } | undefined
      await using server = await startServer((ws) => {
        ws.on('close', (code, buf) => {
          serverSaw = { code, reason: buf.toString() }
        })
      })
      let sender!: Sender<'text'>
      const transport = createTransport({
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'text',
        signal: new AbortController().signal,
        onOpen: (s) => {
          sender = s
        },
      })
      const drained = drain(transport)
      await vi.waitFor(() => assert(sender))
      sender.close(code, reason)
      const { error } = await drained
      await vi.waitFor(() => assert(serverSaw))
      return { error, serverSaw }
    }

    it('ends the connection with a CloseError of that code', async () => {
      const { error, serverSaw } = await closeWith(
        CloseCode.TryAgainLater,
        'busy',
      )
      assert(error instanceof CloseError)
      expect([error.code, error.reason]).toEqual([
        CloseCode.TryAgainLater,
        'busy',
      ])
      expect(serverSaw).toEqual({
        code: CloseCode.TryAgainLater,
        reason: 'busy',
      })
    })

    it('drops the socket without a closing handshake for 1006', async () => {
      const { error, serverSaw } = await closeWith(CloseCode.Abnormal)
      assert(error instanceof CloseError)
      expect(error.code).toBe(CloseCode.Abnormal)
      expect(serverSaw?.code).toBe(CloseCode.Abnormal)
    })

    it('sends 1000 for a code ws cannot send', async () => {
      const { error, serverSaw } = await closeWith(CloseCode.NoStatus)
      assert(error instanceof CloseError)
      expect(error.code).toBe(CloseCode.NoStatus)
      expect(serverSaw?.code).toBe(CloseCode.Normal)
    })

    it('throws on an oversized reason, leaving the connection open', async () => {
      await using server = await startServer(() => {})
      const controller = new AbortController()
      let sender!: Sender<'text'>
      createTransport({
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'text',
        signal: controller.signal,
        onOpen: (s) => {
          sender = s
        },
      })
      await vi.waitFor(() => assert(sender))
      expect(() => sender.close(CloseCode.Normal, 'x'.repeat(124))).toThrow(
        RangeError,
      )
      await expect(sender.send('still open')).resolves.toBeUndefined()
      controller.abort(new Error('test cleanup'))
    })
  })

  it('settles a transport created with an aborted signal', async () => {
    await using server = await startServer(() => {})
    const reason = new Error('stop')
    const onClose = vi.fn()
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: AbortSignal.abort(reason),
      onClose,
    })
    const { error } = await drain(transport)
    expect(error).toBe(reason)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('drops the socket on an abort with a 1006 CloseError', async () => {
    let serverSaw: number | undefined
    await using server = await startServer((ws) => {
      ws.on('close', (code) => {
        serverSaw = code
      })
    })
    const controller = new AbortController()
    let opened = false
    const transport = createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      onOpen: () => {
        opened = true
      },
    })
    const drained = drain(transport)
    await vi.waitFor(() => assert(opened))
    controller.abort(new CloseError(CloseCode.Abnormal, '', false))
    await drained
    await vi.waitFor(() => expect(serverSaw).toBe(CloseCode.Abnormal))
  })

  it('exposes the negotiated subprotocol on the sender', async () => {
    await using server = await startServer(() => {}, {
      handleProtocols: () => 'v2',
    })
    const controller = new AbortController()
    let sender!: Sender<'text'>
    createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      protocols: ['v1', 'v2'],
      onOpen: (s) => {
        sender = s
      },
    })
    await vi.waitFor(() => assert(sender))
    expect(sender.protocol).toBe('v2')
    controller.abort(new Error('test cleanup'))
  })

  it('resolves the host with the given lookup', async () => {
    expectTypeOf(lookup).toExtend<LookupFunction>()
    const hostnames: string[] = []
    await using server = await startServer(() => {})
    const controller = new AbortController()
    let opened = false
    createTransport({
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      lookup: (hostname, options, callback) => {
        hostnames.push(hostname)
        lookup(hostname, options as LookupOptions, callback)
      },
      onOpen: () => {
        opened = true
      },
    })
    await vi.waitFor(() => assert(opened))
    expect(hostnames).toEqual(['localhost'])
    controller.abort(new Error('test cleanup'))
  })
})
