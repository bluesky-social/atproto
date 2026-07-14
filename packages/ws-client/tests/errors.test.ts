import { describe, expect, it } from 'vitest'
import {
  AbnormalCloseError,
  BufferOverflowError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketCoreError,
} from '../src/errors.js'

describe('WebSocketCore errors', () => {
  it('all extend WebSocketCoreError and Error', () => {
    const errs = [
      new AbnormalCloseError(1011, 'boom', false),
      new SocketError(new Error('cause')),
      new HeartbeatTimeoutError(),
      new IdleTimeoutError(),
      new BufferOverflowError(2048),
      new DataModeError('text', 'binary'),
    ]
    for (const e of errs) {
      expect(e).toBeInstanceOf(WebSocketCoreError)
      expect(e).toBeInstanceOf(Error)
    }
  })

  it('AbnormalCloseError carries code/reason/wasClean', () => {
    const e = new AbnormalCloseError(1011, 'server error', false)
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
})
