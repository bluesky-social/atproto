import { SocketError, WebSocketClientError } from '../lib/errors.js'
import {
  ABNORMAL_CLOSE_DETAIL,
  type CloseEventDetail,
  type DataMode,
  closeCodeForStop,
  createMessageChannel,
} from '../message-channel.js'
import type {
  HeadersInit,
  Sender,
  Transport,
  TransportFactory,
  TransportOptions,
} from './transport.js'

// Only the WHATWG WebSocket members this transport actually touches, rather than
// the ambient `WebSocket` — which pulls in all of `EventTarget` plus
// `readyState`, `bufferedAmount`, `extensions`, the CONNECTING/OPEN constants,
// and so on. Narrow means a test's fake only implements four methods, and keeps
// this file honest about what it depends on.
//
// Checked against the WHATWG WebSockets Standard: `binaryType` is 'blob' |
// 'arraybuffer', and `close` fires a CloseEvent with `{ code, reason, wasClean }`.
// `send` also accepts Blob per spec, but this transport only ever sends
// `string | Uint8Array`, so the narrower parameter type is accurate here.
interface WHATWGMessageEvent {
  readonly data: unknown
}

interface WHATWGCloseEvent {
  readonly code: number
  readonly reason: string
  readonly wasClean: boolean
}

// Browser 'error' events are ErrorEvents, which carry `error`; undici and some
// runtimes dispatch a plain Event instead. Optional to span both.
interface WHATWGErrorEvent {
  readonly error?: unknown
}

interface WHATWGWebSocket {
  binaryType: 'blob' | 'arraybuffer'
  send(data: string | ArrayBufferLike | ArrayBufferView): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'open', listener: () => void): void
  addEventListener(
    type: 'message',
    listener: (ev: WHATWGMessageEvent) => void,
  ): void
  addEventListener(
    type: 'close',
    listener: (ev: WHATWGCloseEvent) => void,
  ): void
  addEventListener(
    type: 'error',
    listener: (ev: WHATWGErrorEvent) => void,
  ): void
}

/** Constructor shape this transport relies on — injectable so tests (and
 * non-browser runtimes) can supply an implementation other than the global. */
export type WebSocketCtor = new (
  url: string | URL,
  protocols?: string | string[],
) => WHATWGWebSocket

function hasHeaders(headers: HeadersInit | undefined): boolean {
  if (!headers) return false
  // Headers normalizes every HeadersInit form (record, entry pairs, Headers).
  for (const _ of new Headers(headers)) return true
  return false
}

/**
 * Browser (WHATWG) transport. Created already connecting; torn down by
 * `options.signal`. Every receive-side concern (buffering, watermarks,
 * `dataMode` enforcement, idle timeout) belongs to `createMessageChannel`; this
 * wires the raw socket to it.
 *
 * This is also the fallback for non-browser runtimes that ship a global WHATWG
 * `WebSocket` but no `#transport` override of their own (Bun, Deno, workers,
 * Expo) — hence the loud failures below rather than assuming a browser.
 *
 * Two things Node's transport has that this one lacks:
 * - No read-side backpressure. The WHATWG API has no `ws.pause()`/`resume()`, so
 *   `createMessageChannel` gets no `backpressure` hooks and `maxBufferedBytes` is
 *   the only backstop against an unbounded read buffer.
 * - No heartbeat. The WHATWG API has no ping/pong, so `options.heartbeat` is
 *   ignored and `idleTimeoutMs` is this platform's only dead-connection detector.
 */
