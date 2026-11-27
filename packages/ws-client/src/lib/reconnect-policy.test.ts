import { describe, expect, it, vi } from 'vitest'
import { CloseCode } from './close-codes.js'
import { CloseError, SocketError, WebSocketClientError } from './errors.js'
import { backoffMs, defaultShouldReconnect } from './reconnect-policy.js'

describe(defaultShouldReconnect, () => {
  it('reconnects on transient taxonomy errors', () => {
    expect(defaultShouldReconnect(new SocketError(new Error('x')))).toBe(true)
    expect(
      defaultShouldReconnect(new CloseError(CloseCode.GoingAway, '', true)),
    ).toBe(true)
  })

  it('does not reconnect on deliberate shutdown', () => {
    expect(
      defaultShouldReconnect(new CloseError(CloseCode.Normal, '', true)),
    ).toBe(false)
  })

  it('treats base-class and foreign errors as fatal', () => {
    // The base class covers state misuse, which is never retryable.
    expect(defaultShouldReconnect(new WebSocketClientError('misuse'))).toBe(
      false,
    )
    expect(defaultShouldReconnect(new Error('foreign'))).toBe(false)
    expect(defaultShouldReconnect('not an error')).toBe(false)
  })
})

describe(backoffMs, () => {
  it('escalates exponentially from 1s, jittered down to half', () => {
    for (let i = 0; i < 100; i++) {
      expect(backoffMs(0, 64_000)).toBeGreaterThanOrEqual(500)
      expect(backoffMs(0, 64_000)).toBeLessThan(1000)
      expect(backoffMs(3, 64_000)).toBeGreaterThanOrEqual(4000)
      expect(backoffMs(3, 64_000)).toBeLessThan(8000)
    }
  })

  it('never exceeds maxMs', () => {
    for (let i = 0; i < 100; i++) {
      expect(backoffMs(20, 5000)).toBeGreaterThanOrEqual(2500)
      expect(backoffMs(20, 5000)).toBeLessThanOrEqual(5000)
    }
    // Even once 2 ** attempt overflows
    expect(backoffMs(2000, 5000)).toBeLessThanOrEqual(5000)
  })

  it('keeps jittering once capped', () => {
    using _random = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
    expect(backoffMs(20, 5000)).toBe(2500)
    expect(backoffMs(20, 5000)).toBe(3750)
  })
})
