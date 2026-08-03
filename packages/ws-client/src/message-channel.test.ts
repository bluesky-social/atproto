import { assert, describe, expect, it, vi } from 'vitest'
import { CloseCode } from './lib/close-codes.js'
import {
  BufferOverflowError,
  DataModeError,
  IdleTimeoutError,
} from './lib/errors.js'
import { closeGuard, createMessageChannel } from './message-channel.js'

describe(createMessageChannel, () => {
  describe('delivery', () => {
    it('yields a pushed message to a parked pull', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const iterator = channel.iterator
      const pending = iterator.next()
      channel.push('hello')
      await expect(pending).resolves.toEqual({ value: 'hello', done: false })
    })

    it('buffers messages pushed before any pull, in order', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      channel.push('one')
      channel.push('two')
      channel.push('three')
      const iterator = channel.iterator
      await expect(iterator.next()).resolves.toEqual({
        value: 'one',
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: 'two',
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: 'three',
        done: false,
      })
    })

    it('yields both frame types when dataMode is auto', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const bin = new Uint8Array([1, 2, 3])
      channel.push('text-frame')
      channel.push(bin)
      const iterator = channel.iterator
      await expect(iterator.next()).resolves.toEqual({
        value: 'text-frame',
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: bin,
        done: false,
      })
    })

    it('yields string for text mode and Uint8Array for binary mode', async () => {
      const textChannel = createMessageChannel({ dataMode: 'text' })
      textChannel.push('hi')
      const textIterator = textChannel.iterator
      const textResult = await textIterator.next()
      assert(!textResult.done)
      expect(typeof textResult.value).toBe('string')

      const binChannel = createMessageChannel({ dataMode: 'binary' })
      const bin = new Uint8Array([9, 8, 7])
      binChannel.push(bin)
      const binIterator = binChannel.iterator
      const binResult = await binIterator.next()
      assert(!binResult.done)
      expect(binResult.value).toBeInstanceOf(Uint8Array)
      expect(binResult.value).toEqual(bin)
    })
  })

  describe('dataMode enforcement', () => {
    it('fails a binary frame in text mode, asking for a 1003 close', async () => {
      const onAbort = vi.fn()
      const channel = createMessageChannel({ dataMode: 'text', onAbort })
      const iterator = channel.iterator
      const pending = iterator.next()
      channel.push(new Uint8Array([1, 2, 3]))
      await expect(pending).rejects.toSatisfy((err: unknown) => {
        assert(err instanceof DataModeError)
        expect(err.expected).toBe('text')
        expect(err.received).toBe('binary')
        return true
      })
      expect(onAbort).toHaveBeenCalledTimes(1)
      const [error, code] = onAbort.mock.calls[0]
      assert(error instanceof DataModeError)
      expect(code).toBe(CloseCode.UnsupportedData)
    })

    it('fails a text frame in binary mode', async () => {
      const onAbort = vi.fn()
      const channel = createMessageChannel({ dataMode: 'binary', onAbort })
      const iterator = channel.iterator
      const pending = iterator.next()
      channel.push('surprise')
      await expect(pending).rejects.toSatisfy((err: unknown) => {
        assert(err instanceof DataModeError)
        expect(err.expected).toBe('binary')
        expect(err.received).toBe('text')
        return true
      })
      expect(onAbort).toHaveBeenCalledWith(
        expect.any(DataModeError),
        CloseCode.UnsupportedData,
      )
    })
  })

  describe('flow control', () => {
    it('pauses once buffered bytes pass highWaterMark', () => {
      const onPause = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 10,
        backpressure: { onPause, onResume: () => {} },
      })
      channel.push('a'.repeat(4)) // 8 bytes, under the mark
      expect(onPause).not.toHaveBeenCalled()
      channel.push('a'.repeat(4)) // +8 = 16 bytes, over the mark
      expect(onPause).toHaveBeenCalledTimes(1)
    })

    it('resumes only once buffered bytes fall below half the mark', async () => {
      const onPause = vi.fn()
      const onResume = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 10,
        backpressure: { onPause, onResume },
      })
      channel.push('a'.repeat(6)) // 12 bytes: over highWaterMark (10)
      expect(onPause).toHaveBeenCalledTimes(1)
      const iterator = channel.iterator
      // Draining down to 12 - 12 = 0 bytes is below half (5), so resume fires.
      await iterator.next()
      expect(onResume).toHaveBeenCalledTimes(1)
    })

    it('does not resume while still above half the mark', async () => {
      const onPause = vi.fn()
      const onResume = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 10,
        backpressure: { onPause, onResume },
      })
      // Push two messages summing to 16 bytes (over 10).
      channel.push('a'.repeat(6)) // 12 bytes
      channel.push('a'.repeat(2)) // +4 = 16 bytes
      expect(onPause).toHaveBeenCalledTimes(1)
      const iterator = channel.iterator
      // Drain the first message: 16 - 12 = 4 bytes remain, below half (5) —
      // resume fires here, so push a third message to keep it above half.
      channel.push('a'.repeat(6)) // +12 = 16 bytes again before draining
      await iterator.next() // drains 12 bytes -> 4 bytes remain
      expect(onResume).not.toHaveBeenCalled()
    })

    it('does not pause repeatedly while already paused', () => {
      const onPause = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 10,
        backpressure: { onPause, onResume: () => {} },
      })
      channel.push('a'.repeat(10)) // 20 bytes: over the mark
      expect(onPause).toHaveBeenCalledTimes(1)
      channel.push('a'.repeat(10)) // still paused: no repeat call
      expect(onPause).toHaveBeenCalledTimes(1)
    })

    it('tracks bytes without pausing when no hooks are supplied', async () => {
      // The browser case: buffering still works, backpressure just isn't available
      // without onPause/onResume.
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 10,
      })
      channel.push('a'.repeat(20)) // 40 bytes: well over the mark
      channel.push('more')
      const iterator = channel.iterator
      await expect(iterator.next()).resolves.toEqual({
        value: 'a'.repeat(20),
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: 'more',
        done: false,
      })
    })

    it('fails with BufferOverflowError past maxBufferedBytes', async () => {
      const onAbort = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        maxBufferedBytes: 10,
        onAbort,
      })
      // No pull is parked, so this buffers rather than delivering directly: 20
      // bytes against a 10-byte cap overflows.
      channel.push('a'.repeat(10))
      const iterator = channel.iterator
      await expect(iterator.next()).rejects.toBeInstanceOf(BufferOverflowError)
      expect(onAbort).toHaveBeenCalledTimes(1)
      const [error, code] = onAbort.mock.calls[0]
      assert(error instanceof BufferOverflowError)
      expect(code).toBeUndefined()
    })

    it('checks the hard cap before the watermark', () => {
      // A single push that exceeds both must overflow, not merely pause.
      const onPause = vi.fn()
      const onAbort = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 5,
        maxBufferedBytes: 10,
        backpressure: { onPause, onResume: () => {} },
        onAbort,
      })
      channel.push('a'.repeat(10)) // 20 bytes: over both thresholds
      expect(onPause).not.toHaveBeenCalled()
      expect(onAbort).toHaveBeenCalledTimes(1)
      const [error] = onAbort.mock.calls[0]
      assert(error instanceof BufferOverflowError)
    })

    it('counts string bytes as length * 2 and binary as byteLength', () => {
      const onAbort = vi.fn()
      const channel = createMessageChannel({
        dataMode: 'auto',
        maxBufferedBytes: 20,
        onAbort,
      })
      // 9 chars * 2 = 18 bytes: under the 20-byte cap.
      channel.push('123456789')
      expect(onAbort).not.toHaveBeenCalled()
      // +3 byteLength = 21 bytes: over the cap.
      channel.push(new Uint8Array([1, 2, 3]))
      expect(onAbort).toHaveBeenCalledTimes(1)
      const [error] = onAbort.mock.calls[0]
      assert(error instanceof BufferOverflowError)
      expect(error.bufferedBytes).toBe(21)
    })
  })

  describe('idle timeout', () => {
    it('fails when no message arrives within the window', async () => {
      vi.useFakeTimers()
      try {
        const onAbort = vi.fn()
        const channel = createMessageChannel({
          dataMode: 'auto',
          idleTimeoutMs: 1000,
          onAbort,
        })
        const iterator = channel.iterator
        // Attach the assertion synchronously: the rejection fires mid-tick, before
        // this test resumes, and would otherwise look unhandled.
        const pending = expect(iterator.next()).rejects.toBeInstanceOf(
          IdleTimeoutError,
        )
        // Detection latency is 1x-2x idleTimeoutMs: the first tick only clears the
        // flag (idleActive starts true), and the second finds no evidence since.
        await vi.advanceTimersByTimeAsync(1000)
        await vi.advanceTimersByTimeAsync(1000)
        await pending
        expect(onAbort).toHaveBeenCalledTimes(1)
        const [error, code] = onAbort.mock.calls[0]
        assert(error instanceof IdleTimeoutError)
        expect(code).toBeUndefined()
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not fail while messages keep arriving', async () => {
      vi.useFakeTimers()
      try {
        const onAbort = vi.fn()
        const channel = createMessageChannel({
          dataMode: 'auto',
          idleTimeoutMs: 1000,
          onAbort,
        })
        for (let i = 0; i < 5; i++) {
          await vi.advanceTimersByTimeAsync(1000)
          channel.push(`msg-${i}`)
        }
        expect(onAbort).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not fail while paused for backpressure', async () => {
      vi.useFakeTimers()
      try {
        const onAbort = vi.fn()
        const onPause = vi.fn()
        const channel = createMessageChannel({
          dataMode: 'auto',
          idleTimeoutMs: 1000,
          highWaterMark: 5,
          backpressure: { onPause, onResume: () => {} },
          onAbort,
        })
        channel.push('a'.repeat(10)) // over the watermark: paused
        expect(onPause).toHaveBeenCalledTimes(1)
        // Many ticks pass with the channel paused and no new messages.
        await vi.advanceTimersByTimeAsync(10_000)
        expect(onAbort).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('times out with a full buffer when the platform cannot pause', async () => {
      // The browser passes no `backpressure`, so `idleTimeoutMs` is its only
      // dead-connection detector. If a merely-full buffer read as a pause, the
      // liveness exemption above would latch and suppress the timeout, and a
      // browser consumer running slightly behind would never notice a dead peer.
      vi.useFakeTimers()
      try {
        const onAbort = vi.fn()
        const channel = createMessageChannel({
          dataMode: 'auto',
          highWaterMark: 10,
          idleTimeoutMs: 20,
          onAbort,
          // No `backpressure`: the browser shape.
        })
        const iterator = channel.iterator
        // Leave the buffer between the low mark (5) and the high mark (10), where
        // the pause flag used to latch.
        channel.push('a'.repeat(6)) // 12 bytes
        channel.push('b'.repeat(4)) // +8 = 20 bytes
        await iterator.next() // drain 12 -> 8 bytes remain

        // The peer is dead: nothing more arrives.
        vi.advanceTimersByTime(20 * 15)
        expect(onAbort).toHaveBeenCalledWith(expect.any(IdleTimeoutError))
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not start a timer when idleTimeoutMs is absent', async () => {
      vi.useFakeTimers()
      try {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
        const setIntervalSpy = vi.spyOn(global, 'setInterval')
        const channel = createMessageChannel({ dataMode: 'auto' })
        expect(setIntervalSpy).not.toHaveBeenCalled()
        channel.finish()
        expect(clearIntervalSpy).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('termination', () => {
    it('drains buffered messages after finish, then reports done', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      channel.push('one')
      channel.push('two')
      channel.finish()
      const iterator = channel.iterator
      await expect(iterator.next()).resolves.toEqual({
        value: 'one',
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: 'two',
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: undefined,
        done: true,
      })
    })

    it('discards buffered messages on fail and rejects the next pull', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      channel.push('one')
      channel.push('two')
      const boom = new Error('boom')
      channel.fail(boom)
      const iterator = channel.iterator
      await expect(iterator.next()).rejects.toBe(boom)
    })

    it('rejects a parked pull on fail', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const iterator = channel.iterator
      const pending = iterator.next()
      const boom = new Error('boom')
      channel.fail(boom)
      await expect(pending).rejects.toBe(boom)
    })

    it('ignores a second terminal transition', async () => {
      // First-wins: the consumer sees whichever terminal landed first, and a later
      // one can't overwrite or re-settle it.
      const failed = createMessageChannel({ dataMode: 'auto' })
      const first = new Error('first')
      failed.fail(first)
      failed.fail(new Error('second'))
      await expect(failed.iterator.next()).rejects.toBe(first)

      // A finish after a failure likewise cannot turn it into a clean end.
      const failedThenFinished = createMessageChannel({ dataMode: 'auto' })
      failedThenFinished.fail(first)
      failedThenFinished.finish()
      await expect(failedThenFinished.iterator.next()).rejects.toBe(first)

      // And a failure after a clean finish can't turn it into a rejection: the
      // buffered message drains, then the stream ends.
      const finished = createMessageChannel({ dataMode: 'auto' })
      finished.push('buffered')
      finished.finish()
      finished.fail(new Error('too late'))
      const iterator = finished.iterator
      await expect(iterator.next()).resolves.toEqual({
        value: 'buffered',
        done: false,
      })
      await expect(iterator.next()).resolves.toEqual({
        value: undefined,
        done: true,
      })
    })

    it('discards the buffer and asks for a 1000 close when the consumer returns', async () => {
      const onAbort = vi.fn()
      const channel = createMessageChannel({ dataMode: 'auto', onAbort })
      channel.push('one')
      channel.push('two')
      const iterator = channel.iterator
      assert(iterator.return)
      await iterator.return()
      expect(onAbort).toHaveBeenCalledWith(undefined, CloseCode.Normal)
      // The buffer was discarded: a fresh pull reports done, not 'one'.
      await expect(iterator.next()).resolves.toEqual({
        value: undefined,
        done: true,
      })
    })

    it('drops messages pushed after a terminal', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      channel.finish()
      channel.push('too-late')
      const iterator = channel.iterator
      await expect(iterator.next()).resolves.toEqual({
        value: undefined,
        done: true,
      })
    })
  })
})

describe(closeGuard, () => {
  // The guard holds a terminal on a pending promise, not a timer, so letting one
  // macrotask turn elapse is enough to tell "held" from "settled".
  async function isPending(promise: Promise<unknown>): Promise<boolean> {
    let settled = false
    const mark = () => {
      settled = true
    }
    promise.then(mark, mark)
    await new Promise((resolve) => setTimeout(resolve, 0))
    return !settled
  }

  // An inner iterator that ends however the test asks, plus a `returned` flag so
  // cleanup can be asserted. `throw` is left off deliberately — the guard's
  // fallback to `return()` is documented behavior.
  function source<T>(
    values: T[],
    end: { type: 'done' } | { type: 'error'; error: unknown } = {
      type: 'done',
    },
  ) {
    let returned = false
    const iterator: AsyncIterator<T, void, unknown> = {
      async next() {
        if (values.length) return { value: values.shift()!, done: false }
        if (end.type === 'error') throw end.error
        return { value: undefined, done: true }
      },
      async return() {
        returned = true
        return { value: undefined, done: true }
      },
    }
    return { iterator, returned: () => returned }
  }

  it('noops when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const { iterator } = source(['one'])
    const guarded = closeGuard(iterator, controller.signal)
    expect(guarded).toBe(iterator)
  })

  it('yields messages without waiting for the signal', async () => {
    const controller = new AbortController()
    const guarded = closeGuard(source(['one']).iterator, controller.signal)
    await expect(guarded.next()).resolves.toEqual({ value: 'one', done: false })
  })

  it('holds `done` until the signal aborts', async () => {
    const controller = new AbortController()
    const guarded = closeGuard(source([]).iterator, controller.signal)
    const pending = guarded.next()
    expect(await isPending(pending)).toBe(true)
    controller.abort()
    await expect(pending).resolves.toEqual({ value: undefined, done: true })
  })

  it('holds a rejection until the signal aborts, then rethrows it', async () => {
    const controller = new AbortController()
    const boom = new Error('boom')
    const guarded = closeGuard(
      source([], { type: 'error', error: boom }).iterator,
      controller.signal,
    )
    const pending = guarded.next()
    expect(await isPending(pending)).toBe(true)
    controller.abort()
    await expect(pending).rejects.toBe(boom)
  })

  it('returns the inner iterator, then holds done until the signal aborts', async () => {
    const controller = new AbortController()
    const inner = source(['unread'])
    const guarded = closeGuard(inner.iterator, controller.signal)
    assert(guarded.return)
    const pending = guarded.return()
    expect(await isPending(pending)).toBe(true)
    // Cleanup ran eagerly; only the reported end waits on the signal.
    expect(inner.returned()).toBe(true)
    controller.abort()
    await expect(pending).resolves.toEqual({ value: undefined, done: true })
  })

  it('forwards a return() the inner iterator declines', async () => {
    // An iterator may yield from a `finally` to refuse closing, and that
    // refusal is the inner iterator's to make.
    const controller = new AbortController()
    async function* gen(i = 0): AsyncGenerator<number, void, unknown> {
      try {
        yield i++
      } finally {
        yield i++
      }
    }
    const inner = gen()
    await inner.next()
    const guarded = closeGuard(inner, controller.signal)
    assert(guarded.return)
    await expect(guarded.return()).resolves.toEqual({
      value: 1,
      done: false,
    })
  })

  it('closes the inner iterator on throw() when it has no throw()', async () => {
    const controller = new AbortController()
    const inner = source(['unread'])
    assert(inner.iterator.throw === undefined)
    const guarded = closeGuard(inner.iterator, controller.signal)
    assert(guarded.throw)
    const boom = new Error('boom')
    const pending = guarded.throw(boom)
    expect(await isPending(pending)).toBe(true)
    // Cleanup ran eagerly; only the reported end waits on the signal.
    expect(inner.returned()).toBe(true)
    controller.abort()
    await expect(pending).rejects.toBe(boom)
  })

  it("prefers a failing return() over the caller's error on throw()", async () => {
    // A cleanup failure is new information, whereas the caller's error is
    // something they just handed us and still hold.
    const controller = new AbortController()
    const cleanupError = new Error('cleanup failed')
    const inner: AsyncIterator<string, void, unknown> = {
      async next() {
        return { value: 'a', done: false }
      },
      async return() {
        throw cleanupError
      },
    }
    const guarded = closeGuard(inner, controller.signal)
    assert(guarded.throw)
    const pending = guarded.throw(new Error('boom'))
    expect(await isPending(pending)).toBe(true)
    controller.abort()
    await expect(pending).rejects.toBe(cleanupError)
  })

  it('terminates a guarded message channel on throw()', async () => {
    // The channel iterator has no throw() of its own, so the guard's return()
    // fallback is what triggers termination — in real use, what tells the
    // transport to send a close frame.
    const controller = new AbortController()
    const onAbort = vi.fn()
    const channel = createMessageChannel({ dataMode: 'auto', onAbort })
    const guarded = closeGuard(channel.iterator, controller.signal)
    assert(guarded.throw)
    const boom = new Error('boom')
    const pending = guarded.throw(boom)
    expect(await isPending(pending)).toBe(true)
    expect(onAbort).toHaveBeenCalledWith(undefined, CloseCode.Normal)
    controller.abort()
    await expect(pending).rejects.toBe(boom)
  })

  it('treats a missing return() as a clean close', async () => {
    const controller = new AbortController()
    const inner: AsyncIterator<string, void, unknown> = {
      async next() {
        return { value: 'a', done: false }
      },
    }
    const guarded = closeGuard(inner, controller.signal)
    assert(guarded.return)
    const pending = guarded.return()
    expect(await isPending(pending)).toBe(true)
    controller.abort()
    await expect(pending).resolves.toEqual({ value: undefined, done: true })
  })

  describe('delegation with yield*', () => {
    // `closeGuard` hands back a bare iterator, so wrap it the way both transports
    // expose theirs — `[Symbol.asyncIterator]: () => iterator` — to hand the
    // engine something it will delegate to.
    const asIterable = <T>(
      iterator: AsyncIterator<T, void, unknown>,
    ): AsyncIterable<T> => ({ [Symbol.asyncIterator]: () => iterator })

    it('forwards values, then holds the end of delegation until the signal aborts', async () => {
      const controller = new AbortController()
      const guarded = closeGuard(
        source(['one', 'two']).iterator,
        controller.signal,
      )
      async function* delegating() {
        yield* asIterable(guarded)
        yield 'after'
      }
      const outer = delegating()
      await expect(outer.next()).resolves.toEqual({
        value: 'one',
        done: false,
      })
      await expect(outer.next()).resolves.toEqual({
        value: 'two',
        done: false,
      })
      // The inner iterator is exhausted, so `yield*` is ending — and the engine
      // can't resume the outer generator until the guard releases that `done`.
      const pending = outer.next()
      expect(await isPending(pending)).toBe(true)
      controller.abort()
      await expect(pending).resolves.toEqual({ value: 'after', done: false })
    })

    it('holds a `for await` body that exits via break', async () => {
      // The idiomatic consumer shape, and the reason the guard exists: `break`
      // makes the engine call `return()`, so the loop cannot be left until the
      // close has completed.
      const controller = new AbortController()
      const inner = source(['one', 'two'])
      const guarded = closeGuard(inner.iterator, controller.signal)
      const seen: string[] = []
      const loop = (async () => {
        for await (const value of asIterable(guarded)) {
          seen.push(value)
          break
        }
      })()
      expect(await isPending(loop)).toBe(true)
      expect(seen).toEqual(['one'])
      controller.abort()
      await loop
      expect(inner.returned()).toBe(true)
    })

    it('propagates a refusal to terminate, then gates the eventual close', async () => {
      // A generator that yields from its `finally` declines to close. The guard
      // forwards that verbatim, so the engine keeps the delegation alive — and
      // only once the generator really does end does the gate apply.
      const controller = new AbortController()
      async function* stubborn(): AsyncGenerator<string, void, unknown> {
        try {
          yield 'live'
        } finally {
          yield 'cleanup'
        }
      }
      const guarded = closeGuard(stubborn(), controller.signal)
      async function* delegating() {
        yield* asIterable(guarded)
      }
      const outer = delegating()
      await expect(outer.next()).resolves.toEqual({
        value: 'live',
        done: false,
      })
      // The refusal reaches the caller as a live value, ungated: waiting here
      // would deadlock on a close that this unfinished iteration is holding up.
      await expect(outer.return()).resolves.toEqual({
        value: 'cleanup',
        done: false,
      })
      // Asking again lets the `finally` run out, which is a real terminal.
      const pending = outer.return()
      expect(await isPending(pending)).toBe(true)
      controller.abort()
      await pending
    })

    it('gives `yield*` the throw() it demands, even when the inner iterator has none', async () => {
      // Delegating straight to a throw-less iterator makes the engine raise a
      // TypeError and discard the caller's error. The guard always defines
      // `throw()`, so that hole is closed and the caller's error survives.
      const controller = new AbortController()
      const inner = source(['one'])
      assert(inner.iterator.throw === undefined)
      const guarded = closeGuard(inner.iterator, controller.signal)
      async function* delegating() {
        yield* asIterable(guarded)
      }
      const outer = delegating()
      await outer.next()
      const boom = new Error('boom')
      const pending = outer.throw(boom)
      expect(await isPending(pending)).toBe(true)
      controller.abort()
      await expect(pending).rejects.toBe(boom)
    })

    it('ends delegation on throw() even when the inner iterator recovers', async () => {
      // The guard treats `throw()` as terminal by choice: an inner iterator that
      // answers `done: false` to keep going is overruled, where bare `yield*`
      // would have resumed the delegation.
      const controller = new AbortController()
      async function* recovering(
        onError?: (err: unknown) => void,
      ): AsyncGenerator<string, void, unknown> {
        while (true) {
          try {
            yield 'live'
          } catch (err) {
            // Swallows an continue iterating
            onError?.(err)
          }
        }
      }

      {
        using onError = vi.fn()
        const control = recovering(onError)
        await expect(control.next()).resolves.toEqual({
          value: 'live',
          done: false,
        })
        const error = new Error('boom')
        await control.throw(error)
        expect(onError).toHaveBeenLastCalledWith(error)
        await expect(control.next()).resolves.toEqual({
          value: 'live',
          done: false,
        })
        await expect(control.next()).resolves.toEqual({
          value: 'live',
          done: false,
        })
        await control.return()
      }

      const guarded = closeGuard(recovering(), controller.signal)
      async function* delegating() {
        yield* asIterable(guarded)
      }
      const outer = delegating()
      await outer.next()
      const boom = new Error('boom')
      const pending = outer.throw(boom)
      expect(await isPending(pending)).toBe(true)
      controller.abort()
      await expect(pending).rejects.toBe(boom)
    })
  })
})