function createTransportImpl<M extends DataMode>(
  options: TransportOptions<M>,
  // Injectable for tests; defaults to the platform global. Read through a
  // loosely-typed view of `globalThis` rather than relying on assignability from
  // the ambient DOM `WebSocket`, which drags in members `WHATWGWebSocket`
  // doesn't ask for.
  WebSocketImpl: WebSocketCtor = (globalThis as { WebSocket?: WebSocketCtor })
    .WebSocket as WebSocketCtor,
): Transport<M> {
  // The WHATWG API has no request-header mechanism, so accepting headers here
  // would silently drop what is usually auth. Fail loudly at construction rather
  // than connect with the wrong credentials.
  if (hasHeaders(options.headers)) {
    throw new TypeError(
      'WebSocket headers are not supported in the browser; use the URL or a subprotocol instead',
    )
  }
  // Fail loudly where a global WebSocket is genuinely absent, rather than
  // surfacing a confusing "undefined is not a constructor" a few lines down.
  if (!WebSocketImpl) {
    throw new TypeError('WebSocket is not available in this environment')
  }

  const channel = createMessageChannel<M>({
    dataMode: options.dataMode,
    highWaterMark: options.highWaterMark,
    maxBufferedBytes: options.maxBufferedBytes,
    idleTimeoutMs: options.idleTimeoutMs,
    // No `backpressure`, per the module doc above. Its absence is also what lets
    // the idle timeout work here: a merely-full buffer must not read as a pause,
    // since this platform can never actually pause.
    onAbort: (_error, code) => {
      // A polite close is the strongest teardown the WHATWG API offers — there is no `terminate()`.
      ws.close(code)
    },
  })

  const ws = new WebSocketImpl(options.url, options.protocols)
  ws.binaryType = 'arraybuffer'

  let open = false
  let closeReported = false

  function reportClose(detail: CloseEventDetail): void {
    if (closeReported) return
    closeReported = true
    options.onClose(detail)
  }

  const sender: Sender<M> = {
    async send(data) {
      if (!open) {
        throw new WebSocketClientError('WebSocket is not open')
      }
      // The WHATWG API gives no flush notification, only indicates that the browser accepted the write
      ws.send(data)
    },
  }

  ws.addEventListener('open', () => {
    open = true
    options.onOpen(sender)
  })

  ws.addEventListener('message', (ev) => {
    const { data } = ev
    // With binaryType 'arraybuffer', a spec-compliant socket delivers text data as a string and binary
    // data as an ArrayBuffer.
    if (typeof data === 'string') {
      channel.push(data)
    } else if (data instanceof ArrayBuffer) {
      channel.push(new Uint8Array(data))
    } else {
      const error = new SocketError(
        new TypeError('Unsupported WebSocket message data type'),
      )
      channel.fail(error)
      ws.close()
      reportClose(ABNORMAL_CLOSE_DETAIL)
    }
  })

  ws.addEventListener('close', (ev) => {
    open = false
    const detail: CloseEventDetail = {
      code: ev.code,
      reason: ev.reason,
      wasClean: ev.wasClean,
    }
    channel.finish()
    reportClose(detail)
  })

  ws.addEventListener('error', (ev) => {
    open = false
    channel.fail(new SocketError(ev.error))
    // Per spec an 'error' event is always followed by a 'close', so this is
    // normally redundant with the listener above — but the guard in
    // reportClose() keeps it to one call either way, and this covers a runtime
    // that doesn't honor that ordering.
    reportClose(ABNORMAL_CLOSE_DETAIL)
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      channel.fail(options.signal.reason)
      // How the stop was requested decides how the socket ends: a bare abort
      // closes politely at 1000, a CloseError closes with its code, anything else
      // is a failure. On the polite paths the real close event carries the
      // detail, which is why nothing is reported here.
      const code = closeCodeForStop(options.signal.reason)
      if (code !== undefined) {
        ws.close(code)
        return
      }
      ws.close()
      reportClose(ABNORMAL_CLOSE_DETAIL)
    },
    { once: true },
  )

  // The channel's iterable is handed out as-is. A connection ending is reported
  // through `onClose` above, and the reconnect loop turns that detail into a
  // classifiable error, so nothing here needs to invent one.
  const iterable = channel.iterable

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => iterable[Symbol.asyncIterator](),
  }
}

// `satisfies` rather than a `: TransportFactory` annotation, so the exported
// value keeps its wider type — including the injectable `WebSocketCtor` second
// parameter — while still being checked against `TransportFactory`, which the
// `#transport` entrypoint calls with one argument.
export const createTransport = createTransportImpl satisfies TransportFactory
