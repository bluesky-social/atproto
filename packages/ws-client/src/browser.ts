import { createBrowserTransport } from './browser-transport.js'
import {
  type DataMode,
  WebSocketCoreEngine,
  type WebSocketCoreOptions,
} from './core.js'
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
    super(createBrowserTransport, url, options)
  }
}

const browserCoreFactory: CoreFactory = (url, options) =>
  new WebSocketCoreEngine(createBrowserTransport, url, options)

export class ReconnectingWebSocket<
  M extends DataMode = 'auto',
> extends ReconnectingWebSocketBase<M> {
  constructor(
    url: string | URL | (() => Awaitable<string | URL>),
    options?: ReconnectingOptions<M>,
  ) {
    super(browserCoreFactory, url, options)
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

export { CloseCode, DisconnectError } from './keepalive-shared.js'
