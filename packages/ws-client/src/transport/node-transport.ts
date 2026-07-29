import { WebSocket } from 'ws'
import { CloseCode } from '../lib/close-codes.js'
import {
  HeartbeatTimeoutError,
  SocketError,
  WebSocketConnectionError,
} from '../lib/errors.js'
import {
  ABNORMAL_CLOSE_DETAIL,
  type CloseEventDetail,
  type DataMode,
  closeCodeForStop,
  createMessageChannel,
} from '../message-channel.js'
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  type Sender,
  type Transport,
  type TransportFactory,
  type TransportOptions,
} from './transport.js'

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
      // Send the close code the channel asked for; with no code there's nothing
      // clean to say, so drop the connection outright.
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
  const ws = new WebSocket(options.url, options.protocols, { headers })

  // Pin the default so every frame, text or binary, arrives as a single Buffer.
  // ws's RawData is `Buffer | ArrayBuffer | Buffer[]`, and only 'nodebuffer'
  // guarantees the single Buffer the `message` listener below assumes.
  ws.binaryType = 'nodebuffer'

  let open = false
  let closeReported = false

  function reportClose(detail: CloseEventDetail): void {
    if (closeReported) return
    closeReported = true
    options.onClose(detail)
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
        channel.fail(new HeartbeatTimeoutError())
        ws.terminate()
        reportClose(ABNORMAL_CLOSE_DETAIL)
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
    send: (data) =>
      new Promise<void>((resolve, reject) => {
        if (!open) {
          reject(new WebSocketConnectionError('WebSocket is not open'))
          return
        }
        ws.send(data, (err) => (err ? reject(new SocketError(err)) : resolve()))
      }),
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

  ws.on('close', (code: number, reason: Buffer) => {
    open = false
    clearHeartbeat()
    const detail: CloseEventDetail = {
      code,
      reason: reason.toString('utf8'),
      wasClean: code === CloseCode.Normal,
    }
    channel.finish()
    reportClose(detail)
  })

  ws.on('error', (err: Error) => {
    open = false
    clearHeartbeat()
    channel.fail(new SocketError(err))
    // A connection that fails before ever opening (connection refused, say)
    // emits only 'error', never 'close', so report the closure from here too.
    // The guard in reportClose() keeps it to exactly one call either way.
    reportClose(ABNORMAL_CLOSE_DETAIL)
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      clearHeartbeat()
      channel.fail(options.signal.reason)
      // How the stop was requested decides how the socket ends: a bare abort
      // closes politely at 1000, a CloseError closes with its code, anything else
      // is a failure that destroys the connection. On the polite paths the real
      // close event carries the detail, which is why nothing is reported here.
      const code = closeCodeForStop(options.signal.reason)
      if (code !== undefined) {
        ws.close(code)
        return
      }
      ws.terminate()
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

export const createTransport: TransportFactory = createTransportImpl
