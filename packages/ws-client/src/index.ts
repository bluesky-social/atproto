import { createTransport } from '#transport'
import { createWebSocket } from './websocket.js'
import type { WebSocketFn } from './websocket.js'

export type {
  CloseEventDetail,
  DataMode,
  MessageOf,
} from './message-channel.js'
// `Sender` is public because `onConnect` hands one to the caller. The rest of
// the transport contract (`Transport`, `TransportOptions`, `TransportFactory`,
// `createWebSocket`) stays internal: platform selection happens through the
// `#transport` imports condition, so a third-party transport has no supported
// way in anyway, and exporting the interface would commit us to its shape for no
// consumer that exists. Widening a public API later is easy; narrowing it isn't.
export type { HeadersInit, Sender } from './transport/transport.js'
export type {
  Awaitable,
  BrowserWebSocketOptions,
  ConnectionOptions,
  NodeWebSocketOptions,
  WebSocketFn,
  WebSocketIterable,
  WebSocketOptions,
} from './websocket.js'

export { CloseCode } from './lib/close-codes.js'
export {
  BufferOverflowError,
  CloseError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketClientError,
  WebSocketConnectionError,
} from './lib/errors.js'
export {
  FATAL_CLOSE_CODES,
  defaultShouldReconnect,
  isReconnectableClose,
} from './lib/reconnect-policy.js'

/**
 * The `websocket()` generator, bound to the platform transport selected by the
 * `#transport` imports condition. The single entrypoint for consuming a
 * WebSocket as a reconnecting async stream.
 */
export const websocket: WebSocketFn = createWebSocket(createTransport)
