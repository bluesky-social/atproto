import { describe, expect, it } from 'vitest'
import { CloseCode } from './close-codes.js'
import {
  BufferOverflowError,
  CloseError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketClientError,
} from './errors.js'

describe('error taxonomy', () => {
  it('names each error after its class', () => {
    expect(new SocketError(new Error('x')).name).toBe('SocketError')
    expect(new IdleTimeoutError().name).toBe('IdleTimeoutError')
  })

  it('carries the underlying cause on a socket error', () => {
    const cause = new Error('econnreset')
    expect(new SocketError(cause).cause).toBe(cause)
  })

  it('classifies retryability per subclass', () => {
    expect(new SocketError(new Error('x')).shouldRetry()).toBe(true)
    expect(new HeartbeatTimeoutError().shouldRetry()).toBe(true)
    expect(new IdleTimeoutError().shouldRetry()).toBe(true)
    // A local resource limit: reconnecting would overflow again.
    expect(new BufferOverflowError(999).shouldRetry()).toBe(false)
    // A protocol mismatch: the server would send the wrong frames again.
    expect(new DataModeError('text', 'binary').shouldRetry()).toBe(false)
    // The base class covers state misuse, which is never retryable.
    expect(new WebSocketClientError('misuse').shouldRetry()).toBe(false)
  })

  it('classifies a close error by its code', () => {
    expect(new CloseError(CloseCode.Normal, '', true).shouldRetry()).toBe(false)
    expect(new CloseError(CloseCode.GoingAway, '', true).shouldRetry()).toBe(
      true,
    )
  })

  it('exposes close detail and buffer size on the relevant errors', () => {
    const closed = new CloseError(1011, 'boom', false)
    expect([closed.code, closed.reason, closed.wasClean]).toEqual([
      1011,
      'boom',
      false,
    ])
    expect(new BufferOverflowError(4096).bufferedBytes).toBe(4096)
    const mode = new DataModeError('text', 'binary')
    expect([mode.expected, mode.received]).toEqual(['text', 'binary'])
  })
})
