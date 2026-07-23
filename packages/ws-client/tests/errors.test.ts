import { describe, expect, it } from 'vitest'
import {
  BufferOverflowError,
  CloseError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketClientError,
  WebSocketConnectionError,
} from '../src/lib/errors.js'

describe('WebSocketConnection errors', () => {
  it('all extend WebSocketConnectionError and Error', () => {
    const errs = [
      new CloseError(1011, 'boom', false),
      new SocketError(new Error('cause')),
      new HeartbeatTimeoutError(),
      new IdleTimeoutError(),
      new BufferOverflowError(2048),
      new DataModeError('text', 'binary'),
    ]
    for (const e of errs) {
      expect(e).toBeInstanceOf(WebSocketConnectionError)
      expect(e).toBeInstanceOf(Error)
    }
  })

  it('CloseError carries code/reason/wasClean', () => {
    const e = new CloseError(1011, 'server error', false)
    expect(e.code).toBe(1011)
    expect(e.reason).toBe('server error')
    expect(e.wasClean).toBe(false)
  })

  it('SocketError carries cause', () => {
    const cause = new Error('econnreset')
    const e = new SocketError(cause)
    expect(e.cause).toBe(cause)
  })

  it('BufferOverflowError carries bufferedBytes', () => {
    expect(new BufferOverflowError(4096).bufferedBytes).toBe(4096)
  })

  it('DataModeError carries expected/received', () => {
    const e = new DataModeError('binary', 'text')
    expect(e.expected).toBe('binary')
    expect(e.received).toBe('text')
  })

  it('error names match class names', () => {
    expect(new HeartbeatTimeoutError().name).toBe('HeartbeatTimeoutError')
    expect(new IdleTimeoutError().name).toBe('IdleTimeoutError')
  })

  describe('shouldRetry()', () => {
    it('transient failures retry', () => {
      expect(new SocketError(new Error('econnreset')).shouldRetry()).toBe(true)
      expect(new HeartbeatTimeoutError().shouldRetry()).toBe(true)
      expect(new IdleTimeoutError().shouldRetry()).toBe(true)
    })

    it('local resource/protocol misuse does not retry', () => {
      expect(new BufferOverflowError(2048).shouldRetry()).toBe(false)
      expect(new DataModeError('text', 'binary').shouldRetry()).toBe(false)
      // Base-class errors (state misuse, e.g. send while not open) are fatal.
      expect(new WebSocketConnectionError('not open').shouldRetry()).toBe(false)
    })

    it('CloseError classifies by close code', () => {
      // Deliberate peer shutdown / malformed-protocol closes: fatal.
      expect(new CloseError(1000, '', true).shouldRetry()).toBe(false)
      expect(new CloseError(1002, '', false).shouldRetry()).toBe(false)
      expect(new CloseError(1003, '', false).shouldRetry()).toBe(false)
      expect(new CloseError(1007, '', false).shouldRetry()).toBe(false)
      expect(new CloseError(1009, '', false).shouldRetry()).toBe(false)
      // Going-away, abnormal, no-status, server-error closes: retry.
      expect(new CloseError(1001, '', true).shouldRetry()).toBe(true)
      expect(new CloseError(1005, '', false).shouldRetry()).toBe(true)
      expect(new CloseError(1006, '', false).shouldRetry()).toBe(true)
      expect(new CloseError(1011, '', false).shouldRetry()).toBe(true)
    })
  })
})

describe(WebSocketClientError, () => {
  it('is an Error but NOT a WebSocketConnectionError', () => {
    const e = new WebSocketClientError('nope')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(WebSocketClientError)
    expect(e).not.toBeInstanceOf(WebSocketConnectionError)
    expect(e.name).toBe('WebSocketClientError')
    expect(e.message).toBe('nope')
  })
})
