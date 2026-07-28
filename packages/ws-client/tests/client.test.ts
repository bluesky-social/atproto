import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ConnectionFactory, WebSocketClientBase } from '../src/client.js'
import {
  type CloseEventDetail,
  type DataMode,
  WebSocketConnectionEngine,
  type WebSocketConnectionOptions,
} from '../src/connection.js'
import {
  BufferOverflowError,
  CloseError,
  WebSocketClientError,
  WebSocketConnectionError,
} from '../src/lib/errors.js'
import { MockTransport } from './_util/mock-transport.js'

function makeClient<M extends 'auto' | 'text' | 'binary' = 'auto'>(
  options?: ConstructorParameters<typeof WebSocketClientBase<M>>[2],
  url: string | URL | (() => string | URL | Promise<string | URL>) = 'ws://x',
) {
  const mocks: MockTransport[] = []
  const factory: ConnectionFactory = <F extends DataMode>(
    u: string | URL,
    connectionOptions: WebSocketConnectionOptions<F>,
  ) => {
    const mock = new MockTransport()
    mocks.push(mock)
    return new WebSocketConnectionEngine<F>(mock.factory, u, connectionOptions)
  }
  const ws = new WebSocketClientBase<M>(factory, url, options)
  return { ws, mocks }
}

// Let the loop advance to the point where mock N exists and has a consumer.
async function tick() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('WebSocketClientBase', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('yields across a clean 1001 reconnect and fires open/reconnect hooks with the right flag', async () => {
    const opens: boolean[] = []
    const { ws, mocks } = makeClient({
      onOpen: () => opens.push(false),
      onReconnect: () => opens.push(true),
    })
    const received: (string | Uint8Array)[] = []

    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 2) break
      }
    })()

    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('a')
    mocks[0].emitClose(1001, 'going away', true) // reconnect
    await vi.advanceTimersByTimeAsync(2000) // backoff
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('b')
    await consume

    expect(received).toEqual(['a', 'b'])
    expect(opens).toEqual([false, true]) // first connect, then reconnect
  })

  it('stops (no reconnect) on a clean 1000 close', async () => {
    const { ws, mocks } = makeClient()
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) received.push(msg)
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('x')
    mocks[0].emitClose(1000, '', true) // fatal-clean → stop
    await consume
    expect(received).toEqual(['x'])
    expect(mocks).toHaveLength(1) // never reconnected
  })

  it('reconnects on CloseError with a reconnectable code', async () => {
    const errs: Array<{ willReconnect: boolean; attempt: number }> = []
    const { ws, mocks } = makeClient({
      onError: (_error, reconnect) =>
        errs.push({
          willReconnect: !!reconnect,
          attempt: reconnect?.attempt ?? 0,
        }),
    })
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 1) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1011, 'server error', false) // CloseError(1011) → reconnect
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('ok')
    await consume
    expect(errs[0]).toMatchObject({
      willReconnect: true,
      attempt: expect.any(Number),
    })
    expect(received).toEqual(['ok'])
  })

  it('propagates a fatal CloseError (1002) and stops', async () => {
    const errs: Array<{ willReconnect: boolean }> = []
    const { ws, mocks } = makeClient({
      onError: (_error, reconnect) => errs.push({ willReconnect: !!reconnect }),
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1002, 'protocol error', false)
    await expect(consume).rejects.toSatisfy((err) => {
      assert(err instanceof CloseError)
      expect(err.code).toBe(1002)
      return true
    })
    expect(errs[0]).toMatchObject({ willReconnect: false })
    expect(mocks).toHaveLength(1)
  })

  it('propagates a fatal BufferOverflowError and stops', async () => {
    const { ws, mocks } = makeClient({ maxBufferedBytes: 5 })
    const consume = (async () => {
      // Frames arrive faster than the consumer drains → buffer grows → overflow.
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    // First frame is delivered to the parked consumer; while the generator is
    // suspended at `yield`, the second frame buffers (10 > 5) → overflow.
    mocks[0].emitMessage(new Uint8Array(10))
    mocks[0].emitMessage(new Uint8Array(10)) // 10 > 5 → BufferOverflowError
    await expect(consume).rejects.toBeInstanceOf(BufferOverflowError)
    expect(mocks).toHaveLength(1)
  })

  it('applies backoff between attempts and resets after a successful open', async () => {
    const { ws, mocks } = makeClient()
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 1) break
      }
    })()
    await tick()
    mocks[0].emitOpen() // opens → attempt counter resets to 0
    mocks[0].emitClose(1006, '', false) // reconnect, attempt 0 → backoffMs(0)
    // backoffMs(0) is jittered 500-1500ms; advance past its maximum.
    await vi.advanceTimersByTimeAsync(1500)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('done')
    await consume
    expect(received).toEqual(['done'])
    expect(mocks.length).toBeGreaterThanOrEqual(2)
  })

  it('shouldReconnect override forces a normally-fatal error to reconnect', async () => {
    const { ws, mocks } = makeClient({
      shouldReconnect: () => true, // even DataModeError reconnects
    })
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 1) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    // Force a DataModeError: text engine gets a binary frame. Use dataMode:'text'.
    // (Simpler: emit a 1002 close which is normally fatal; override makes it reconnect.)
    mocks[0].emitClose(1002, '', false)
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('recovered')
    await consume
    expect(received).toEqual(['recovered'])
  })

  it('shouldReconnect override can reconnect across a server-sent clean 1000 close', async () => {
    const consulted: Array<{ code: number; wasClean: boolean }> = []
    const { ws, mocks } = makeClient({
      shouldReconnect: (error) => {
        assert(error instanceof CloseError)
        consulted.push({ code: error.code, wasClean: error.wasClean })
        return true
      },
    })
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 2) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('a')
    mocks[0].emitClose(1000, 'batch done', true) // server-sent clean close
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('b')
    await consume
    expect(received).toEqual(['a', 'b'])
    expect(mocks).toHaveLength(2)
    // The predicate was consulted with the clean 1000 close, not bypassed.
    expect(consulted).toEqual([{ code: 1000, wasClean: true }])
  })

  it('close() ends the loop and does not reconnect', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) received.push(msg)
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    const closing = ws.close(1000)
    // core sees close → emits its close echo:
    mocks[0].emitClose(1000, '', true)
    await closing
    await consume
    expect(received).toEqual(['one'])
    expect(mocks).toHaveLength(1)
    // Exactly one final 'close', carrying the handshake's real detail.
    expect(closes).toEqual([{ code: 1000, reason: '', wasClean: true }])
  })

  it('close() mid-backoff fires one final onClose with 1005 (no status)', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1006, '', false) // reconnectable → loop enters backoff
    await tick()
    await ws.close()
    await consume
    expect(mocks).toHaveLength(1) // never reconnected
    // No close handshake applied to this stop: synthesized 1005 per WHATWG.
    expect(closes).toEqual([{ code: 1005, reason: '', wasClean: false }])
  })

  it('close() after close() is inert: no state wobble, same completion', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    const closing = ws.close(1000)
    mocks[0].emitClose(1000, '', true)
    await closing
    await consume
    expect(ws.readyState).toBe('closed')
    // A repeat close() (with a different code, which is ignored: first call
    // wins) resolves without walking state back through 'closing'.
    const again = ws.close(1011, 'ignored')
    expect(ws.readyState).toBe('closed')
    await again
    expect(ws.readyState).toBe('closed')
    // Still exactly one onClose, carrying the original handshake detail.
    expect(closes).toEqual([{ code: 1000, reason: '', wasClean: true }])
  })

  it('concurrent close() calls share the first call/s completion', async () => {
    const { ws, mocks } = makeClient()
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    // Two close() calls while the handshake is still in flight.
    let first = false
    let second = false
    const closing1 = ws.close(1000).then(() => (first = true))
    const closing2 = ws.close(1000).then(() => (second = true))
    await tick()
    // Neither resolves before the close handshake completes.
    expect(first).toBe(false)
    expect(second).toBe(false)
    mocks[0].emitClose(1000, '', true)
    await Promise.all([closing1, closing2])
    await consume
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(ws.readyState).toBe('closed')
  })

  it('close() resolves only after the final onClose hook has fired', async () => {
    const order: string[] = []
    const { ws, mocks } = makeClient({
      onClose: () => order.push('onClose'),
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    const closing = ws.close(1000).then(() => order.push('close resolved'))
    mocks[0].emitClose(1000, '', true)
    await closing
    await consume
    expect(order).toEqual(['onClose', 'close resolved'])
  })

  it('a stop during resolveUrl (before any connection) still fires onClose', async () => {
    const closes: CloseEventDetail[] = []
    let resolveUrl!: (url: string) => void
    const { ws, mocks } = makeClient(
      { onClose: (detail) => closes.push(detail) },
      // A url function that parks until the test releases it.
      () => new Promise<string>((resolve) => (resolveUrl = resolve)),
    )
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    // The loop is parked in resolveUrl: no connection exists yet.
    expect(mocks).toHaveLength(0)
    const closing = ws.close()
    resolveUrl('ws://x') // release the gap; the loop observes the stop
    await closing
    await consume
    expect(mocks).toHaveLength(0) // stop won: no connection was created
    // The lifecycle started (iteration began), so onClose fires: 1005.
    expect(closes).toEqual([{ code: 1005, reason: '', wasClean: false }])
  })

  it('a fatal error stops the client terminally: close() is inert, re-iteration throws the cause', async () => {
    const { ws, mocks } = makeClient()
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1002, 'protocol error', false) // fatal
    await expect(consume).rejects.toBeInstanceOf(CloseError)
    expect(ws.readyState).toBe('closed')
    // The stop signal recorded the failure: close() is an inert no-op...
    await ws.close()
    expect(ws.readyState).toBe('closed')
    // ...and iterating again rethrows the terminal cause (the more useful
    // diagnosis), mirroring the connection's terminal iteration guard.
    expect(() => ws[Symbol.asyncIterator]()).toThrow(CloseError)
  })

  it('no message is delivered after onClose, whichever way the client stops', async () => {
    // The client's onClose is stream-end: once it fires, the iterator is
    // finished. Exercise a stop mid-stream with buffered backlog and confirm
    // every delivered message precedes onClose in the timeline.
    const timeline: string[] = []
    const { ws, mocks } = makeClient({
      onClose: () => timeline.push('onClose'),
    })
    const consume = (async () => {
      for await (const msg of ws) {
        timeline.push(`message:${msg}`)
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    mocks[0].emitMessage('two')
    await tick()
    const closing = ws.close(1000)
    mocks[0].emitMessage('late') // dropped: arrives after the stop
    mocks[0].emitClose(1000, '', true)
    await closing
    await consume
    const closeAt = timeline.indexOf('onClose')
    expect(closeAt).toBeGreaterThan(0) // fired, after at least one message
    expect(closeAt).toBe(timeline.length - 1) // and nothing delivered after it
  })

  it('close() drops undelivered messages for an active consumer (drop-on-close)', async () => {
    const { ws, mocks } = makeClient()
    const received: unknown[] = []
    let closing: Promise<void> | undefined
    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        // Stop after the first message, with more already buffered: the
        // stream must end without delivering them.
        closing ??= ws.close(1000)
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    mocks[0].emitMessage('buffered-1')
    mocks[0].emitMessage('buffered-2')
    await tick()
    mocks[0].emitClose(1000, '', true)
    await closing
    await consume
    expect(received).toEqual(['one'])
  })

  it('close() drives an abandoned iterator to its terminal', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    // Consume one message via the raw iterator, then abandon it: no break,
    // no return — the generator stays parked at its yield.
    const it = ws[Symbol.asyncIterator]()
    const first = it.next()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    expect((await first).value).toBe('one')
    // close() must not hang on the parked generator: it drives the iterator's
    // return() (the same mechanism a consumer break uses), running the
    // terminal — onClose fires and close() resolves after it.
    const closing = ws.close(1000)
    mocks[0].emitClose(1000, '', true)
    await closing
    expect(ws.readyState).toBe('closed')
    expect(closes).toEqual([{ code: 1000, reason: '', wasClean: true }])
  })

  it('signal abort drives an abandoned iterator to its terminal', async () => {
    const ac = new AbortController()
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      signal: ac.signal,
      onClose: (detail) => closes.push(detail),
    })
    const it = ws[Symbol.asyncIterator]()
    const first = it.next()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    expect((await first).value).toBe('one')
    // Abandoned: the generator is parked at yield. The abort pushes it to its
    // terminal so onClose still fires.
    ac.abort(new Error('user stop'))
    expect(ws.readyState).toBe('closed')
    await vi.waitFor(() => expect(closes).toHaveLength(1))
  })

  it('close() on an obtained-but-never-pulled iterator resolves with no onClose', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    // Obtain the iterator but never call next(): the generator body never
    // runs, so there is no lifecycle — close() must not await a terminal
    // that is never coming.
    ws[Symbol.asyncIterator]()
    await ws.close()
    expect(ws.readyState).toBe('closed')
    expect(closes).toEqual([]) // never started: no lifecycle, no onClose
    expect(mocks).toHaveLength(0) // no connection was ever created
  })

  it('signal abort settles readyState closed synchronously', async () => {
    const ac = new AbortController()
    const { ws, mocks } = makeClient({ signal: ac.signal })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })().catch(() => {})
    await tick()
    mocks[0].emitOpen()
    expect(ws.readyState).toBe('open')
    ac.abort(new Error('user stop'))
    // Mirrors WebSocketConnection#fail: terminal state at the moment of the
    // abort, not after the loop unwinds.
    expect(ws.readyState).toBe('closed')
    await consume
    expect(ws.readyState).toBe('closed')
  })

  it('close() on a never-iterated client goes straight to closed; iteration then throws', async () => {
    const closes: CloseEventDetail[] = []
    const { ws } = makeClient({ onClose: (detail) => closes.push(detail) })
    const closing = ws.close()
    // Mirrors the connection's initialized → closed edge: no 'closing' state.
    expect(ws.readyState).toBe('closed')
    await closing
    expect(ws.readyState).toBe('closed')
    // Never started: no lifecycle to close, so no onClose.
    expect(closes).toEqual([])
    // Iterating a stopped client is a programmer error, as on the connection.
    expect(() => ws[Symbol.asyncIterator]()).toThrow(WebSocketClientError)
  })

  it('abort on a never-iterated client settles closed; iteration rethrows the reason', async () => {
    const ac = new AbortController()
    const { ws } = makeClient({ signal: ac.signal })
    ac.abort(new Error('pre-iteration stop'))
    expect(ws.readyState).toBe('closed')
    // Mirrors the connection's error-terminal iteration guard: the stop cause
    // is the more useful diagnosis.
    expect(() => ws[Symbol.asyncIterator]()).toThrow('pre-iteration stop')
  })

  it('close() after a signal abort is an inert no-op', async () => {
    const ac = new AbortController()
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      signal: ac.signal,
      onClose: (detail) => closes.push(detail),
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    ac.abort(new Error('user stop'))
    await expect(consume).rejects.toThrow('user stop')
    expect(ws.readyState).toBe('closed')
    await ws.close()
    expect(ws.readyState).toBe('closed')
    // onClose fired exactly once, from the abort — close() added nothing.
    expect(closes).toHaveLength(1)
  })

  it('throws at construction when the signal is already aborted', () => {
    const ac = new AbortController()
    ac.abort(new Error('pre-aborted'))
    expect(() => makeClient({ signal: ac.signal })).toThrow('pre-aborted')
  })

  it('abort from inside the for-await body still rejects the iterator with the reason', async () => {
    // The consumer aborts between pulls (no next() in flight): the stop's
    // internal generator wind-down must not surface as a clean end — the
    // consumer's next pull rejects with the abort reason.
    const ac = new AbortController()
    const { ws, mocks } = makeClient({ signal: ac.signal })
    let error: unknown
    const consume = (async () => {
      try {
        for await (const msg of ws) {
          if (msg === 'one') ac.abort(new Error('Oops!'))
        }
      } catch (err) {
        error = err
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    await consume
    expect(error).toEqual(new Error('Oops!'))
  })

  it('signal abort ends the loop and fires one final onClose', async () => {
    const ac = new AbortController()
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      signal: ac.signal,
      onClose: (detail) => closes.push(detail),
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    ac.abort(new Error('user stop'))
    await expect(consume).rejects.toThrow('user stop')
    expect(mocks).toHaveLength(1)
    expect(closes).toHaveLength(1)
  })

  it('send() while a connection exists but is not open rejects with WebSocketConnectionError', async () => {
    const { ws, mocks } = makeClient()
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })().catch(() => {})
    await tick()
    // A connection exists but has not opened yet ('connecting').
    expect(mocks).toHaveLength(1)
    await expect(ws.send('x' as never)).rejects.toBeInstanceOf(
      WebSocketConnectionError,
    )
    mocks[0].emitOpen()
    mocks[0].emitClose(1000, '', true)
    await consume
  })

  it('drops no abort that lands while the URL is resolving', async () => {
    const ac = new AbortController()
    let releaseUrl!: () => void
    const urlGate = new Promise<void>((resolve) => {
      releaseUrl = resolve
    })
    const { ws, mocks } = makeClient({ signal: ac.signal }, async () => {
      await urlGate
      return 'ws://x'
    })
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick() // loop is now awaiting resolveUrl()
    ac.abort(new Error('stop')) // abort DURING url resolution
    releaseUrl() // let resolveUrl resolve
    await expect(consume).rejects.toThrow('stop')
    expect(mocks).toHaveLength(0) // no core was ever constructed
  })

  it('re-resolves a URL thunk on each connect', async () => {
    const urls: string[] = []
    let n = 0
    const { ws, mocks } = makeClient(undefined, () => {
      const u = `ws://host/${n++}`
      urls.push(u)
      return u
    })
    const consume = (async () => {
      for await (const _msg of ws) break
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1006, '', false)
    // backoffMs(0) is jittered 500-1500ms; advance past its maximum.
    await vi.advanceTimersByTimeAsync(1500)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('x')
    await consume
    expect(urls).toEqual(['ws://host/0', 'ws://host/1'])
  })

  it('escalates backoff across consecutive pre-open failures', async () => {
    const { ws, mocks } = makeClient()
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()

    // Attempt 0: fails before ever opening → retries stays 0, next wait is
    // backoffMs(0), jittered 500-1500ms. Advance past its maximum.
    await tick()
    expect(mocks).toHaveLength(1)
    mocks[0].emitClose(1006, '', false)
    await vi.advanceTimersByTimeAsync(1500)
    await tick()

    // Attempt 1: also fails before opening → retries becomes 1, escalating the
    // *next* wait to backoffMs(1) (1.5-2.5s with jitter) since no open reset it.
    expect(mocks).toHaveLength(2)
    mocks[1].emitClose(1006, '', false)

    // A wait shorter than the escalated backoff's minimum (1.5s) must NOT yet
    // produce a third connection attempt.
    await vi.advanceTimersByTimeAsync(1000)
    await tick()
    expect(mocks).toHaveLength(2)

    // Advancing past the escalated window's maximum (up to 1.5s more) does.
    await vi.advanceTimersByTimeAsync(1500)
    await tick()
    expect(mocks).toHaveLength(3)

    // Clean up: let the loop settle via close() rather than waiting on the wire.
    // (Don't await `closing` before the echo: ws.close() awaits core.close(),
    // which itself awaits the core's `closed` promise — that only settles once
    // the mock's close is echoed below.)
    const closing = ws.close(1000)
    mocks[2].emitClose(1000, '', true)
    await closing
    await consume
  })

  it('close() interrupts an active backoff sleep promptly, without waiting out the window', async () => {
    const { ws, mocks } = makeClient()
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) received.push(msg)
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one')
    mocks[0].emitClose(1006, '', false) // reconnectable → loop parks in backoff sleep
    await tick() // let the rejection propagate through catch/continue into sleep()

    const closing = ws.close(1000)
    // Only a tiny advance (well under the backoff window) — the point is that
    // close() wakes the parked sleep itself, not that we waited it out.
    await vi.advanceTimersByTimeAsync(2)
    await tick()

    await expect(closing).resolves.toBeUndefined()
    await consume
    expect(received).toEqual(['one'])
    expect(mocks).toHaveLength(1) // no reconnect attempt was made
  })

  it('send rejects when not connected, resolves when open', async () => {
    const { ws, mocks } = makeClient()
    await expect(ws.send('early' as never)).rejects.toThrow()
    const consume = (async () => {
      for await (const _msg of ws) break
    })()
    await tick()
    mocks[0].emitOpen()
    expect(ws.connected).toBe(true)
    const p = ws.send('hello' as never)
    // MockTransport records the send; flush it
    mocks[0].sent[0].onFlush()
    await expect(p).resolves.toBeUndefined()
    mocks[0].emitMessage('x')
    await consume
  })

  it('send() before connected rejects with WebSocketClientError', async () => {
    const { ws } = makeClient()
    await expect(ws.send('x' as never)).rejects.toBeInstanceOf(
      WebSocketClientError,
    )
  })

  it('iterating twice throws WebSocketClientError', () => {
    const { ws } = makeClient()
    ws[Symbol.asyncIterator]()
    expect(() => ws[Symbol.asyncIterator]()).toThrow(WebSocketClientError)
  })
})

