import type {
  CloseEventDetail,
  DataMode,
  MessageOf,
} from '../message-channel.js'

// The web's HeadersInit (a record, entry pairs, or a Headers), derived from
// the Headers constructor so it resolves under both the DOM lib and
// @types/node — the latter has the Headers global but no HeadersInit type
// name.
export type HeadersInit = NonNullable<ConstructorParameters<typeof Headers>[0]>

export interface Sender<M extends DataMode = 'auto'> {
  /**
   * Resolves on flush (Node) / hand-off (browser) — not delivery. At-most-
   * once, like a bare WebSocket. Rejects once this connection is no longer
   * open.
   */
  send(data: MessageOf<M>): Promise<void>
}

export interface Transport<M extends DataMode = 'auto'>
  extends AsyncIterable<MessageOf<M>, void, undefined>,
    Sender<M> {}

export interface TransportOptions<M extends DataMode = 'auto'> {
  url: string | URL
  dataMode: M
  /** Teardown: aborting ends the iteration and closes the socket. */
  signal: AbortSignal
  heartbeat?: { intervalMs: number }
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
