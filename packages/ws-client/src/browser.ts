import { createBrowserTransport } from './browser-transport.js'
import {
  type Awaitable,
  type ConnectionFactory,
  WebSocketClientBase,
  type WebSocketClientOptions,
} from './client.js'
import {
  type DataMode,
  WebSocketConnectionEngine,
  type WebSocketConnectionOptions,
} from './connection.js'

/**
 * A single WebSocket connection, consumed as an `AsyncIterable` of messages.
 * Provides the core liveness (heartbeat, idle timeout) and flow control
 * (read-side backpressure) functionality leveraged by {@link WebSocketClient}.
 * Constructing one opens nothing; the socket opens when iteration begins, and
 * it does not reconnect — when the connection ends, so does the iterator.
 */
export class WebSocketConnection<
  M extends DataMode = 'auto',
> extends WebSocketConnectionEngine<M> {
  constructor(url: string | URL, options?: WebSocketConnectionOptions<M>) {
    super(createBrowserTransport, url, options)
  }
}

const browserConnectionFactory: ConnectionFactory = (url, options) =>
  new WebSocketConnectionEngine(createBrowserTransport, url, options)

/**
 * A robust WebSocket client that prioritizes liveness (e.g. via heartbeats),
 * flow control (backpressure), and handles reconnects transparently — using
 * whatever capabilities are available on each platform. Consumed as an
 * `AsyncIterable` of messages whose stream spans reconnects; lifecycle is
 * observable via `addEventListener('open' | 'reconnect' | 'error' | 'close')`.
 */
export class WebSocketClient<
  M extends DataMode = 'auto',
> extends WebSocketClientBase<M> {
  constructor(
    url: string | URL | (() => Awaitable<string | URL>),
    options?: WebSocketClientOptions<M>,
  ) {
    super(browserConnectionFactory, url, options)
  }
}

export type {
  DataMode,
  MessageOf,
  WebSocketConnectionOptions,
} from './connection.js'
export {
  AbnormalCloseError,
  BufferOverflowError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketClientError,
  WebSocketConnectionError,
} from './errors.js'
export type {
  Awaitable,
  BrowserWebSocketClientOptions,
  NodeWebSocketClientOptions,
  WebSocketClientOptions,
} from './client.js'
export { FATAL_CLOSE_CODES, isReconnectableClose } from './reconnect-policy.js'
export type {
  CloseEventDetail,
  WebSocketClientEventMap,
  WebSocketConnectionEventMap,
} from './typed-event-target.js'

export { CloseCode } from './close-codes.js'
