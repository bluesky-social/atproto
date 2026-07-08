import type {
  Transport,
  TransportCapabilities,
  TransportHandlers,
} from '../../src/transport.js'

const noopHandlers: TransportHandlers = {
  onOpen() {},
  onMessage() {},
  onPong() {},
  onClose() {},
  onError() {},
}

export class MockTransport implements Transport {
  readonly capabilities: TransportCapabilities
  protocol: string
  handlers: TransportHandlers = noopHandlers

  sent: Array<{ data: string | Uint8Array; onFlush: (err?: Error) => void }> =
    []
  pinged = 0
  paused = false
  closedWith: { code?: number; reason?: string } | null = null
  terminated = false

  private autoFlush: boolean

  constructor(options?: {
    capabilities?: TransportCapabilities
    protocol?: string
    autoFlush?: boolean
  }) {
    this.capabilities = options?.capabilities ?? {
      heartbeat: true,
      pauseResume: true,
    }
    this.protocol = options?.protocol ?? ''
    this.autoFlush = options?.autoFlush ?? false
  }

  send(data: string | Uint8Array, onFlush: (err?: Error) => void): void {
    this.sent.push({ data, onFlush })
    if (this.autoFlush) onFlush()
  }

  ping(): void {
    this.pinged++
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason }
  }

  terminate(): void {
    this.terminated = true
  }

  // ---- driver methods used by tests ----
  emitOpen(): void {
    this.handlers.onOpen()
  }
  emitMessage(data: string | Uint8Array, isBinary: boolean): void {
    this.handlers.onMessage(data, isBinary)
  }
  emitPong(): void {
    this.handlers.onPong()
  }
  emitClose(code: number, reason = '', wasClean = code === 1000): void {
    this.handlers.onClose(code, reason, wasClean)
  }
  emitError(err: Error): void {
    this.handlers.onError(err)
  }
}
