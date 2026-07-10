import { assert, describe, expect, it } from 'vitest'
import { AbnormalCloseError, SocketError } from '../src/errors.js'
import { WebSocketCoreEngine } from '../src/core.js'
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
  it('starts in connecting and exposes capabilities', () => {
    const { engine, mock } = makeEngine()
    expect(engine.readyState).toBe('connecting')
    expect(engine.capabilities).toEqual(mock.capabilities)
    expect(engine.protocol).toBe('')
  })

  it('resolves opened and reports protocol on open', async () => {
    const mock = new MockTransport({ protocol: 'jetstream' })
    const { engine } = makeEngine({ mock })
    mock.emitOpen()
    await expect(engine.opened).resolves.toBeUndefined()
    expect(engine.readyState).toBe('open')
    expect(engine.protocol).toBe('jetstream')
  })

  it('yields messages in order, then ends cleanly on 1000', async () => {
    const { engine, mock } = makeEngine()
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
    await expect(engine.closed).resolves.toEqual({ code: 1000, reason: '' })
  })

  it('ends cleanly on 1001 (going away)', async () => {
    const { engine, mock } = makeEngine()
    mock.emitOpen()
    const done = (async () => {
      for await (const _ of engine) {
        /* drain */
      }
    })()
    mock.emitClose(1001, 'bye', true)
    await done
    await expect(engine.closed).resolves.toEqual({ code: 1001, reason: 'bye' })
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
    mock.emitOpen()
    mock.emitMessage('buffered', false) // buffered, no consumer parked
    engine.terminate()
    expect(mock.terminated).toBe(true)

    const it = engine[Symbol.asyncIterator]()
    await expect(it.next()).rejects.toSatisfy((err) => {
      assert(err instanceof SocketError) // terminate() rejects, never yields the buffered value
      return true
    })
    await expect(engine.closed).rejects.toBeInstanceOf(SocketError)

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
    mock.emitOpen()
    const p = engine.send('hello' as never)
    expect(mock.sent).toHaveLength(1)
    expect(mock.sent[0].data).toBe('hello')
    mock.sent[0].onFlush() // flush
    await expect(p).resolves.toBeUndefined()
  })

  it('send rejects when transport reports a flush error', async () => {
    const { engine, mock } = makeEngine()
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
    mock.emitOpen()

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      // Consumer receives one message then abandons iteration -> return() -> close(1000).
      mock.emitMessage('one', false)
      for await (const _msg of engine) {
        break
      }
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
