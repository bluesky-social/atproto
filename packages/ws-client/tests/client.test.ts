import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketConnectionEngine } from '../src/connection.js'
import {
  AbnormalCloseError,
  BufferOverflowError,
  WebSocketClientError,
} from '../src/errors.js'
import { WebSocketClientBase } from '../src/client.js'
import type { CloseEventDetail } from '../src/typed-event-target.js'
import { MockTransport } from './_util/mock-transport.js'

function makeClient<M extends 'auto' | 'text' | 'binary' = 'auto'>(
  options?: ConstructorParameters<typeof WebSocketClientBase<M>>[2],
  url: string | URL | (() => string | URL | Promise<string | URL>) = 'ws://x',
) {
  const mocks: MockTransport[] = []
  const factory = (u: string | URL, connectionOptions: any) => {
    const mock = new MockTransport()
    mocks.push(mock)
    return new WebSocketConnectionEngine(() => mock, u, connectionOptions)
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

  it('yields across a clean 1001 reconnect and fires open/reconnect events with the right flag', async () => {
    const opens: boolean[] = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('open', () => opens.push(false))
    ws.addEventListener('reconnect', () => opens.push(true))
    const received: (string | Uint8Array)[] = []

    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 2) break
      }
    })()

    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('a', false)
    mocks[0].emitClose(1001, 'going away', true) // reconnect
    await vi.advanceTimersByTimeAsync(2000) // backoff
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('b', false)
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
    mocks[0].emitMessage('x', false)
    mocks[0].emitClose(1000, '', true) // fatal-clean → stop
    await consume
    expect(received).toEqual(['x'])
    expect(mocks).toHaveLength(1) // never reconnected
  })

  it('reconnects on AbnormalCloseError with a reconnectable code', async () => {
    const errs: Array<{ willReconnect: boolean; attempt: number }> = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('error', (e) =>
      errs.push({
        willReconnect: !!e.detail.reconnect,
        attempt: e.detail.reconnect?.attempt ?? 0,
      }),
    )
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) {
        received.push(msg)
        if (received.length === 1) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1011, 'server error', false) // AbnormalCloseError(1011) → reconnect
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('ok', false)
    await consume
    expect(errs[0]).toMatchObject({
      willReconnect: true,
      attempt: expect.any(Number),
    })
    expect(received).toEqual(['ok'])
  })

  it('propagates a fatal AbnormalCloseError (1002) and stops', async () => {
    const errs: Array<{ willReconnect: boolean }> = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('error', (e) =>
      errs.push({ willReconnect: !!e.detail.reconnect }),
    )
    const consume = (async () => {
      for await (const _msg of ws) {
        /* noop */
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitClose(1002, 'protocol error', false)
    await expect(consume).rejects.toSatisfy((err) => {
      assert(err instanceof AbnormalCloseError)
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
    mocks[0].emitMessage(new Uint8Array(10), true)
    mocks[0].emitMessage(new Uint8Array(10), true) // 10 > 5 → BufferOverflowError
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
    mocks[0].emitClose(1006, '', false) // reconnect, attempt 0 → fast (≤1s)
    await vi.advanceTimersByTimeAsync(1000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('done', false)
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
    mocks[1].emitMessage('recovered', false)
    await consume
    expect(received).toEqual(['recovered'])
  })

  it('close() ends the loop and does not reconnect', async () => {
    const { ws, mocks } = makeClient()
    const received: unknown[] = []
    const consume = (async () => {
      for await (const msg of ws) received.push(msg)
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('one', false)
    const closing = ws.close(1000)
    // core sees close → emits its close echo:
    mocks[0].emitClose(1000, '', true)
    await closing
    await consume
    expect(received).toEqual(['one'])
    expect(mocks).toHaveLength(1)
  })

  it('signal abort ends the loop', async () => {
    const ac = new AbortController()
    const { ws, mocks } = makeClient({ signal: ac.signal })
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
    await vi.advanceTimersByTimeAsync(1000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('x', false)
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

    // Attempt 0: fails before ever opening → retries stays 0, next wait is fast (≤1s).
    await tick()
    expect(mocks).toHaveLength(1)
    mocks[0].emitClose(1006, '', false)
    await vi.advanceTimersByTimeAsync(1000)
    await tick()

    // Attempt 1: also fails before opening → retries becomes 1, escalating the
    // *next* wait to backoffMs(1) (~1.5-2.5s with jitter) since no open reset it.
    expect(mocks).toHaveLength(2)
    mocks[1].emitClose(1006, '', false)

    // A short wait shorter than the escalated backoff must NOT yet produce a
    // third connection attempt.
    await vi.advanceTimersByTimeAsync(1000)
    await tick()
    expect(mocks).toHaveLength(2)

    // Advancing well past the full escalated window (up to ~2.5s more) does.
    await vi.advanceTimersByTimeAsync(2000)
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
    mocks[0].emitMessage('one', false)
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
    mocks[0].emitMessage('x', false)
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
    mocks[1].emitMessage('ok', false)
    await consume
    expect(received).toEqual(['ok'])
  })
})

describe('WebSocketClient events', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('dispatches open once (initial) and reconnect on each reopen', async () => {
    const events: string[] = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('open', () => events.push('open'))
    ws.addEventListener('reconnect', () => events.push('reconnect'))
    const received: unknown[] = []
    const consume = (async () => {
      for await (const m of ws) {
        received.push(m)
        if (received.length === 2) break
      }
    })()
    await tick()
    mocks[0].emitOpen()
    mocks[0].emitMessage('a', false)
    mocks[0].emitClose(1001, 'going away', true) // clean 1001 → reconnect
    await vi.advanceTimersByTimeAsync(2000)
    await tick()
    mocks[1].emitOpen()
    mocks[1].emitMessage('b', false)
    await consume
    expect(events).toEqual(['open', 'reconnect'])
  })

  it('error event carries reconnect:{attempt} for a reconnectable error, absent for fatal', async () => {
    const errs: Array<{ hasReconnect: boolean; attempt?: number }> = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('error', (e) =>
      errs.push({
        hasReconnect: !!e.detail.reconnect,
        attempt: e.detail.reconnect?.attempt,
      }),
    )
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

  it('dispatches a single final close on fatal termination', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('close', (e) => closes.push(e.detail))
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

  it('dispatches final close on a clean 1000 stop', async () => {
    const closes: CloseEventDetail[] = []
    const { ws, mocks } = makeClient()
    ws.addEventListener('close', (e) => closes.push(e.detail))
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
