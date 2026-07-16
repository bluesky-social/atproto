import {
  type Awaitable,
  type BrowserWebSocketClientOptions,
  type ConnectionFactory,
  WebSocketClientBase,
} from './client.js'
import {
  type BrowserWebSocketConnectionOptions,
  type DataMode,
  WebSocketConnectionEngine,
} from './connection.js'
import { createBrowserTransport } from './transport/browser-transport.js'

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
  // The browser signature narrows the options to the browser-supported subset
  // (no `headers`), so tooling that resolves this entrypoint flags unsupported
  // options at compile time. The transport still validates at runtime for
  // consumers whose type checker resolved the Node.js entrypoint.
  constructor(
    url: string | URL,
    options?: BrowserWebSocketConnectionOptions<M>,
  ) {
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
  // Narrowed to the browser-supported option subset; see WebSocketConnection.
  constructor(
    url: string | URL | (() => Awaitable<string | URL>),
    options?: BrowserWebSocketClientOptions<M>,
  ) {
    super(browserConnectionFactory, url, options)
  }
}

export type {
  BrowserWebSocketConnectionOptions,
  DataMode,
  MessageOf,
  NodeWebSocketConnectionOptions,
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
} from './lib/errors.js'
export type {
  Awaitable,
  BrowserWebSocketClientOptions,
  NodeWebSocketClientOptions,
  WebSocketClientOptions,
} from './client.js'
export {
  FATAL_CLOSE_CODES,
  defaultShouldReconnect,
  isReconnectableClose,
} from './lib/reconnect-policy.js'
export type {
  CloseEventDetail,
  WebSocketClientEventMap,
  WebSocketConnectionEventMap,
} from './lib/typed-event-target.js'

export { CloseCode } from './lib/close-codes.js'
