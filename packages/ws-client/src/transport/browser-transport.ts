import { CloseCode } from '../lib/close-codes.js'
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

export const HEADERS_SUPPORTED = false

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
  send(data: string | BufferSource): void
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

// The close codes `WebSocket.close()` accepts: 1000, or the private-use range
// 3000-4999. Anything else — including RFC 6455 codes an endpoint may legitimately
// *receive*, like 1002 or 1003 — throws InvalidAccessError synchronously, because
// the spec reserves the rest for the protocol itself to send.
//
// So a code chosen elsewhere (by the channel, or by a caller's CloseError) cannot
// be passed through unchecked here: it would throw from inside an event handler or
// an abort listener, where nothing can catch it. Substituting 1000 loses the
// specific code but still closes the connection cleanly, which is the part that
// matters; the specific reason still reaches the consumer as the iterator's
// rejection. Node's `ws` has no such restriction, hence no equivalent there.
function closeSocket(ws: WHATWGWebSocket, code: number | undefined): void {
  const permitted =
    code === undefined ||
    code === CloseCode.Normal ||
    (code >= 3000 && code <= 4999)
  ws.close(permitted ? code : CloseCode.Normal)
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
  WebSocketImpl: WebSocketCtor = globalThis.WebSocket,
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

  // Marked as aborted once the socket's close event has fired — the transport's
  // proof that teardown finished, handed to the channel so iteration doesn't
  // settle until the socket is down.
  const closeController = new AbortController()
  const markClosed = () => closeController.abort()

  const channel = createMessageChannel<M>({
    dataMode: options.dataMode,
    highWaterMark: options.highWaterMark,
    maxBufferedBytes: options.maxBufferedBytes,
    idleTimeoutMs: options.idleTimeoutMs,
    // No `backpressure`, per the module doc above. Its absence is also what lets
    // the idle timeout work here: a merely-full buffer must not read as a pause,
    // since this platform can never actually pause.
    onAbort: (error, code) => {
      // A polite close is the strongest teardown the WHATWG API offers — there is
      // no `terminate()`.
      closeSocket(ws, code)
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

  // Ends the connection with a failure, the moment teardown begins.
  //
  // The channel is failed here rather than from the 'close' handler, so delivery
  // stops at once: a close is a *handshake*, and the socket stays readable until
  // the peer answers, which would otherwise let frames keep arriving and being
  // yielded after the consumer asked to stop. `closeGuard` holds the resulting
  // rejection until the close event fires, so iteration still settles only once
  // the socket is down.
  //
  // Recorded as well as applied, because the 'close' handler needs to know this
  // connection ended badly. An object so a recorded `undefined` still counts.
  let pendingError: { error: unknown } | undefined
  function endWith(error: unknown): void {
    if (pendingError) return
    pendingError = { error }
    channel.fail(error)
  }

  // Handed to `onOpen`, which the reconnect loop forwards straight to the caller's
  // `onConnect` — so this object, not just its `send`, is public API. Keep it to
  // exactly the `Sender` surface: anything else added here becomes reachable from
  // userland, and the transport itself is deliberately not part of the contract.
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

  // Where a connection ends, and normally the only place: per spec every teardown
  // fires `close`, with `error` confined to failures before the connection is
  // established. See the 'error' handler below for the runtime where `close`
  // alone isn't enough.
  ws.addEventListener('close', (ev) => {
    open = false
    if (pendingError) {
      // Teardown began with a failure (a socket error, a bad frame, an idle
      // timeout, an aborted signal). The channel was already failed then; report
      // the close as abnormal, since a handshake we cut short describes the
      // goodbye rather than what ended this connection.
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
    endWith(new SocketError(ev.error))
    // Settled here as well as from 'close', which is defensive against Node 22:
    // its WebSocket strands two pre-open failures, firing `error` with no `close`
    // to follow and leaving the socket wedged rather than CLOSED.
    //
    // - `close()` on a still-CONNECTING socket fires `error` *twice*, readyState
    //   stays CLOSING (2)
    // - a refused dial fires `error` once, readyState stays CONNECTING (0)
    //
    // Since iteration waits for the close event to prove teardown finished, either
    // one would park a consumer forever. Node 24 fires `error` then `close` for
    // both, where the handler above reports the same outcome — and both paths are
    // guarded, so whichever arrives first wins and neither repeats.
    //
    // `error` carries no detail by design (the spec withholds it so a page cannot
    // probe the network), which is why this reports an abnormal close rather than
    // anything more specific.
    reportClose(ABNORMAL_CLOSE_DETAIL)
    markClosed()
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      endWith(options.signal.reason)
      // An abort always closes politely — it is a request to stop, not a failure —
      // and the reason only picks the code: a `CloseError` names one, anything
      // else means 1000. The 'close' handler above settles the channel.
      closeSocket(ws, closeCodeForStop(options.signal.reason))
    },
    { once: true },
  )

  // This lets consumers treat the end of iteration as "teardown is done"
  // (resources have been released).
  const iterator = closeGuard(channel.iterator, closeController.signal)

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => iterator,
  }
}

// `satisfies` rather than a `: TransportFactory` annotation, so the exported
// value keeps its wider type — including the injectable `WebSocketCtor` second
// parameter — while still being checked against `TransportFactory`, which the
// `#transport` entrypoint calls with one argument.
export const createTransport = createTransportImpl satisfies TransportFactory

function hasHeaders(headers: HeadersInit | undefined): boolean {
  if (!headers) return false
  // Headers normalizes every HeadersInit form (record, entry pairs, Headers).
  for (const _ of new Headers(headers)) return true
  return false
}
