import type { WebSocketHandle } from './transport/transport.js'

/**
 * A `fetch()`-like function that also opens WebSockets: given a handshake
 * request (a `GET` with an `Upgrade: websocket` header), it resolves with a
 * {@link WebSocketResponse} once the connection is open, or with the server's
 * response if it refused the upgrade.
 */
export type WebSocketFetch = typeof globalThis.fetch

type FetchInput = string | URL | Request

// Taken over at most once, by the transport of the stream that requested it.
const sockets = new WeakMap<WebSocketResponse, WebSocketHandle>()

/**
 * The response to a successful WebSocket handshake, as resolved by a fetch
 * created with `createWebSocketFetch()`: status `101`, the handshake response
 * headers (when the platform exposes them), no body, and an open connection
 * that only `websocket()` can take over.
 *
 * A `101` cannot be constructed through the `Response` constructor, which only
 * accepts 200-599, so the status related getters are overridden instead. Fetch
 * wrappers that only look at the status and headers (to add credentials, or to
 * retry on a `401`) handle it like any other response.
 */
export class WebSocketResponse extends Response {
  constructor(socket: WebSocketHandle, headers?: HeadersInit) {
    super(null, { status: 200, headers })
    sockets.set(this, socket)
  }

  override clone(): never {
    throw new TypeError('A WebSocket response cannot be cloned')
  }
}

// Declared as properties (not accessors) by the `Response` typings, hence not
// overridable in the class body.
Object.defineProperties(WebSocketResponse.prototype, {
  status: { get: () => 101 },
  statusText: { get: () => 'Switching Protocols' },
  ok: { get: () => false },
})

/**
 * Takes over the connection of a {@link WebSocketResponse}. Returns `undefined`
 * for any other response, or one whose connection was already taken over.
 */
export function takeWebSocket(response: Response): WebSocketHandle | undefined {
  if (!(response instanceof WebSocketResponse)) return undefined
  const socket = sockets.get(response)
  sockets.delete(response)
  return socket
}

/**
 * Whether a `fetch()` call is a WebSocket opening handshake: a `GET` with an
 * `Upgrade: websocket` header.
 *
 * Read from the arguments rather than from a `Request` built out of them: in
 * the browser, where `Upgrade` and `Sec-*` are forbidden request headers, a
 * `Request` would drop them. The flip side is that a fetch wrapper that
 * rebuilds the request as a `Request` hides the handshake in the browser.
 *
 * @note This reads `init.headers`, which may be an iterable computing the
 * headers as it is iterated: a fetch wrapper calling this must forward what it
 * read, rather than `init`, as {@link bindWebSocketFetch} does.
 */
export function isWebSocketHandshake(
  input: FetchInput,
  init?: RequestInit,
): boolean {
  return isHandshake(input, init, requestHeaders(input, init))
}

function isHandshake(
  input: FetchInput,
  init: RequestInit | undefined,
  headers: Headers,
): boolean {
  const request = input instanceof Request ? input : undefined
  const method = init?.method ?? request?.method ?? 'GET'
  return (
    method.toUpperCase() === 'GET' &&
    headers.get('upgrade')?.toLowerCase() === 'websocket'
  )
}

/**
 * The headers of a `fetch()` call, read once: `init.headers` may be an
 * iterable that computes them as it is iterated (a fresh proof, a rotated
 * token, …), which must not happen twice for the same request.
 */
function requestHeaders(input: FetchInput, init?: RequestInit): Headers {
  if (init?.headers != null) return new Headers(init.headers)
  return new Headers(input instanceof Request ? input.headers : undefined)
}

// Set by the transport, from the URL scheme and the WebSocket protocol, rather
// than by the caller.
const HANDSHAKE_HEADERS = new Set([
  'connection',
  'upgrade',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-extensions',
  'sec-websocket-protocol',
])

/**
 * Splits the arguments of a handshake `fetch()` call into what a WebSocket
 * client accepts: the URL (`http(s)` maps to `ws(s)`), the subprotocols, the
 * other headers, and the abort signal.
 */
export function handshakeTarget(
  input: FetchInput,
  init?: RequestInit,
): {
  url: URL
  protocols: string[]
  headers: Headers
  signal: AbortSignal | undefined
} {
  const request = input instanceof Request ? input : undefined

  const url = new URL(request?.url ?? input.toString())
  if (url.protocol === 'https:') url.protocol = 'wss:'
  else if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
    throw new TypeError(`Unsupported WebSocket URL protocol "${url.protocol}"`)
  }

  const all = requestHeaders(input, init)

  const protocols =
    all
      .get('sec-websocket-protocol')
      ?.split(',')
      .map((p) => p.trim())
      .filter(Boolean) ?? []

  const headers = new Headers()
  for (const [name, value] of all) {
    if (!HANDSHAKE_HEADERS.has(name)) headers.append(name, value)
  }

  const signal = init?.signal ?? request?.signal ?? undefined

  return { url, protocols, headers, signal }
}

/**
 * Builds a {@link WebSocketFetch}: handshakes go to the platform's
 * `openWebSocket`, anything else to `fetch`.
 */
export function bindWebSocketFetch(
  openWebSocket: (input: FetchInput, init?: RequestInit) => Promise<Response>,
  fetch: typeof globalThis.fetch,
): WebSocketFetch {
  return async function webSocketFetch(input, init) {
    // The headers are read once (see requestHeaders), and what was read is
    // what goes on, whichever way the request goes. The rest of `init` (a
    // streamed body included) is forwarded as is.
    const headers = requestHeaders(input, init)
    const forwarded: RequestInit = { ...init, headers }
    return isHandshake(input, init, headers)
      ? openWebSocket(input, forwarded)
      : fetch(input, forwarded)
  }
}
