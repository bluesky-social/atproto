// The web's HeadersInit (a record, entry pairs, or a Headers), derived from
// the Headers constructor so it resolves under both DOM lib and @types/node —
// the latter has the Headers global but no HeadersInit type name.
export type HeadersInit = NonNullable<ConstructorParameters<typeof Headers>[0]>

export interface TransportCapabilities {
  /** Can send protocol pings and observe pongs. */
  heartbeat: boolean
  /** Can exert real read-side backpressure. */
  pauseResume: boolean
}

export interface TransportHandlers {
  onOpen(): void
  /** Binary vs text frame is carried by the data type: Uint8Array vs string. */
  onMessage(data: string | Uint8Array): void
  onPong(): void
  onClose(code: number, reason: string, wasClean: boolean): void
  onError(err: Error): void
}

export interface Transport {
  readonly capabilities: TransportCapabilities
  /** Negotiated subprotocol; `null` until open (and if none negotiated). */
  readonly protocol: string | null
  /** Set once by the engine before events begin. */
  handlers: TransportHandlers
  /** Instantiate and connect the underlying socket, wiring it to `handlers`. */
  open(): void
  /** Resolves once the data is flushed (Node.js) or handed off (browser). */
  send(data: string | Uint8Array): Promise<void>
  ping(): void
  pause(): void
  resume(): void
  close(code?: number, reason?: string): void
  terminate(): void
}

export interface TransportOptions {
  protocols?: string | string[]
  headers?: HeadersInit
}

export type TransportFactory = (
  url: string | URL,
  options?: TransportOptions,
) => Transport
