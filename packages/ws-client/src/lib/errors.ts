import { isReconnectableClose } from './close-codes.js'

export class WebSocketClientError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
  }

  /**
   * Whether the failure is transient, so a reconnect may succeed. Each subclass
   * answers for itself; the base class covers state-misuse errors like `send()`
   * while not open, which are not retryable. Consulted by the default reconnect
   * policy ({@link defaultShouldReconnect}).
   */
  shouldRetry(): boolean {
    return false
  }
}

export class CloseError extends WebSocketClientError {
  constructor(
    readonly code: number,
    readonly reason: string,
    readonly wasClean: boolean,
  ) {
    super(`WebSocket closed (${code}): ${reason}`)
  }

  /** Classified by close code; see {@link FATAL_CLOSE_CODES}. */
  override shouldRetry(): boolean {
    return isReconnectableClose(this.code)
  }
}

export class SocketError extends WebSocketClientError {
  constructor(cause: unknown) {
    super('WebSocket transport error', { cause })
  }

  /** Network trouble is transient. */
  override shouldRetry(): boolean {
    return true
  }
}

export class HeartbeatTimeoutError extends WebSocketClientError {
  constructor() {
    super('WebSocket heartbeat timed out')
  }

  /** A dead connection may be replaced by a live one. */
  override shouldRetry(): boolean {
    return true
  }
}

export class IdleTimeoutError extends WebSocketClientError {
  constructor() {
    super('WebSocket idle timeout elapsed with no message')
  }

  /** A dead connection may be replaced by a live one. */
  override shouldRetry(): boolean {
    return true
  }
}

export class BufferOverflowError extends WebSocketClientError {
  constructor(readonly bufferedBytes: number) {
    super(`WebSocket read buffer overflowed (${bufferedBytes} bytes)`)
  }

  /** A local resource limit — reconnecting would overflow again. */
  override shouldRetry(): boolean {
    return false
  }
}

export class DataModeError extends WebSocketClientError {
  constructor(
    readonly expected: 'text' | 'binary',
    readonly received: 'text' | 'binary',
  ) {
    super(`Expected ${expected} frame but received ${received}`)
  }

  /** A protocol mismatch — the server would send the wrong frames again. */
  override shouldRetry(): boolean {
    return false
  }
}
