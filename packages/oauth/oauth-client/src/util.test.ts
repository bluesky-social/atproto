import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { timeoutSignal } from './util.js'

describe(timeoutSignal, () => {
  describe('with native AbortSignal.timeout', () => {
    it('delegates to the native implementation when available', () => {
      using spy = vi.spyOn(AbortSignal, 'timeout')

      const signal = timeoutSignal(1000)

      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith(1000)
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal.aborted).toBe(false)
    })

    it('returns a signal that actually aborts after the timeout', async () => {
      const signal = timeoutSignal(5)
      expect(signal.aborted).toBe(false)

      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(signal.aborted).toBe(true)
    })
  })

  describe('without native AbortSignal.timeout (e.g. React Native)', () => {
    let original: typeof AbortSignal.timeout

    beforeEach(() => {
      vi.useFakeTimers()
      original = AbortSignal.timeout
      // Simulate a runtime that does not implement the static method.
      // @ts-expect-error intentionally removing a built-in to emulate RN
      AbortSignal.timeout = undefined
    })

    afterEach(() => {
      AbortSignal.timeout = original
      vi.useRealTimers()
    })

    it('does not throw and returns a usable AbortSignal', () => {
      const signal = timeoutSignal(1000)
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal.aborted).toBe(false)
    })

    it('aborts the signal once the timeout elapses', () => {
      const signal = timeoutSignal(1000)
      const onAbort = vi.fn()
      signal.addEventListener('abort', onAbort)

      vi.advanceTimersByTime(999)
      expect(signal.aborted).toBe(false)
      expect(onAbort).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(signal.aborted).toBe(true)
      expect(onAbort).toHaveBeenCalledOnce()
    })

    it('aborts with a TimeoutError reason', () => {
      const signal = timeoutSignal(1000)
      vi.advanceTimersByTime(1000)

      expect(signal.reason).toBeInstanceOf(DOMException)
      expect(signal.reason.name).toBe('TimeoutError')
    })

    it('falls back to a plain Error when DOMException is unavailable', () => {
      using _ = vi
        .spyOn(globalThis, 'DOMException', 'get')
        // @ts-expect-error intentionally removing a built-in to emulate React Native
        .mockImplementation(() => undefined)

      const signal = timeoutSignal(1000)
      vi.advanceTimersByTime(1000)

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBeInstanceOf(Error)
    })
  })
})
