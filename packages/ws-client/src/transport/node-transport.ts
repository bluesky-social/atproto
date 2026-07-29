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
  createMessageChannel,
} from '../message-channel.js'
import type {
  Sender,
  Transport,
  TransportFactory,
  TransportOptions,
} from './transport.js'

/**
 * Node transport, built on `ws`. Created already connecting; torn down by
 * `options.signal`. Delegates every receive-side concern (buffering,
 * watermarks, `dataMode` enforcement, idle timeout) to `createMessageChannel`
 * and wires the raw socket to it.
 *
 * Deliberately not `createWebSocketStream`: in object mode it drops the
 * `isBinary` flag needed to tell text frames from binary ones, and its
 * high-water mark counts messages rather than bytes.
 */
function createTransportImpl<M extends DataMode>(
  options: TransportOptions<M>,
): Transport<M> {
  // Mirrors the channel's own pause/resume state, purely from the hooks
  // below — the channel doesn't expose it, and the heartbeat needs to know
  // that a paused tick can't have seen a pong (or anything else) arrive.
  let paused = false

  const channel = createMessageChannel<M>({
    dataMode: options.dataMode,
    highWaterMark: options.highWaterMark,
    maxBufferedBytes: options.maxBufferedBytes,
    idleTimeoutMs: options.idleTimeoutMs,
    onPause: () => {
      paused = true
      ws.pause()
    },
    onResume: () => {
      paused = false
      ws.resume()
    },
    onAbort: (_error, code) => {
      // The channel decided the connection must end (dataMode violation,
      // byte-cap overflow, or idle timeout). Send the requested close code
      // when there is one; otherwise there's nothing clean to say, so drop
      // the connection outright.
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

  // `ws` offers permessage-deflate by default (`perMessageDeflate: true`),
  // the same compression offer a browser WebSocket sends. Leave the default
  // in place so negotiation is identical cross-platform by construction.
  const ws = new WebSocket(options.url, options.protocols, { headers })

  // Pin the default so every frame — text or binary — arrives as a single
  // Buffer. ws's RawData is `Buffer | ArrayBuffer | Buffer[]`; only
  // 'nodebuffer' guarantees a single Buffer for both frame types, which the
  // `message` listener below assumes.
  ws.binaryType = 'nodebuffer'

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

  // Flag-based heartbeat loop: each tick either found evidence of life since
  // the previous tick (any inbound message counts, not just a pong — a busy
  // connection must never be falsely killed) and pings again, or the
  // connection is dead and the channel is failed. While paused for
  // backpressure no frames arrive at all, including pongs, so a paused tick
  // refreshes the flag instead of timing out. Detection latency is therefore
  // 1x-2x the configured interval.
  //
  // Armed from the 'open' handler, never at construction: `ws.ping()` throws
  // while the socket is still CONNECTING, and a throw inside a timer callback
  // is an uncaught exception rather than a rejection — so a connect slower than
  // the interval (cold DNS, a loaded peer, TLS, a black-holed route) would take
  // the whole process down. A hung *connect* is therefore not covered by the
  // heartbeat, only a hung established connection.
  let heartbeatAlive = true
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  function startHeartbeat(): void {
    const { heartbeat } = options
    if (!heartbeat) return
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
    }, heartbeat.intervalMs)
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

  // `ws` delivers control frames (ping/pong) through their own events, not
  // 'message' — a pong alone wouldn't otherwise count as heartbeat evidence.
  ws.on('pong', () => {
    heartbeatAlive = true
  })

  ws.on('message', (data: Buffer, isBinary: boolean) => {
    // Any inbound frame is heartbeat evidence, not just a pong — a busy
    // connection sending only application data must never be falsely killed.
    heartbeatAlive = true
    if (isBinary) {
      // A view onto the Buffer without copying. The `byteOffset`/`byteLength`
      // arguments are mandatory: Node pools small Buffers into a shared
      // ArrayBuffer, so `new Uint8Array(data.buffer)` alone would silently
      // read the wrong bytes.
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
    channel.finish(detail)
    reportClose(detail)
  })

  ws.on('error', (err: Error) => {
    open = false
    clearHeartbeat()
    channel.fail(new SocketError(err))
    // A connection that fails before ever opening (e.g. connection refused)
    // emits only 'error', not 'close' — report closure from here too, but
    // the guard in reportClose() keeps it to exactly one call either way.
    reportClose(ABNORMAL_CLOSE_DETAIL)
  })

  options.signal.addEventListener(
    'abort',
    () => {
      open = false
      clearHeartbeat()
      channel.fail(options.signal.reason)
      ws.terminate()
      reportClose(ABNORMAL_CLOSE_DETAIL)
    },
    { once: true },
  )

  // The channel's iterable is handed out as-is: a connection ending is
  // reported through `onClose` (above), and the reconnect loop turns that
  // detail into a classifiable error itself. Nothing here needs to invent one.
  const iterable = channel.iterable

  return {
    send: sender.send,
    [Symbol.asyncIterator]: () => iterable[Symbol.asyncIterator](),
  }
}

export const createTransport: TransportFactory = createTransportImpl
