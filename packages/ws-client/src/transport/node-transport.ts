import { type ClientOptions, WebSocket } from 'ws'
import { CloseCode } from '../lib/close-codes.js'
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
    onAbort: (_error, code) => {
      // Send the close code the channel asked for. Missing code here indicates the connection should be dropped outright.
      if (code !== undefined) {
        ws.close(code)
      } else {
        ws.terminate()
      }
    },
  })

  const headers = options.headers
    ? Object.fromEntries(new Headers(options.headers))
    : undefined

  // `ws` offers permessage-deflate by default, the same compression a browser
  // WebSocket offers. Leaving the default in place makes negotiation identical
  // cross-platform by construction.
  //
  // `closeTimeout` bounds the polite-close handshake: if the peer never answers
  // our close frame, `ws` destroys the socket and fires 'close' after this long
  // (its default is 30s — far too long for a shutdown path to wait). The option
  // is typed via the intersection because @types/ws lags ws 8.19, which
  // introduced it.
  const ws = new WebSocket(options.url, options.protocols, {
    headers,
    closeTimeout: CLOSE_TIMEOUT_MS,
  } as ClientOptions & { closeTimeout: number })

  // Pin the default so every frame, text or binary, arrives as a single Buffer.
  ws.binaryType = 'nodebuffer'

  let open = false
  let closeReported = false

  function reportClose(detail: CloseEventDetail): void {
    if (closeReported) return
    closeReported = true
    options.onClose(detail)
  }

  // Resolves once the socket's close event has fired — the transport's proof
  // that teardown finished. `closeGuard` below hands that guarantee to the
  // consumer: iteration doesn't settle until the socket is really down.
  let markClosed!: () => void
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve
  })

  // The error that ended this connection, recorded the moment teardown begins
  // and applied to the channel from the 'close' handler. Deferring it that way
  // is what makes a pull settle *after* the socket closed rather than racing
  // it. Wrapped in an object so a recorded `undefined` reason is still a
  // recorded failure.
  let pendingError: { error: unknown } | undefined
  function endWith(error: unknown): void {
    pendingError ??= { error }
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
    // liveness still gets dead-connection detection. WebSocketKeepAlive behaved
    // this way and every consumer in this repo relied on it.
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
    heartbeatTimer.unref?.()
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }
  }

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

  // The one place a connection ends. `ws` fires 'close' on every teardown path —
  // a peer's close frame, our own close() or terminate(), a failed dial, even a
  // socket error (verified across all four) — so settling the channel here, and
  // only here, is what guarantees the consumer's iteration outlives the socket.
  ws.on('close', (code: number, reason: Buffer) => {
    open = false
    clearHeartbeat()
    if (pendingError) {
      // Teardown began with a failure (a socket error, a liveness timeout, an
      // aborted signal): report it now that the socket is actually down.
      channel.fail(pendingError.error)
      reportClose(ABNORMAL_CLOSE_DETAIL)
    } else {
      channel.finish()
      reportClose({
        code,
        reason: reason.toString('utf8'),
        wasClean: code === CloseCode.Normal,
      })
    }
    // Last, so `onClose` has already run by the time any pull parked in
    // `closeGuard` resumes: a consumer that reaches the end of iteration is
    // guaranteed the close was both reported and complete.
    markClosed()
  })

  ws.on('error', (err: Error) => {
    open = false
    clearHeartbeat()
    // Recorded, not applied: 'close' always follows 'error' and applies it.
    endWith(new SocketError(err))
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      clearHeartbeat()
      endWith(options.signal.reason)
      // How the stop was requested decides how the socket ends: a bare abort
      // closes politely at 1000, a CloseError closes with its code, anything else
      // is a failure that destroys the connection. Either way the 'close' handler
      // above is what settles the channel, so a consumer awaiting the end of
      // iteration is awaiting the socket.
      const code = closeCodeForStop(options.signal.reason)
      if (code !== undefined) {
        // Bounded by `closeTimeout`: a peer that never answers can delay this by
        // at most CLOSE_TIMEOUT_MS before `ws` forces the close event.
        ws.close(code)
      } else {
        ws.terminate()
      }
    },
    { once: true },
  )

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => closeGuard(channel.iterable, closed),
  }
}

export const createTransport: TransportFactory = createTransportImpl
