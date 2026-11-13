import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { WebSocket } from 'ws'
import {
  HeartbeatTimeoutError,
  SocketError,
  UnexpectedResponseError,
  WebSocketClientError,
} from '../lib/errors.js'
import {
  ABNORMAL_CLOSE_DETAIL,
  type CloseEventDetail,
  type DataMode,
  closeCodeForStop,
  closeGuard,
  createMessageChannel,
} from '../message-channel.js'
import { WebSocketResponse, handshakeTarget } from '../websocket-response.js'
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  type Sender,
  type Transport,
  type TransportFactory,
  type TransportOptions,
  type WebSocketHandle,
} from './transport.js'

export const HEADERS_SUPPORTED = true

// How long a polite close may wait for the peer's answering close frame before
// the socket is destroyed and 'close' fires anyway. Enforced by `ws` itself via
// its `closeTimeout` option.
const CLOSE_TIMEOUT_MS = 1_000

/**
 * What {@link openWebSocket} hands over to a transport: an open socket, paused
 * so that no frame is emitted (and lost) before a transport listens to it.
 */
interface NodeWebSocketHandle {
  readonly ws: WebSocket
  /**
   * Detaches the handshake's own listeners, returning the error the socket
   * failed with while waiting to be taken over, if any.
   */
  release(): { error?: unknown }
}

/**
 * Performs a WebSocket opening handshake for a `fetch()` request (see
 * `createWebSocketFetch()`): the request's headers (credentials, proofs of
 * possession, …) are sent with the upgrade request. Resolves with a
 * {@link WebSocketResponse} once the connection is open, or with the server's
 * response if it answered with anything but a `101`. Rejects with a
 * {@link SocketError} when no response was received, or with the abort reason.
 */
export function openWebSocket(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const { url, protocols, headers, signal } = handshakeTarget(input, init)

    if (signal?.aborted) {
      reject(signal.reason)
      return
    }

    const wsopts = {
      headers: Object.fromEntries(headers),
      closeTimeout: CLOSE_TIMEOUT_MS, // see createTransportImpl
    }
    const ws = new WebSocket(url, protocols, wsopts)
    ws.binaryType = 'nodebuffer'

    let upgradeHeaders: Headers | undefined
    let failure: { error: unknown } | undefined

    // Also kept once the promise is settled, until the connection is taken
    // over: whoever requested it tears it down by aborting, including when the
    // response never made it back (e.g. dropped by a fetch wrapper).
    const onAbort = () => {
      ws.terminate()
      reject(signal!.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    // Also keeps a failure of a socket waiting to be taken over from being an
    // unhandled 'error' event.
    const onError = (error: Error) => {
      failure ??= { error }
      reject(new SocketError(error))
    }
    ws.on('error', onError)

    ws.once('upgrade', (res: IncomingMessage) => {
      upgradeHeaders = toHeaders(res.headers)
    })

    // Listening to this event means `ws` neither aborts the handshake nor
    // reads the response: both are ours to do, once the body was read.
    ws.once('unexpected-response', (_req, res: IncomingMessage) => {
      res.once('close', () => {
        signal?.removeEventListener('abort', onAbort)
        ws.terminate()
      })
      try {
        resolve(toResponse(res))
      } catch (error) {
        res.destroy()
        reject(new SocketError(error))
      }
    })

    ws.once('open', () => {
      // Hold every frame until a transport listens for them.
      ws.pause()
      const handle: NodeWebSocketHandle = {
        ws,
        release() {
          signal?.removeEventListener('abort', onAbort)
          ws.off('error', onError)
          return failure ?? {}
        },
      }
      resolve(
        new WebSocketResponse(
          handle as unknown as WebSocketHandle,
          upgradeHeaders,
        ),
      )
    })
  })
}

function toHeaders(raw: IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v)
    } else if (value !== undefined) {
      headers.set(name, value)
    }
  }
  return headers
}

// Throws (a RangeError) for a status the Response constructor rejects.
function toResponse(res: IncomingMessage): Response {
  const status = res.statusCode ?? 0
  const init = {
    status,
    statusText: res.statusMessage,
    headers: toHeaders(res.headers),
  }
  // The Response constructor refuses a body for these statuses.
  if (status === 204 || status === 205 || status === 304) {
    res.resume()
    return new Response(null, init)
  }
  return new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, init)
}

