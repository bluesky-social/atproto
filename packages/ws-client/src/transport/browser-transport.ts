import { SocketError, WebSocketConnectionError } from '../lib/errors.js'
import {
  ABNORMAL_CLOSE_DETAIL,
  type CloseEventDetail,
  type DataMode,
  createMessageChannel,
  toTransportIterable,
} from '../message-channel.js'
import type {
  HeadersInit,
  Sender,
  Transport,
  TransportFactory,
  TransportOptions,
} from './transport.js'

// A minimal, hand-rolled WHATWG WebSocket shape — only the members this
// transport actually touches — rather than the full ambient `WebSocket`
// (which pulls in `EventTarget`'s entire surface: `dispatchEvent`,
// `removeEventListener`, `readyState`, `bufferedAmount`, `extensions`, the
// `CONNECTING`/`OPEN`/... constants, etc.). Keeping it narrow means a test's
// fake WebSocket only has to implement four methods, and keeps this file
// honest about what it depends on. Checked against the WHATWG WebSockets
// Standard: `binaryType` is 'blob' | 'arraybuffer'; `close` fires a
// CloseEvent with `{ code, reason, wasClean }`; `send` also accepts Blob per
// spec, but this transport only ever sends `string | Uint8Array`, so the
// narrower parameter type is accurate for our use.
interface WHATWGMessageEvent {
  readonly data: unknown
}

interface WHATWGCloseEvent {
  readonly code: number
  readonly reason: string
  readonly wasClean: boolean
}

// Browser 'error' events are ErrorEvents (which carry `error`); undici and
// some runtimes dispatch a plain Event instead. `error` is optional to span
// both — see the 'error' listener below.
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
 * `options.signal`. Delegates every receive-side concern (buffering,
 * watermarks, `dataMode` enforcement, idle timeout) to `createMessageChannel`
 * and wires the raw socket to it.
 *
 * This module also serves as the fallback transport for non-browser runtimes
 * that ship a global WHATWG `WebSocket` but no `#transport` override of their
 * own (Bun, Deno, workers, Expo) — hence the loud failures below rather than
 * silently assuming a browser.
 *
 * Two capabilities Node's transport has that this one honestly lacks:
 * - No read-side backpressure hook. The WHATWG API has no equivalent of
 *   `ws.pause()`/`resume()`, so `createMessageChannel` is given neither
 *   `onPause` nor `onResume` here — `maxBufferedBytes` is the only backstop
 *   against an unbounded read buffer.
 * - No heartbeat. The WHATWG API has no ping/pong, so `options.heartbeat` is
 *   ignored entirely; `idleTimeoutMs` (enforced by the channel) is this
 *   platform's only dead-connection detector.
 */
