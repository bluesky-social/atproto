import { createTransport } from '#transport'
import { createWebSocket } from './websocket.js'
import type { WebSocketFn } from './websocket.js'

export type {
  CloseEventDetail,
  DataMode,
  MessageOf,
} from './message-channel.js'
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
 * The public `websocket()` generator, bound to the platform transport
 * selected by the `#transport` package-imports condition. This is the single
 * entrypoint for consuming a WebSocket as a reconnecting async stream.
 */
export const websocket: WebSocketFn = createWebSocket(createTransport)