describe('shouldReconnect boolean', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shouldReconnect: false never reconnects (a normally-reconnectable error is fatal)', async () => {
    const { ws, mocks } = makeClient({ shouldReconnect: false })
    const consume = (async () => {
      for await (const _ of ws) {
        /* */
      }
    })().catch(() => {})
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1011, 'server error', false) // normally reconnectable
    await consume
    expect(mocks).toHaveLength(1) // never created a second connection
  })

  it('shouldReconnect: true (default) uses the default predicate — reconnects on 1011', async () => {
    const { ws, mocks } = makeClient({ shouldReconnect: true })
    const received: unknown[] = []
    const consume = (async () => {
      for await (const m of ws) {
        received.push(m)
        if (received.length === 1) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1011, '', false)
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('ok')
    await consume
    expect(received).toEqual(['ok'])
  })
})

describe('WebSocketClient hooks', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires onOpen once (initial) and onReconnect on each reopen', async () => {
    const events: string[] = []
    const { ws, mocks } = makeClient({
      onOpen: () => events.push('open'),
      onReconnect: () => events.push('reconnect'),
    })
    const received: unknown[] = []
    const consume = (async () => {
      for await (const m of ws) {
        received.push(m)
        if (received.length === 2) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('a')
    mocks[0].emitClose(1001, 'going away', true) // clean 1001 → reconnect
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('b')
    await consume
    expect(events).toEqual(['open', 'reconnect'])
  })

  it('onError carries reconnect:{attempt} for a reconnectable error, absent for fatal', async () => {
    const errs: Array<{ hasReconnect: boolean; attempt?: number }> = []
    const { ws, mocks } = makeClient({
      onError: (_error, reconnect) =>
        errs.push({
          hasReconnect: !!reconnect,
          attempt: reconnect?.attempt,
        }),
    })
    const consume = (async () => {
      for await (const _ of ws) {
        /* */
      }
    })().catch(() => {})
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1011, 'server error', false) // reconnectable
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitClose(1002, 'protocol', false) // fatal
    await consume
    expect(errs[0]).toMatchObject({ hasReconnect: true })
    expect(errs[errs.length - 1]).toMatchObject({ hasReconnect: false })
  })

  it('fires a single final onClose on fatal termination', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    const consume = (async () => {
      for await (const _ of ws) {
        /* */
      }
    })().catch(() => {})
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1002, 'protocol', false) // fatal → stop
    await consume
    expect(closes).toHaveLength(1)
    expect(closes[0].code).toBe(1002)
  })

  it('fires final onClose on a clean 1000 stop', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient({
      onClose: (detail) => closes.push(detail),
    })
    const consume = (async () => {
      for await (const _ of ws) {
        /* */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1000, '', true)
    await consume
    expect(closes).toEqual([{ code: 1000, reason: '', wasClean: true }])
  })
})
