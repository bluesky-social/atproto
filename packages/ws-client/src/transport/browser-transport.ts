import { SocketError, WebSocketClientError } from '../lib/errors.js'
import {
  ABNORMAL_CLOSE_DETAIL,
  type CloseEventDetail,
  type DataMode,
  closeCodeForStop,
  closeGuard,
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

  // Resolves once the socket's close event has fired — the transport's proof that
  // teardown finished, handed to the consumer by `closeGuard` below so iteration
  // doesn't settle until the socket is down.
  //
  // Unlike Node there is no `terminate()` here, so a peer that never answers a
  // close frame is bounded only by the runtime's own handshake timeout. The
  // WHATWG API offers nothing stronger.
  let markClosed!: () => void
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve
  })

  // The error that ended this connection, recorded when teardown begins and
  // applied from the 'close' handler, so a pull settles after the socket closed
  // rather than racing it. An object so a recorded `undefined` still counts.
  let pendingError: { error: unknown } | undefined
  function endWith(error: unknown): void {
    pendingError ??= { error }
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
      // Neither string nor ArrayBuffer means a spec violation (or a runtime that
      // ignored binaryType), not something to coerce. Nothing else will end this
      // connection on its own, so close it explicitly.
      endWith(
        new SocketError(
          new TypeError('Unsupported WebSocket message data type'),
        ),
      )
      ws.close()
    }
  })

  // The one place a connection ends. Per spec every teardown — a peer's close
  // frame, our own close(), a failed handshake — fires 'close', so settling the
  // channel here and only here is what guarantees a consumer's iteration outlives
  // the socket.
  ws.addEventListener('close', (ev) => {
    open = false
    if (pendingError) {
      // Teardown began with a failure (a socket error, a bad frame, an idle
      // timeout, an aborted signal): report it now that the socket is down.
      channel.fail(pendingError.error)
      reportClose(ABNORMAL_CLOSE_DETAIL)
    } else {
      channel.finish()
      reportClose({
        code: ev.code,
        reason: ev.reason,
        wasClean: ev.wasClean,
      })
    }
    // Last, so `onClose` has already run by the time any pull parked in
    // `closeGuard` resumes: a consumer that reaches the end of iteration is
    // guaranteed the close was both reported and complete.
    markClosed()
  })

  ws.addEventListener('error', (ev) => {
    open = false
    // Recorded, not applied: per spec 'close' always follows 'error' and applies
    // it. A runtime that skipped 'close' would strand the iteration, which is why
    // the close event is the contract both platforms rely on.
    endWith(new SocketError(ev.error))
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      endWith(options.signal.reason)
      // How the stop was requested decides the close code: a bare abort closes
      // politely at 1000, a CloseError closes with its code, anything else is a
      // failure. A polite close is the strongest teardown the WHATWG API offers,
      // so unlike Node both branches go through close(); the 'close' handler
      // above settles the channel either way.
      const code = closeCodeForStop(options.signal.reason)
      ws.close(code)
    },
    { once: true },
  )

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => closeGuard(channel.iterable, closed),
  }
}

// `satisfies` rather than a `: TransportFactory` annotation, so the exported
// value keeps its wider type — including the injectable `WebSocketCtor` second
// parameter — while still being checked against `TransportFactory`, which the
// `#transport` entrypoint calls with one argument.
export const createTransport = createTransportImpl satisfies TransportFactory