/**
 * Node transport, built on `ws`. Created already connecting; torn down by
 * `options.signal`. Every receive-side concern (buffering, watermarks,
 * `dataMode` enforcement, idle timeout) belongs to `createMessageChannel`; this
 * wires the raw socket to it.
 *
 * Deliberately not `createWebSocketStream`, which never reads the close event's
 * code — the reconnect policy classifies by exactly that.
 */
function createTransportImpl<M extends DataMode>(
  options: TransportOptions<M>,
): Transport<M> {
  // Mirrors the channel's pause state from the hooks below, since the channel
  // doesn't expose it and the heartbeat needs to know that a paused tick can't
  // have seen a pong (or anything else) arrive.
  let paused = false

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
    backpressure: {
      onPause: () => {
        paused = true
        ws.pause()
      },
      onResume: () => {
        paused = false
        ws.resume()
      },
    },
    onAbort: (error, code) => {
      // Send the close code the channel asked for. Missing code here indicates the connection should be dropped outright.
      if (code !== undefined) {
        ws.close(code)
      } else {
        ws.terminate()
      }
    },
  })

  // `ws` offers permessage-deflate by default, the same compression a browser
  // WebSocket offers. Leaving the default in place makes negotiation identical
  // cross-platform by construction.
  //
  // `closeTimeout` bounds the polite-close handshake: if the peer never answers
  // our close frame, `ws` destroys the socket and fires 'close' after this long
  // (its default is 30s — far too long for a shutdown path to wait). The option
  // is typed via the intersection because @types/ws lags ws 8.19, which
  // introduced it.
  const wsopts = {
    headers: options.headers
      ? Object.fromEntries(new Headers(options.headers))
      : undefined,
    closeTimeout: CLOSE_TIMEOUT_MS, // supported by our version of ws, but not in @types/ws yet
  }
  const handle = options.socket as NodeWebSocketHandle | undefined
  if (!handle && options.url === undefined) {
    throw new TypeError('A WebSocket url or socket is required')
  }
  const ws = handle
    ? handle.ws
    : new WebSocket(options.url!, options.protocols, wsopts)

  // Pin the default so every frame, text or binary, arrives as a single Buffer.
  ws.binaryType = 'nodebuffer'

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
  // stops at once: a polite close is a *handshake*, and the socket stays readable
  // until the peer answers it, which would otherwise let frames keep arriving and
  // being yielded after the consumer asked to stop. `closeGuard` is what keeps
  // the strict contract intact — it holds the resulting rejection until the close
  // event fires, so iteration still settles only once the socket is down.
  //
  // Recorded as well as applied, because the 'close' handler needs to know this
  // connection ended badly (and must report 1006 rather than the handshake's
  // code). Wrapped in an object so a recorded `undefined` reason still counts.
  let pendingError: { error: unknown } | undefined
  function endWith(error: unknown): void {
    if (pendingError) return
    pendingError = { error }
    channel.fail(error)
  }

  // Flag-based heartbeat loop: each tick either found evidence of life since the
  // last tick and pings again, or decides the connection is dead and fails the
  // channel. Any inbound frame counts, not just a pong, so a busy connection is
  // never falsely killed. No frames arrive at all while paused for backpressure,
  // pongs included, so a paused tick refreshes the flag instead of timing out.
  // Detection latency is 1x-2x the interval.
  //
  // Armed from the 'open' handler, never at construction: `ws.ping()` throws
  // while the socket is still CONNECTING, and a throw inside a timer callback is
  // an uncaught exception rather than a rejection — so a connect slower than the
  // interval would take the whole process down. That means a hung *connect* is
  // not covered by the heartbeat, only a hung established connection.
  let heartbeatAlive = true
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  function startHeartbeat(): void {
    const { heartbeat } = options
    // On unless explicitly disabled, so a consumer that never thought about
    // liveness still gets dead-connection detection — the behavior
    // WebSocketKeepAlive had, and which its consumers relied on.
    if (heartbeat === false) return
    const intervalMs = heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
    heartbeatAlive = true
    heartbeatTimer = setInterval(() => {
      if (paused) {
        heartbeatAlive = true
        return
      }
      if (!heartbeatAlive) {
        // Recorded and applied from 'close', like every other failure; terminate
        // fires that event promptly since it skips the close handshake.
        endWith(new HeartbeatTimeoutError())
        ws.terminate()
        return
      }
      heartbeatAlive = false
      ws.ping()
    }, intervalMs)
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }
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
      return new Promise<void>((resolve, reject) => {
        ws.send(data, (err) => (err ? reject(new SocketError(err)) : resolve()))
      })
    },
  }

  function onSocketOpen(): void {
    open = true
    startHeartbeat()
    options.onOpen(sender)
  }

  if (!handle) ws.on('open', onSocketOpen)

  // `ws` delivers control frames through their own events rather than 'message',
  // so without this a pong alone wouldn't count as heartbeat evidence.
  ws.on('pong', () => {
    heartbeatAlive = true
  })

  ws.on('message', (data: Buffer, isBinary: boolean) => {
    heartbeatAlive = true
    if (isBinary) {
      // A view onto the Buffer without copying. The `byteOffset`/`byteLength`
      // arguments are mandatory: Node pools small Buffers into a shared
      // ArrayBuffer, so `new Uint8Array(data.buffer)` alone would silently read
      // the wrong bytes.
      channel.push(
        new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      )
    } else {
      channel.push(data.toString('utf8'))
    }
  })

  // The one place a connection ends. `ws` emits 'close' on every teardown path — a
  // peer's close frame, our own close() or terminate(), a refused dial, a socket
  // error, even close() on a socket that is still connecting — so settling here,
  // and only here, is what guarantees a consumer's iteration outlives the socket.
  //
  // Read through `addEventListener` rather than ws's node-style `on('close')`,
  // because only the WHATWG-shaped CloseEvent carries `wasClean` — which ws
  // defines as "close frames were exchanged in both directions", the real
  // closing-handshake test. The browser transport reads the same field from its
  // platform, so both report cleanliness identically instead of one deriving it
  // from the close code.
  ws.addEventListener('close', (ev) => {
    open = false
    clearHeartbeat()
    if (pendingError) {
      // Teardown began with a failure (a socket error, a liveness timeout, an
      // aborted signal). The channel was already failed at that point; report the
      // close as abnormal, since the code from a handshake we cut short would
      // describe the goodbye rather than what actually ended this connection.
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

  // The server answered the upgrade request with something other than a 101.
  // With no listener here, `ws` aborts the handshake itself and raises a bare
  // error, which would classify as a retryable SocketError — so a 404 would be
  // re-dialed forever. Recording the status first lets it decide instead (the
  // 'error' that follows is ignored, since `endWith` is first-wins). Listening
  // also means `ws` leaves the request open, so terminating it is ours to do;
  // that emits 'error' then 'close', and 'close' settles the channel.
  ws.on('unexpected-response', (_req, res) => {
    endWith(
      new UnexpectedResponseError(
        res.statusCode ?? 0,
        res.statusMessage,
        toHeaders(res.headers),
      ),
    )
    ws.terminate()
  })

  // `ws` is not limited to raising 'error' before the connection opens — a
  // mid-connection socket error raises it too — but it always follows with
  // 'close', on every path. So this only records the outcome; the 'close' handler
  // above is what settles the channel and releases the parked pull.
  ws.on('error', (err: Error) => {
    open = false
    clearHeartbeat()
    endWith(new SocketError(err))
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      clearHeartbeat()
      endWith(options.signal.reason)
      // An abort always closes politely — it is a request to stop, not a failure —
      // and the reason only picks the code: a `CloseError` names one, anything
      // else means 1000. Bounded by `closeTimeout`, so a peer that never answers
      // delays this by at most CLOSE_TIMEOUT_MS before `ws` forces the close
      // event. The 'close' handler above is what settles the channel, so a
      // consumer awaiting the end of iteration is awaiting the socket.
      ws.close(closeCodeForStop(options.signal.reason))
    },
    { once: true },
  )

  if (handle) {
    // Taken over already open, with every listener now attached. What the
    // handshake observed while it waited ends here.
    const { error } = handle.release()
    if (ws.readyState === WebSocket.OPEN) {
      // Reported asynchronously, as an 'open' event would be. Resumed either
      // way: an abort in between needs to read the peer's close frame.
      queueMicrotask(() => {
        if (ws.readyState === WebSocket.OPEN) onSocketOpen()
        ws.resume()
      })
    } else {
      endWith(new SocketError(error ?? new Error('WebSocket closed')))
      if (ws.readyState === WebSocket.CLOSED) {
        // Its 'close' event fired before this transport listened.
        reportClose(ABNORMAL_CLOSE_DETAIL)
        markClosed()
      } else {
        ws.terminate()
      }
    }
  }

  // This lets consumers treat the end of iteration as "teardown is done"
  // (resources have been released).
  const iterator = closeGuard(channel.iterator, closeController.signal)

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => iterator,
  }
}

export const createTransport: TransportFactory = createTransportImpl
