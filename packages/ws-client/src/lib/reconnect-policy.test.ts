import { describe, expect, it } from 'vitest'
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
  it('escalates roughly exponentially from ~1s', () => {
    expect(backoffMs(0, 64_000)).toBeGreaterThan(400)
    expect(backoffMs(0, 64_000)).toBeLessThan(1600)
    expect(backoffMs(3, 64_000)).toBeGreaterThan(7000)
    expect(backoffMs(3, 64_000)).toBeLessThan(9000)
  })

  it('caps at maxMs', () => {
    expect(backoffMs(20, 5000)).toBe(5000)
  })
})
