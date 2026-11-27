import { describe, expect, it } from 'vitest'
import { isCausedBySignal } from './abort.js'

describe(isCausedBySignal, () => {
  it('returns false when the signal is missing or not aborted', () => {
    const err = new Error('boom')
    expect(isCausedBySignal(err)).toBe(false)
    expect(isCausedBySignal(err, new AbortController().signal)).toBe(false)
  })

  it.each(['disconnected', { code: 'ECONNRESET' }, new Error('disconnected')])(
    'matches the abort reason itself (%j)',
    (reason) => {
      expect(isCausedBySignal(reason, AbortSignal.abort(reason))).toBe(true)
    },
  )

  it('matches the abort reason anywhere in the cause chain', () => {
    const reason = new Error('disconnected')
    const err = new Error('outer', {
      cause: new Error('inner', { cause: reason }),
    })
    expect(isCausedBySignal(err, AbortSignal.abort(reason))).toBe(true)
  })

  it('ignores a null abort reason', () => {
    const signal = AbortSignal.abort(null)
    expect(isCausedBySignal(null, signal)).toBe(false)
    expect(isCausedBySignal(new Error('boom', { cause: null }), signal)).toBe(
      false,
    )
  })

  it('returns false for unrelated errors', () => {
    const signal = AbortSignal.abort(new Error('disconnected'))
    expect(isCausedBySignal(new Error('boom'), signal)).toBe(false)
  })
})
