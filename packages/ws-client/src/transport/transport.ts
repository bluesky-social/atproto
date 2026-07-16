export interface TransportCapabilities {
  /** Can send protocol pings and observe pongs. */
  heartbeat: boolean
  /** Can exert real read-side backpressure. */
  pauseResume: boolean
}

export interface TransportHandlers {
  onOpen(): void
  onMessage(data: string | Uint8Array, isBinary: boolean): void
  onPong(): void
  onClose(code: number, reason: string, wasClean: boolean): void
  onError(err: Error): void
}

export interface Transport {
  readonly capabilities: TransportCapabilities
  /** Negotiated subprotocol; '' until open (and if none negotiated). */
  readonly protocol: string
  /** Set once by the engine before events begin. */
  handlers: TransportHandlers
  /** Instantiate and connect the underlying socket, wiring it to `handlers`. */
  open(): void
  send(data: string | Uint8Array, onFlush: (err?: Error) => void): void
  ping(): void
  pause(): void
  resume(): void
  close(code?: number, reason?: string): void
  terminate(): void
}

export interface TransportOptions {
  protocols?: string | string[]
  headers?: Record<string, string> | Headers
}

export type TransportFactory = (
  url: string | URL,
  options?: TransportOptions,
) => Transport
