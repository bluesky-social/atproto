import { assert, describe, expect, it, vi } from 'vitest'
import { CloseCode } from './lib/close-codes.js'
import {
  BufferOverflowError,
  DataModeError,
  IdleTimeoutError,
} from './lib/errors.js'
import { createMessageChannel } from './message-channel.js'

describe(createMessageChannel, () => {
  describe('delivery', () => {
    it('yields a pushed message to a parked pull', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const iterator = channel.iterable[Symbol.asyncIterator]()
      const pending = iterator.next()
      channel.push('hello')
      await expect(pending).resolves.toEqual({ value: 'hello', done: false })
    })

    it('buffers messages pushed before any pull, in order', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      channel.push('one')
      channel.push('two')
      channel.push('three')
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
      const textIterator = textChannel.iterable[Symbol.asyncIterator]()
      const textResult = await textIterator.next()
      assert(!textResult.done)
      expect(typeof textResult.value).toBe('string')

      const binChannel = createMessageChannel({ dataMode: 'binary' })
      const bin = new Uint8Array([9, 8, 7])
      binChannel.push(bin)
      const binIterator = binChannel.iterable[Symbol.asyncIterator]()
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
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
        onPause,
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
        onPause,
        onResume,
      })
      channel.push('a'.repeat(6)) // 12 bytes: over highWaterMark (10)
      expect(onPause).toHaveBeenCalledTimes(1)
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
        onPause,
        onResume,
      })
      // Push two messages summing to 16 bytes (over 10).
      channel.push('a'.repeat(6)) // 12 bytes
      channel.push('a'.repeat(2)) // +4 = 16 bytes
      expect(onPause).toHaveBeenCalledTimes(1)
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
        onPause,
      })
      channel.push('a'.repeat(10)) // 20 bytes: over the mark
      expect(onPause).toHaveBeenCalledTimes(1)
      channel.push('a'.repeat(10)) // still paused: no repeat call
      expect(onPause).toHaveBeenCalledTimes(1)
    })

    it('tracks bytes without pausing when no hooks are supplied', async () => {
      // The browser case: buffering still works, backpressure simply isn't
      // available without onPause/onResume.
      const channel = createMessageChannel({
        dataMode: 'auto',
        highWaterMark: 10,
      })
      channel.push('a'.repeat(20)) // 40 bytes: well over the mark
      channel.push('more')
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
      // No pull is parked, so this buffers instead of delivering directly —
      // 20 bytes against a 10-byte cap overflows.
      channel.push('a'.repeat(10))
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
        onPause,
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
        const iterator = channel.iterable[Symbol.asyncIterator]()
        // Attach the rejection assertion synchronously so the rejection
        // (which fires mid-tick, before this test resumes) is never
        // observed as unhandled.
        const pending = expect(iterator.next()).rejects.toBeInstanceOf(
          IdleTimeoutError,
        )
        // Detection latency is 1x-2x idleTimeoutMs: the first tick merely
        // clears the flag (idleActive starts true), the second tick finds
        // no evidence since and times out.
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
          onPause,
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

    it('does not start a timer when idleTimeoutMs is absent', async () => {
      vi.useFakeTimers()
      try {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
        const setIntervalSpy = vi.spyOn(global, 'setInterval')
        const channel = createMessageChannel({ dataMode: 'auto' })
        expect(setIntervalSpy).not.toHaveBeenCalled()
        channel.finish({ code: 1000, reason: '', wasClean: true })
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
      channel.finish({ code: 1000, reason: 'bye', wasClean: true })
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
      const iterator = channel.iterable[Symbol.asyncIterator]()
      await expect(iterator.next()).rejects.toBe(boom)
    })

    it('rejects a parked pull on fail', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const iterator = channel.iterable[Symbol.asyncIterator]()
      const pending = iterator.next()
      const boom = new Error('boom')
      channel.fail(boom)
      await expect(pending).rejects.toBe(boom)
    })

    it('synthesizes 1006 as closeDetail for a frame-less failure', () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      channel.fail(new Error('boom'))
      expect(channel.closeDetail).toEqual({
        code: CloseCode.Abnormal,
        reason: '',
        wasClean: false,
      })
    })

    it('records the supplied detail as closeDetail on finish', () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const detail = { code: 1000, reason: 'done', wasClean: true }
      channel.finish(detail)
      expect(channel.closeDetail).toEqual(detail)
    })

    it('ignores a second terminal transition', async () => {
      const channel = createMessageChannel({ dataMode: 'auto' })
      const firstDetail = { code: 1000, reason: 'first', wasClean: true }
      channel.finish(firstDetail)
      channel.finish({ code: 1001, reason: 'second', wasClean: true })
      expect(channel.closeDetail).toEqual(firstDetail)

      const channel2 = createMessageChannel({ dataMode: 'auto' })
      const err1 = new Error('first')
      const err2 = new Error('second')
      channel2.fail(err1)
      channel2.fail(err2)
      const iterator = channel2.iterable[Symbol.asyncIterator]()
      await expect(iterator.next()).rejects.toBe(err1)
    })

    it('discards the buffer and asks for a 1000 close when the consumer returns', async () => {
      const onAbort = vi.fn()
      const channel = createMessageChannel({ dataMode: 'auto', onAbort })
      channel.push('one')
      channel.push('two')
      const iterator = channel.iterable[Symbol.asyncIterator]()
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
      channel.finish({ code: 1000, reason: '', wasClean: true })
      channel.push('too-late')
      const iterator = channel.iterable[Symbol.asyncIterator]()
      await expect(iterator.next()).resolves.toEqual({
        value: undefined,
        done: true,
      })
    })
  })
})
