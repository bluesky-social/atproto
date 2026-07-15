import { assert, describe, expect, it } from 'vitest'
import { WebSocketCoreEngine } from '../src/core.js'
import { AbnormalCloseError, SocketError } from '../src/errors.js'
import type { CloseEventDetail } from '../src/typed-event-target.js'
import { MockTransport } from './_util/mock-transport.js'

function makeEngine<M extends 'auto' | 'text' | 'binary' = 'auto'>(
  options?: ConstructorParameters<typeof WebSocketCoreEngine<M>>[2] & {
    mock?: MockTransport
  },
) {
  const mock = options?.mock ?? new MockTransport()
  const engine = new WebSocketCoreEngine<M>(() => mock, 'ws://x', options)
  return { engine, mock }
}

describe('WebSocketCoreEngine iterator', () => {
  it('starts in initialized and exposes capabilities', () => {
    const { engine, mock } = makeEngine()
    expect(engine.readyState).toBe('initialized')
    expect(engine.capabilities).toEqual(mock.capabilities)
    expect(engine.protocol).toBe('')
  })

  it('dispatches open and reports protocol on open', async () => {
    const mock = new MockTransport({ protocol: 'jetstream' })
    const { engine } = makeEngine({ mock })
    let opened = false
    engine.addEventListener('open', () => (opened = true))
    // Lazy open: start a pull first so the transport opens.
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    expect(opened).toBe(true)
    expect(engine.readyState).toBe('open')
    expect(engine.protocol).toBe('jetstream')
  })

  it('yields messages in order, then ends cleanly on 1000', async () => {
    const { engine, mock } = makeEngine()
    let closeDetail: CloseEventDetail | undefined
    engine.addEventListener('close', (e) => (closeDetail = e.detail))
    mock.emitOpen()
    const received: (string | Uint8Array)[] = []
    const done = (async () => {
      for await (const msg of engine) received.push(msg)
    })()
    mock.emitMessage('a', false)
    mock.emitMessage('b', false)
    mock.emitClose(1000, '', true)
    await done
    expect(received).toEqual(['a', 'b'])
    expect(closeDetail).toEqual({ code: 1000, reason: '', wasClean: true })
  })

  it('ends cleanly on 1001 (going away)', async () => {
    const { engine, mock } = makeEngine()
    let closeDetail: CloseEventDetail | undefined
    engine.addEventListener('close', (e) => (closeDetail = e.detail))
    mock.emitOpen()
    const done = (async () => {
      for await (const _ of engine) {
        /* drain */
      }
    })()
    mock.emitClose(1001, 'bye', true)
    await done
    expect(closeDetail).toEqual({ code: 1001, reason: 'bye', wasClean: true })
  })

  it('drains buffered messages before ending on clean close', async () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    // Buffer three messages with no consumer pulling yet.
    mock.emitMessage('x', false)
    mock.emitMessage('y', false)
    mock.emitMessage('z', false)
    mock.emitClose(1000, '', true)
    const received: (string | Uint8Array)[] = []
    for await (const msg of engine) received.push(msg)
    expect(received).toEqual(['x', 'y', 'z'])
  })

  it('throws AbnormalCloseError on non-1000/1001 close (pending consumer)', async () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next()
    mock.emitClose(1011, 'server error', false)
    await expect(pending).rejects.toSatisfy((err) => {
      assert(err instanceof AbnormalCloseError)
      expect(err.code).toBe(1011)
      expect(err.reason).toBe('server error')
      return true
    })
  })

  it('delivers a stored error when no next() is pending', async () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    // Abnormal close with NO consumer waiting; error is stored.
    mock.emitClose(1006, 'reset', false)
    const it = engine[Symbol.asyncIterator]()
    await expect(it.next()).rejects.toSatisfy((err) => {
      assert(err instanceof AbnormalCloseError)
      expect(err.code).toBe(1006)
      expect(err.wasClean).toBe(false)
      return true
    })
  })

  it('delivers an error to a pending next()', async () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next() // pulls before any message
    mock.emitError(new Error('boom'))
    await expect(pending).rejects.toSatisfy((err) => {
      assert(err instanceof SocketError)
      expect((err.cause as Error).message).toBe('boom')
      return true
    })
  })

  it('discards buffered messages after a failure transition', async () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    mock.emitMessage('buffered', false) // buffered, no consumer
    mock.emitError(new Error('boom')) // failure discards buffer
    const it = engine[Symbol.asyncIterator]()
    await expect(it.next()).rejects.toBeInstanceOf(SocketError)
  })

  it('terminate() self-settles, drops buffered messages, and ignores a late transport echo', async () => {
    const { engine, mock } = makeEngine()
    let errorDetail: unknown
    engine.addEventListener('error', (e) => (errorDetail = e.detail.error))
    mock.emitOpen()
    mock.emitMessage('buffered', false) // buffered, no consumer parked
    engine.terminate()
    expect(mock.terminated).toBe(true)

    const it = engine[Symbol.asyncIterator]()
    await expect(it.next()).rejects.toSatisfy((err) => {
      assert(err instanceof SocketError) // terminate() rejects, never yields the buffered value
      return true
    })
    expect(errorDetail).toBeInstanceOf(SocketError)

    // Late async echo from the transport (e.g. browser ws.close() -> onClose)
    // must be a harmless no-op: no second settlement, no unhandled rejection.
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      mock.emitClose(1000, '', true)
      await new Promise((resolve) => setTimeout(resolve, 0))
      // Still terminal from terminate(), unaffected by the late echo.
      await expect(it.next()).rejects.toBeInstanceOf(SocketError)
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }
    expect(unhandled).toEqual([])
  })

  it('throws if iterated twice', () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    engine[Symbol.asyncIterator]()
    expect(() => engine[Symbol.asyncIterator]()).toThrow()
  })

  it('closes with 1000 when the consumer breaks early', async () => {
    const { engine, mock } = makeEngine({ mock: new MockTransport() })
    mock.emitOpen()
    mock.emitMessage('m', false) // consumer must receive one value before it can break
    for await (const _msg of engine) {
      break
    }
    expect(mock.closedWith).toEqual({ code: 1000, reason: undefined })
  })

  it('send rejects when not open', async () => {
    const { engine } = makeEngine()
    await expect(engine.send('x' as never)).rejects.toThrow('not open')
  })

  it('send resolves on transport flush', async () => {
    const { engine, mock } = makeEngine()
    // Lazy open: start a pull first so the transport opens.
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    const p = engine.send('hello' as never)
    expect(mock.sent).toHaveLength(1)
    expect(mock.sent[0].data).toBe('hello')
    mock.sent[0].onFlush() // flush
    await expect(p).resolves.toBeUndefined()
  })

  it('send rejects when transport reports a flush error', async () => {
    const { engine, mock } = makeEngine()
    // Lazy open: start a pull first so the transport opens.
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    const p = engine.send('hello' as never)
    mock.sent[0].onFlush(new Error('flush failed'))
    await expect(p).rejects.toThrow('flush failed')
  })

  it('aborts via signal', async () => {
    const ac = new AbortController()
    const { engine, mock } = makeEngine({
      mock: new MockTransport(),
      signal: ac.signal,
    } as never)
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next()
    ac.abort(new Error('user aborted'))
    await expect(pending).rejects.toThrow('user aborted')
    expect(mock.terminated).toBe(true)
  })

  it('does not leak an unhandled rejection when consumer breaks then connection fails', async () => {
    const { engine, mock } = makeEngine()

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      // Consumer receives one message then abandons iteration -> return() -> close(1000).
      // The for-await loop's first pull triggers lazy open; deliver open before
      // the message so the socket reaches 'open'.
      const pump = (async () => {
        for await (const _msg of engine) {
          break
        }
      })()
      mock.emitOpen()
      mock.emitMessage('one', false)
      await pump
      // The graceful close never completes cleanly; the connection fails.
      mock.emitError(new Error('dropped during close'))
      // Let any microtasks/rejections settle.
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }

    expect(unhandled).toEqual([])
  })
})

