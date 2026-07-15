import {
  type DataMode,
  WebSocketCoreEngine,
  type WebSocketCoreOptions,
} from './core.js'
import { createNodeTransport } from './node-transport.js'
import {
  type Awaitable,
  type CoreFactory,
  type ReconnectingOptions,
  ReconnectingWebSocketBase,
} from './reconnecting.js'

export class WebSocketCore<
  M extends DataMode = 'auto',
> extends WebSocketCoreEngine<M> {
  constructor(url: string | URL, options?: WebSocketCoreOptions<M>) {
    super(createNodeTransport, url, options)
  }
}

const nodeCoreFactory: CoreFactory = (url, options) =>
  new WebSocketCoreEngine(createNodeTransport, url, options)

export class ReconnectingWebSocket<
  M extends DataMode = 'auto',
> extends ReconnectingWebSocketBase<M> {
  constructor(
    url: string | URL | (() => Awaitable<string | URL>),
    options?: ReconnectingOptions<M>,
  ) {
    super(nodeCoreFactory, url, options)
  }
}

export type {
  CloseInfo,
  DataMode,
  MessageOf,
  WebSocketCoreOptions,
} from './core.js'
export {
  AbnormalCloseError,
  BufferOverflowError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketCoreError,
} from './errors.js'
export type {
  Awaitable,
  BrowserReconnectingOptions,
  NodeReconnectingOptions,
  ReconnectingOptions,
} from './reconnecting.js'
export { FATAL_CLOSE_CODES, isReconnectableClose } from './reconnect-policy.js'
export type {
  CloseEventDetail,
  WebSocketCoreEventMap,
} from './typed-event-target.js'

export { CloseCode, DisconnectError } from './close-codes.js'
