import { createBrowserTransport } from './browser-transport.js'
import {
  type DataMode,
  WebSocketCoreEngine,
  type WebSocketCoreOptions,
} from './core.js'

export class WebSocketCore<
  M extends DataMode = 'auto',
> extends WebSocketCoreEngine<M> {
  constructor(url: string | URL, options?: WebSocketCoreOptions<M>) {
    super(createBrowserTransport, url, options)
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

// Temporary stub: reimplemented on WebSocketCore in a follow-up round.
export { WebSocketKeepAlive } from './keepalive-stub.js'
export { CloseCode, DisconnectError } from './keepalive-shared.js'
