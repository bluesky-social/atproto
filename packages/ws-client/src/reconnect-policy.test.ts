import { describe, expect, it } from 'vitest'
import {
  AbnormalCloseError,
  BufferOverflowError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
} from './errors.js'
import {
  FATAL_CLOSE_CODES,
  backoffMs,
  defaultShouldReconnect,
  isReconnectableClose,
} from './reconnect-policy.js'

describe('FATAL_CLOSE_CODES', () => {
  it('is exactly the genuine-wire fatal set', () => {
    expect([...FATAL_CLOSE_CODES].sort((a, b) => a - b)).toEqual([
      1000, 1002, 1003, 1007, 1009,
    ])
  })
})

describe(isReconnectableClose, () => {
  it('treats synthetic codes as reconnectable (1005/1006/1015)', () => {
    expect(isReconnectableClose(1005)).toBe(true)
    expect(isReconnectableClose(1006)).toBe(true)
    expect(isReconnectableClose(1015)).toBe(true)
  })
  it('reconnects on 1001/1008/1011/4xxx', () => {
    for (const c of [1001, 1008, 1011, 1012, 1013, 4000, 4999]) {
      expect(isReconnectableClose(c)).toBe(true)
    }
  })
  it('is fatal on 1000/1002/1003/1007/1009', () => {
    for (const c of [1000, 1002, 1003, 1007, 1009]) {
      expect(isReconnectableClose(c)).toBe(false)
    }
  })
})

describe(defaultShouldReconnect, () => {
  it('reconnects on SocketError/heartbeat/idle', () => {
    expect(defaultShouldReconnect(new SocketError(new Error('x')))).toBe(true)
    expect(defaultShouldReconnect(new HeartbeatTimeoutError())).toBe(true)
    expect(defaultShouldReconnect(new IdleTimeoutError())).toBe(true)
  })
  it('is fatal on BufferOverflow/DataMode', () => {
    expect(defaultShouldReconnect(new BufferOverflowError(1))).toBe(false)
    expect(defaultShouldReconnect(new DataModeError('text', 'binary'))).toBe(
      false,
    )
  })
  it('classifies AbnormalCloseError by its code', () => {
    expect(
      defaultShouldReconnect(new AbnormalCloseError(1011, '', false)),
    ).toBe(true)
    expect(
      defaultShouldReconnect(new AbnormalCloseError(1008, '', false)),
    ).toBe(true)
    expect(
      defaultShouldReconnect(new AbnormalCloseError(1002, '', false)),
    ).toBe(false)
  })
  it('does not reconnect on an unknown/foreign error', () => {
    expect(defaultShouldReconnect(new Error('nope'))).toBe(false)
  })
})

describe(backoffMs, () => {
  it('is within 2^attempt seconds ± 500ms jitter, capped', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const ms = backoffMs(attempt, 64_000)
      const baseSec = Math.pow(2, attempt)
      const lo = 1000 * (baseSec - 0.5)
      const hi = 1000 * (baseSec + 0.5)
      expect(ms).toBeGreaterThanOrEqual(Math.min(lo, 64_000))
      expect(ms).toBeLessThanOrEqual(Math.min(hi, 64_000))
    }
  })
  it('caps at maxMs', () => {
    expect(backoffMs(20, 64_000)).toBe(64_000)
  })
})
