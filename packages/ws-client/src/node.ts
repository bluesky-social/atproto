import {
  type DataMode,
  WebSocketConnectionEngine,
  type WebSocketConnectionOptions,
} from './connection.js'
import { createNodeTransport } from './node-transport.js'
import {
  type Awaitable,
  type ConnectionFactory,
  type WebSocketClientOptions,
  WebSocketClientBase,
} from './client.js'

export class WebSocketConnection<
  M extends DataMode = 'auto',
> extends WebSocketConnectionEngine<M> {
  constructor(url: string | URL, options?: WebSocketConnectionOptions<M>) {
    super(createNodeTransport, url, options)
  }
}

const nodeConnectionFactory: ConnectionFactory = (url, options) =>
  new WebSocketConnectionEngine(createNodeTransport, url, options)

export class WebSocketClient<
  M extends DataMode = 'auto',
> extends WebSocketClientBase<M> {
  constructor(
    url: string | URL | (() => Awaitable<string | URL>),
    options?: WebSocketClientOptions<M>,
  ) {
    super(nodeConnectionFactory, url, options)
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

export { CloseCode, DisconnectError } from './close-codes.js'
