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
  extends AsyncIterable<MessageOf<M>, void, unknown>, Sender<M> {}

/** Default protocol-ping interval when `heartbeat` is left unset. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000

/**
 * What the reconnect loop hands a transport for one connection.
 *
 * Every field is required, and the ones a caller may omit are spelled
 * `undefined | T` rather than `T?`. This is an internal contract with exactly one
 * call site, so the stricter form is worth it: a field the loop forgets to
 * forward becomes a type error instead of silently reading as "unset", which is
 * how `heartbeat` once silently defaulted to off for every consumer.
 */
export interface TransportOptions<M extends DataMode = 'auto'> {
  url: string | URL
  dataMode: M
  /**
   * Teardown: aborting ends the iteration and closes the socket. Use a
   * {@link CloseError} instance as the reason for controlling the close code
   * and message sent to the server. Any other value will result in a normal
   * close with code 1000 and no message.
   */
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
  heartbeat: undefined | false | { intervalMs?: number }
  /** End the connection if no message arrives within this window. */
  idleTimeoutMs: undefined | number
  /**
   * Read-side backpressure threshold, in bytes of received-but-unread messages.
   * Past it the socket is paused until the consumer drains below half the mark;
   * Node only, since the WHATWG API cannot pause a socket. Default 1 MiB.
   *
   * There is only one buffer in this library — received messages awaiting the
   * consumer — so this is unambiguously a *readable* high-water mark. Nothing
   * bounds the write side: `send()` hands each message straight to the socket.
   *
   * Counts binary frames exactly and over-estimates text (UTF-16 code units × 2,
   * to avoid an encode per message), so a text stream pauses about twice as early
   * as the byte count suggests.
   */
  highWaterMark: undefined | number
  /**
   * Hard cap on buffered, unread bytes — the same accounting as
   * {@link TransportOptions.highWaterMark}. Exceeding it fails the connection
   * with a `BufferOverflowError` rather than growing the buffer without bound,
   * and is the only such backstop in the browser. Unlimited by default.
   */
  maxBufferedBytes: undefined | number
  /** Applied to the upgrade request (Node only; the browser transport throws). */
  headers: undefined | HeadersInit
  protocols: undefined | string | string[]
  /** The socket opened; `sender` is valid until this connection ends. */
  onOpen(sender: Sender<M>): void
  /**
   * The connection ended. Always fires exactly once per transport, including for
   * a dial that never opened — so a caller that needs "was it ever up?" must
   * track `onOpen` itself.
   *
   * Fires before the iteration settles: a transport reports its close here, then
   * releases whatever pull is parked, so the end of iteration implies teardown is
   * complete.
   */
  onClose(detail: CloseEventDetail): void
}

export type TransportFactory = <M extends DataMode = 'auto'>(
  options: TransportOptions<M>,
) => Transport<M>