describe('WebSocketCoreEngine lifecycle + events', () => {
  it('does not open the transport until iteration begins', () => {
    const { engine, mock } = makeEngine()
    expect(engine.readyState).toBe('initialized')
    expect(mock.opened).toBe(false)
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    expect(mock.opened).toBe(true)
    expect(engine.readyState).toBe('connecting')
  })

  it('dispatches open once on open', async () => {
    const { engine, mock } = makeEngine()
    let opens = 0
    engine.addEventListener('open', () => opens++)
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    expect(opens).toBe(1)
    expect(engine.connected).toBe(true)
  })

  it('dispatches close with real code on clean 1000', async () => {
    const { engine, mock } = makeEngine()
    const closes: unknown[] = []
    engine.addEventListener('close', (e) => closes.push(e.detail))
    const done = (async () => {
      for await (const _ of engine) {
        /* drain */
      }
    })()
    mock.emitOpen()
    mock.emitClose(1000, 'bye', true)
    await done
    expect(closes).toEqual([{ code: 1000, reason: 'bye', wasClean: true }])
  })

  it('dispatches error then close (code 1006) on a codeless fatal error', async () => {
    const { engine, mock } = makeEngine()
    const order: string[] = []
    engine.addEventListener('error', (e) =>
      order.push(`error:${(e.detail.error as Error).constructor.name}`),
    )
    engine.addEventListener('close', (e) =>
      order.push(`close:${e.detail.code}:${e.detail.wasClean}`),
    )
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next()
    mock.emitOpen()
    mock.emitError(new Error('boom'))
    await expect(pending).rejects.toBeInstanceOf(SocketError)
    expect(order).toEqual(['error:SocketError', 'close:1006:false'])
  })

  it('dispatches close with the real abnormal code (not synthesized) on server close', async () => {
    const { engine, mock } = makeEngine()
    let detail: CloseEventDetail | undefined
    engine.addEventListener('close', (e) => (detail = e.detail))
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next()
    mock.emitOpen()
    mock.emitClose(1011, 'server error', false)
    await expect(pending).rejects.toBeInstanceOf(AbnormalCloseError)
    expect(detail).toEqual({ code: 1011, reason: 'server error', wasClean: false })
  })

  it('close() before iteration is a clean no-op with no events', async () => {
    const { engine, mock } = makeEngine()
    let events = 0
    engine.addEventListener('close', () => events++)
    engine.addEventListener('open', () => events++)
    await engine.close()
    expect(engine.readyState).toBe('closed')
    expect(mock.opened).toBe(false)
    expect(events).toBe(0)
  })
})
