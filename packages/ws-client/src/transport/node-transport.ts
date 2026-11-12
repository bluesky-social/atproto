import { WebSocket } from 'ws'
import { CloseCode } from '../lib/close-codes.js'
import {
  CloseError,
  HandshakeRejectedError,
  HandshakeTimeoutError,
  HeartbeatTimeoutError,
  MessageTooBigError,
  SocketError,
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
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  type Sender,
  type Transport,
  type TransportFactory,
  type TransportOptions,
} from './transport.js'

export const HEADERS_SUPPORTED = true

// How long a polite close may wait for the peer's answering close frame before
// the socket is destroyed and 'close' fires anyway. Enforced by `ws` itself via
// its `closeTimeout` option.
const CLOSE_TIMEOUT_MS = 1_000

// `ws`'s default `maxPayload`, which a `MessageTooBigError` reports when the
// caller set none.
const DEFAULT_MAX_PAYLOAD = 100 * 1024 * 1024

// The close codes `ws` sends (RFC 6455 §7.4.1, and the private-use range). It
// throws on any other, but only after moving the socket to CLOSING, which would
// leave it wedged.
function isSendableCloseCode(code: number): boolean {
  return (
    (code >= 1000 &&
      code <= 1014 &&
      code !== 1004 && // Reserved by RFC 6455
      code !== CloseCode.NoStatus &&
      code !== CloseCode.Abnormal) ||
    (code >= 3000 && code <= 4999)
  )
}

// 1006 is never sent on the wire, so it asks for the socket to be dropped
// without a closing handshake. Any other code `ws` can't send closes with 1000.
function closeSocket(ws: WebSocket, code: number, reason?: string): void {
  if (code === CloseCode.Abnormal) {
    ws.terminate()
  } else {
    ws.close(isSendableCloseCode(code) ? code : CloseCode.Normal, reason)
  }
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
  //
  // `maxPayload` is only set when given: `ws` reads an explicit `undefined` as
  // 0, which means unlimited. `lookup` reaches `net.connect()` through `ws`.
  const wsopts = {
    headers: options.headers
      ? Object.fromEntries(new Headers(options.headers))
      : undefined,
    closeTimeout: CLOSE_TIMEOUT_MS, // supported by our version of ws, but not in @types/ws yet
    ...(options.maxPayload !== undefined && { maxPayload: options.maxPayload }),
    ...(options.lookup && { lookup: options.lookup }),
  }
  const ws = new WebSocket(options.url, options.protocols, wsopts)

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
  //
  // A `timeoutMs` shorter than the interval adds a deadline per ping, so a dead
  // connection is detected `timeoutMs` after a ping rather than at the next tick.
  let heartbeatAlive = true
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  let pongTimer: ReturnType<typeof setTimeout> | undefined

  function heartbeatTimeout(): void {
    // Recorded and applied from 'close', like every other failure; terminate
    // fires that event promptly since it skips the close handshake.
    endWith(new HeartbeatTimeoutError())
    ws.terminate()
  }

  function startHeartbeat(): void {
    const { heartbeat } = options
    // On unless explicitly disabled, so a consumer that never thought about
    // liveness still gets dead-connection detection — the behavior
    // WebSocketKeepAlive had, and which its consumers relied on.
    if (heartbeat === false) return
    const intervalMs = heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
    const timeoutMs = heartbeat?.timeoutMs ?? intervalMs
    heartbeatAlive = true
    heartbeatTimer = setInterval(() => {
      if (paused) {
        heartbeatAlive = true
        return
      }
      if (!heartbeatAlive) {
        heartbeatTimeout()
        return
      }
      heartbeatAlive = false
      ws.ping()
      if (timeoutMs < intervalMs) {
        pongTimer = setTimeout(() => {
          pongTimer = undefined
          if (!heartbeatAlive && !paused) heartbeatTimeout()
        }, timeoutMs)
      }
    }, intervalMs)
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }
    if (pongTimer !== undefined) {
      clearTimeout(pongTimer)
      pongTimer = undefined
    }
  }

  // Bounds the dial, which the heartbeat (armed on open) does not cover.
  let handshakeTimer: ReturnType<typeof setTimeout> | undefined =
    options.handshakeTimeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          handshakeTimer = undefined
          endWith(new HandshakeTimeoutError())
          ws.terminate()
        }, options.handshakeTimeoutMs)

  function clearHandshakeTimer(): void {
    if (handshakeTimer !== undefined) {
      clearTimeout(handshakeTimer)
      handshakeTimer = undefined
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
    close(code, reason) {
      if (!open) return
      // Checked up front, since `ws` only throws once the socket is CLOSING.
      if (reason && Buffer.byteLength(reason) > 123) {
        throw new RangeError('The close reason must not exceed 123 bytes')
      }
      open = false
      clearHeartbeat()
      endWith(new CloseError(code, reason ?? '', false))
      closeSocket(ws, code, reason)
    },
    get protocol() {
      return ws.protocol
    },
  }

  ws.on('open', () => {
    open = true
    clearHandshakeTimer()
    startHeartbeat()
    options.onOpen(sender)
  })

  // A refused upgrade. With a listener, `ws` leaves the dial for us to end
  // instead of failing it with an `Unexpected server response: <status>` error
  // that carries the status only in its message.
  ws.on('unexpected-response', (_req, res) => {
    const headers = new Headers()
    for (let i = 0; i + 1 < res.rawHeaders.length; i += 2) {
      headers.append(res.rawHeaders[i], res.rawHeaders[i + 1])
    }
    endWith(new HandshakeRejectedError(res.statusCode ?? 0, headers))
    // Aborts the request, then fires 'error' (already superseded) and 'close'.
    ws.terminate()
  })

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
    clearHandshakeTimer()
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

  // `ws` is not limited to raising 'error' before the connection opens — a
  // mid-connection socket error raises it too — but it always follows with
  // 'close', on every path. So this only records the outcome; the 'close' handler
  // above is what settles the channel and releases the parked pull.
  ws.on('error', (err: Error) => {
    open = false
    clearHeartbeat()
    clearHandshakeTimer()
    // `ws` closes with 1009 on its own when a message exceeds `maxPayload`.
    endWith(
      (err as { code?: unknown }).code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
        ? new MessageTooBigError(options.maxPayload ?? DEFAULT_MAX_PAYLOAD)
        : new SocketError(err),
    )
  })

  function onAbort(): void {
    open = false
    clearHeartbeat()
    clearHandshakeTimer()
    endWith(options.signal.reason)
    // An abort closes politely — it is a request to stop, not a failure — and
    // the reason only picks the code: a `CloseError` names one, anything else
    // means 1000. Bounded by `closeTimeout`, so a peer that never answers
    // delays this by at most CLOSE_TIMEOUT_MS before `ws` forces the close
    // event. The 'close' handler above is what settles the channel, so a
    // consumer awaiting the end of iteration is awaiting the socket.
    //
    // The exception is a `CloseError` of 1006, which drops the socket at once.
    closeSocket(ws, closeCodeForStop(options.signal.reason))
  }

  // The signal may have aborted while the socket was being created, e.g. from
  // a caller's `lookup`, and the event won't fire again.
  if (options.signal.aborted) onAbort()
  else options.signal.addEventListener('abort', onAbort, { once: true })

  // This lets consumers treat the end of iteration as "teardown is done"
  // (resources have been released).
  const iterator = closeGuard(channel.iterator, closeController.signal)

  return {
    send: sender.send,
    close: sender.close,
    get protocol() {
      return sender.protocol
    },
    [Symbol.asyncIterator]: () => iterator,
  }
}

export const createTransport: TransportFactory = createTransportImpl
