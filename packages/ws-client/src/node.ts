import {
  type DataMode,
  WebSocketCoreEngine,
  type WebSocketCoreOptions,
} from './core.js'
import { createNodeTransport } from './node-transport.js'

export class WebSocketCore<
  M extends DataMode = 'auto',
> extends WebSocketCoreEngine<M> {
  constructor(url: string | URL, options?: WebSocketCoreOptions<M>) {
    super(createNodeTransport, url, options)
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

// Legacy reconnect client (Node only until reimplemented on WebSocketCore).
export { WebSocketKeepAlive } from './keepalive.js'
export { CloseCode, DisconnectError } from './keepalive-shared.js'
