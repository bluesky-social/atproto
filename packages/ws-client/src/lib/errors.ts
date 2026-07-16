export class WebSocketConnectionError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
  }
}

export class AbnormalCloseError extends WebSocketConnectionError {
  constructor(
    readonly code: number,
    readonly reason: string,
    readonly wasClean: boolean,
  ) {
    super(`Abnormal WebSocket close (${code}): ${reason}`)
  }
}

export class SocketError extends WebSocketConnectionError {
  constructor(cause: unknown) {
    super('WebSocket transport error', { cause })
  }
}

export class HeartbeatTimeoutError extends WebSocketConnectionError {
  constructor() {
    super('WebSocket heartbeat timed out')
  }
}

export class IdleTimeoutError extends WebSocketConnectionError {
  constructor() {
    super('WebSocket idle timeout elapsed with no message')
  }
}

export class BufferOverflowError extends WebSocketConnectionError {
  constructor(readonly bufferedBytes: number) {
    super(`WebSocket read buffer overflowed (${bufferedBytes} bytes)`)
  }
}

export class DataModeError extends WebSocketConnectionError {
  constructor(
    readonly expected: 'text' | 'binary',
    readonly received: 'text' | 'binary',
  ) {
    super(`Expected ${expected} frame but received ${received}`)
  }
}

/**
 * Thrown by `WebSocketClient` for its own misuse/state errors (e.g. `send()`
 * before connected, or iterating twice) — distinct from the
 * `WebSocketConnectionError` taxonomy, which only ever originates from a
 * `WebSocketConnection`.
 */
export class WebSocketClientError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
  }
}
