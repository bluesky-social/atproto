import type {
  CloseEventDetail,
  DataMode,
  MessageOf,
} from '../message-channel.js'

// The web's HeadersInit (a record, entry pairs, or a Headers). Derived from the
// Headers constructor so it resolves under both the DOM lib and @types/node —
// the latter has the Headers global but not the HeadersInit type name.
export type HeadersInit = NonNullable<ConstructorParameters<typeof Headers>[0]>

export interface Sender<M extends DataMode = 'auto'> {
  /**
   * Resolves on flush (Node) or hand-off (browser), not delivery: at-most-once,
   * like a bare WebSocket. Rejects once this connection is no longer open.
   */
  send(data: MessageOf<M>): Promise<void>
}

export interface Transport<M extends DataMode = 'auto'>
  extends AsyncIterable<MessageOf<M>, void, undefined>,
    Sender<M> {}

/** Default protocol-ping interval when `heartbeat` is left unset. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000

export interface TransportOptions<M extends DataMode = 'auto'> {
  url: string | URL
  dataMode: M
  /** Teardown: aborting ends the iteration and closes the socket. */
  signal: AbortSignal
  /**
   * Protocol ping/pong liveness. On by default at
   * {@link DEFAULT_HEARTBEAT_INTERVAL_MS}; pass `false` to disable, or an object
   * to set the interval. `intervalMs` is optional, so `{}` means "on, default
   * interval".
   *
   * Node only. The WHATWG API has no ping/pong, so the browser transport ignores
   * this and relies on `idleTimeoutMs` instead.
   */
  heartbeat?: { intervalMs?: number } | false
  idleTimeoutMs?: number
  highWaterMark?: number
  maxBufferedBytes?: number
  headers?: HeadersInit
  protocols?: string | string[]
  /** The socket opened; `sender` is valid until this connection ends. */
  onOpen(sender: Sender<M>): void
  onClose(detail: CloseEventDetail): void
}

export type TransportFactory = <M extends DataMode = 'auto'>(
  options: TransportOptions<M>,
) => Transport<M>