function createTransportImpl<M extends DataMode>(
  options: TransportOptions<M>,
  // Injectable for tests; defaults to the platform global. Read through a
  // loosely-typed view of `globalThis` rather than relying on structural
  // assignability from the ambient DOM `WebSocket` type, which drags in
  // members our minimal `WHATWGWebSocket` doesn't ask for.
  WebSocketImpl: WebSocketCtor = (globalThis as { WebSocket?: WebSocketCtor })
    .WebSocket as WebSocketCtor,
): Transport<M> {
  // The WHATWG WebSocket API has no request-header mechanism, so accepting
  // headers here would silently drop what is usually auth. Fail loudly at
  // construction instead of corrupting the connection's intended auth state.
  if (hasHeaders(options.headers)) {
    throw new TypeError(
      'WebSocket headers are not supported in the browser; use the URL or a subprotocol instead',
    )
  }
  // This is also the fallback transport for non-browser runtimes (Bun, Deno,
  // workers, Expo) — fail loudly where a global WebSocket is genuinely
  // absent, rather than surfacing a confusing "undefined is not a
  // constructor" a few lines down.
  if (!WebSocketImpl) {
    throw new TypeError('WebSocket is not available in this environment')
  }

  const channel = createMessageChannel<M>({
    dataMode: options.dataMode,
    highWaterMark: options.highWaterMark,
    maxBufferedBytes: options.maxBufferedBytes,
    idleTimeoutMs: options.idleTimeoutMs,
    // Deliberately no onPause/onResume: see the module doc above.
    onAbort: (_error, code) => {
      // The channel decided the connection must end (dataMode violation,
      // byte-cap overflow, or idle timeout). Send the requested close code
      // when there is one; otherwise there's nothing clean to say. Unlike
      // Node's `ws.terminate()`, a polite close is the strongest teardown
      // the WHATWG API offers.
      ws.close(code)
    },
  })

  const ws = new WebSocketImpl(options.url, options.protocols)
  ws.binaryType = 'arraybuffer'

  let open = false
  let closeReported = false

  // Takes its detail as an argument rather than reading `channel.closeDetail`:
  // after a consumer-initiated `return()` the channel is already terminal
  // and never records one (there was no close frame or error to describe),
  // so relying on it here would report `onClose` with a stale/absent detail
  // instead of the real one the socket eventually reports.
  function reportClose(detail: CloseEventDetail): void {
    if (closeReported) return
    closeReported = true
    options.onClose(detail)
  }

  const sender: Sender<M> = {
    send: (data) =>
      new Promise<void>((resolve, reject) => {
        if (!open) {
          reject(new WebSocketConnectionError('WebSocket is not open'))
          return
        }
        // The WHATWG API gives no flush/delivery notification — `send()`
        // enqueues the frame and returns. Resolving right after hand-off is
        // therefore the strongest guarantee this platform can offer; it is
        // not proof the server received anything, only that the browser
        // accepted the write (at-most-once, like a bare WebSocket).
        ws.send(data)
        resolve()
      }),
  }

  ws.addEventListener('open', () => {
    open = true
    options.onOpen(sender)
  })

  ws.addEventListener('message', (ev) => {
    const { data } = ev
    if (typeof data === 'string') {
      channel.push(data)
    } else if (data instanceof ArrayBuffer) {
      // With binaryType 'arraybuffer', a spec-compliant socket delivers
      // binary data as ArrayBuffer only.
      channel.push(new Uint8Array(data))
    } else {
      // Neither string nor ArrayBuffer: a spec violation (or a runtime that
      // ignored binaryType) rather than something to coerce. Nothing else
      // will end this connection on its own, so close it explicitly.
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
    channel.finish(detail)
    reportClose(detail)
  })

  ws.addEventListener('error', (ev) => {
    open = false
    channel.fail(new SocketError(ev.error))
    // Per spec, an 'error' event is always followed by a 'close' event, so
    // this is normally redundant with the 'close' listener above — but the
    // guard in reportClose() keeps it to exactly one call either way, and it
    // catches any runtime that doesn't honor that ordering.
    reportClose(ABNORMAL_CLOSE_DETAIL)
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      channel.fail(options.signal.reason)
      ws.close()
      reportClose(ABNORMAL_CLOSE_DETAIL)
    },
    { once: true },
  )

  // The channel's own iterable reports a clean `finish()` as a normal
  // `done: true` completion — that's the right internal representation
  // (see createMessageChannel), but a transport's every termination must
  // reach its consumer as an error, even a clean one. A later layer's
  // reconnect policy is what decides clean-vs-fatal, and it needs the close
  // code to do that, which only an error can carry. A consumer-initiated
  // stop (`for await...break`, calling the iterator's `return()`) is exempt:
  // that's forwarded straight through as a plain completion, since it was
  // never the connection ending on its own.
  // Every way the *connection* ends reaches the consumer as an error, even a
  // clean close, so the reconnect policy above can classify by close code; a
  // consumer-initiated stop completes normally instead. Shared with the node
  // transport — see toTransportIterable.
  const iterable = toTransportIterable(channel)

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => iterable[Symbol.asyncIterator](),
  }
}

// `satisfies` (rather than a `: TransportFactory` annotation) keeps the
// exported value's real, wider type — including the injectable
// `WebSocketCtor` second parameter — while still checking it's assignable
// everywhere a `TransportFactory` is expected (the `#transport` entrypoint,
// which only ever calls it with one argument).
export const createTransport = createTransportImpl satisfies TransportFactory
