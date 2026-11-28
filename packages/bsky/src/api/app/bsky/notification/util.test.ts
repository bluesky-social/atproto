import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { delayCursor } from './util.js'

describe('delayCursor', () => {
  const delay0s = 0
  const delay5s = 5_000

  const now = '2021-01-01T01:00:00.000Z'
  const nowMinus2s = '2021-01-01T00:59:58.000Z'
  const nowMinus5s = '2021-01-01T00:59:55.000Z'
  const nowMinus8s = '2021-01-01T00:59:52.000Z'

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
  })

  afterAll(async () => {
    vi.useRealTimers()
  })

  describe('for undefined cursor', () => {
    it('returns now minus delay', async () => {
      const delayedCursor = delayCursor(undefined, delay5s)
      expect(delayedCursor).toBe(nowMinus5s)
    })

    it('returns now if delay is 0', async () => {
      const delayedCursor = delayCursor(undefined, delay0s)
      expect(delayedCursor).toBe(now)
    })
  })

  describe('for defined cursor', () => {
    it('returns original cursor if delay is 0', async () => {
      const originalCursor = nowMinus2s
      const delayedCursor = delayCursor(originalCursor, delay0s)
      expect(delayedCursor).toBe(originalCursor)
    })

    it('returns "now minus delay" for cursor that is after that', async () => {
      // Cursor is "now - 2s", should become "now - 5s"
      const originalCursor = nowMinus2s
      const cursor = delayCursor(originalCursor, delay5s)
      expect(cursor).toBe(nowMinus5s)
    })

    it('returns original cursor for cursor that is before "now minus delay"', async () => {
      // Cursor is "now - 8s", should stay like that.
      const originalCursor = nowMinus8s
      const cursor = delayCursor(originalCursor, delay5s)
      expect(cursor).toBe(originalCursor)
    })

    it('passes through a non-date cursor', async () => {
      const originalCursor = '123_abc'
      const cursor = delayCursor(originalCursor, delay5s)
      expect(cursor).toBe(originalCursor)
    })
  })
})
