export class WebSocketCoreError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
  }
}

export class AbnormalCloseError extends WebSocketCoreError {
  constructor(
    readonly code: number,
    readonly reason: string,
    readonly wasClean: boolean,
  ) {
    super(`Abnormal WebSocket close (${code}): ${reason}`)
  }
}

export class SocketError extends WebSocketCoreError {
  constructor(cause: unknown) {
    super('WebSocket transport error', { cause })
  }
}

export class HeartbeatTimeoutError extends WebSocketCoreError {
  constructor() {
    super('WebSocket heartbeat timed out')
  }
}

export class IdleTimeoutError extends WebSocketCoreError {
  constructor() {
    super('WebSocket idle timeout elapsed with no message')
  }
}

export class BufferOverflowError extends WebSocketCoreError {
  constructor(readonly bufferedBytes: number) {
    super(`WebSocket read buffer overflowed (${bufferedBytes} bytes)`)
  }
}

export class DataModeError extends WebSocketCoreError {
  constructor(
    readonly expected: 'text' | 'binary',
    readonly received: 'text' | 'binary',
  ) {
    super(`Expected ${expected} frame but received ${received}`)
  }
}
