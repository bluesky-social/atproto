import { WebSocket } from 'ws'
import {
  HeartbeatTimeoutError,
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

  ws.on('open', () => {
    open = true
    startHeartbeat()
    options.onOpen(sender)
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

  // This lets consumers treat the end of iteration as "teardown is done"
  // (resources have been released).
  const iterator = closeGuard(channel.iterator, closeController.signal)

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => iterator,
  }
}

export const createTransport: TransportFactory = createTransportImpl
