import { HEADERS_SUPPORTED, createTransport, openWebSocket } from '#transport'
import type { DataMode, MessageOf } from './message-channel.js'
import {
  type WebSocketFetch,
  bindWebSocketFetch,
} from './websocket-response.js'
import {
  type WebSocketIterable,
  type WebSocketOptions,
  type WebSocketUrl,
  websocketFactory,
} from './websocket.js'

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
  WebSocketHandshakeInit,
  WebSocketIterable,
  WebSocketOptions,
  WebSocketUrl,
} from './websocket.js'
export type { WebSocketFetch } from './websocket-response.js'
export {
  WebSocketResponse,
  isWebSocketHandshake,
} from './websocket-response.js'

export { CloseCode } from './lib/close-codes.js'
export {
  BufferOverflowError,
  CloseError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  UnexpectedResponseError,
  WebSocketClientError,
} from './lib/errors.js'
export {
  FATAL_CLOSE_CODES,
  defaultShouldReconnect,
  isReconnectableClose,
} from './lib/reconnect-policy.js'

/**
 * Whether the platform WebSocket implementation supports creating WebSockets
 * with a {@link WebSocketOptions.headers} option. Node does, the browser
 * doesn't. Creating a WebSocket with headers on a platform that doesn't support
 * them throws an error.
 */
// @NOTE Must be explicitly typed a boolean
export const HEADERS_SUPPORTED_PLATFORM: boolean = HEADERS_SUPPORTED

export type NodeWebSocketOptions<
  M extends DataMode = 'auto',
  T = MessageOf<M>,
> = WebSocketOptions<M, T>
export type BrowserWebSocketOptions<
  M extends DataMode = 'auto',
  T = MessageOf<M>,
> = Omit<WebSocketOptions<M, T>, 'headers'>

/**
 * A function allows building an isomorphic {@link WebSocketIterable}.
 */
export function websocket(
  url: WebSocketUrl,
  options?: WebSocketOptions<'auto'>,
): WebSocketIterable<'auto'>
export function websocket<M extends DataMode, T = MessageOf<M>>(
  url: WebSocketUrl,
  options: M extends 'auto'
    ? WebSocketOptions<'auto', T>
    : WebSocketOptions<M, T> & { dataMode: M },
): WebSocketIterable<M, T>
export function websocket<M extends DataMode, T = MessageOf<M>>(
  url: WebSocketUrl,
  options: WebSocketOptions<M, T> = {},
): WebSocketIterable<M, T> {
  return websocketFactory(url, createTransport, options)
}

/**
 * Wraps `fetch` so that it can also open WebSockets: a `GET` request with an
 * `Upgrade: websocket` header (such as the {@link WebSocketHandshakeInit} that
 * `websocket()` hands to a {@link WebSocketUrl} function) performs the opening
 * handshake, sending the request's headers, and resolves with a
 * {@link WebSocketResponse} (status `101`) once the connection is open, or
 * with the server's response if it refused the upgrade. Every other request is
 * passed to `fetch` untouched.
 *
 * Since a handshake is just a request, it goes through whatever wraps this
 * fetch — adding credentials, signing proofs of possession, retrying on a
 * `401` — and `websocket()` takes the connection over from the response:
 *
 * ```ts
 * const fetch = withCredentials(createWebSocketFetch())
 * websocket((init) => fetch('https://example.com/subscribe', init))
 * ```
 *
 * In the browser, where the WebSocket API can neither send headers nor expose
 * the handshake response, a handshake carrying headers is refused, and a
 * refused upgrade rejects (with a `SocketError`) instead of resolving.
 */
export function createWebSocketFetch(
  fetch: typeof globalThis.fetch = globalThis.fetch,
): WebSocketFetch {
  return bindWebSocketFetch(openWebSocket, fetch)
}
