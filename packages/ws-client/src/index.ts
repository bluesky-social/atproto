import { createTransport } from '#transport'
import { WebSocketClientBase } from './client.js'
import type { WebSocketClientOptions } from './client.js'
import type { DataMode } from './message-channel.js'
import { createWebSocket } from './websocket.js'
import type { Awaitable, WebSocketFn } from './websocket.js'

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
  WebSocketOptions,
} from './websocket.js'
export type {
  BrowserWebSocketClientOptions,
  NodeWebSocketClientOptions,
  WebSocketClientOptions,
} from './client.js'

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

/**
 * A thin, class-based wrapper over {@link websocket} that adds a bounded
 * send queue: `send()` can be called before the first connection opens, or
 * during a reconnect gap, and is flushed once a sender becomes available.
 * Termination is deliberately one idiom — break the `for await`, throw,
 * abort a `signal`, or `await using` — there is no `close()`.
 */
export class WebSocketClient<
  M extends DataMode = 'auto',
> extends WebSocketClientBase<M> {
  constructor(
    url: string | URL | (() => Awaitable<string | URL>),
    options?: WebSocketClientOptions<M>,
  ) {
    super(websocket, url, options)
  }
}
