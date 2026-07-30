import { CloseCode } from './lib/close-codes.js'
import {
  BufferOverflowError,
  CloseError,
  DataModeError,
  IdleTimeoutError,
} from './lib/errors.js'
import { invokeHook } from './lib/invoke-hook.js'

export type DataMode = 'auto' | 'text' | 'binary'

export type MessageOf<M extends DataMode> = M extends 'text'
  ? string
  : M extends 'binary'
    ? Uint8Array
    : string | Uint8Array

export interface CloseEventDetail {
  code: number
  reason: string
  wasClean: boolean
}

export interface MessageChannelOptions<M extends DataMode> {
  dataMode: M
  highWaterMark?: number
  maxBufferedBytes?: number
  idleTimeoutMs?: number
  /**
   * Read-side backpressure, when the platform has it. Node passes both hooks,
   * wired to `ws.pause()`/`resume()`; the browser passes nothing, since the
   * WHATWG API can't pause a socket.
   *
   * Both or neither, deliberately: a channel that could pause but never resume
   * would stall permanently, and one that tracks a "paused" state it can never
   * enter would suppress the idle timeout — the browser's only dead-connection
   * detector.
   */
  backpressure?: {
    /** Buffered bytes passed `highWaterMark`. */
    onPause: () => void
    /** Buffered bytes fell back below `highWaterMark / 2`. */
    onResume: () => void
  }
  /**
   * The channel decided the connection must end — a dataMode violation, a
   * byte-cap overflow, or an idle timeout. The transport uses this to send a
   * close code before tearing down; `code` is undefined when there's nothing
   * clean to say.
   */
  onAbort?: (error: unknown, code?: number) => void
}

export interface MessageChannel<M extends DataMode> {
  /** Single-consumer async iterable of received messages. */
  readonly iterable: AsyncIterable<MessageOf<M>, void, undefined>
  /** Feed a received frame. Binary vs text is carried by the data type. */
  push(data: string | Uint8Array): void
  /** End the channel with an error; discards undelivered buffered messages. */
  fail(error: unknown): void
  /**
   * End the channel cleanly; already-buffered messages still drain.
   *
   * Takes no detail: how the connection ended is the transport's `onClose` to
   * report, and duplicating it here was a second source of truth.
   */
  finish(): void
}

// The two terminal outcomes. `done` drains the buffer first; `error` discards it.
type Terminal = { type: 'done' } | { type: 'error'; error: unknown }

// A buffered message and its accounted size, so a drain can decrement without
// re-measuring.
interface QueueItem<M extends DataMode> {
  value: MessageOf<M>
  bytes: number
}

// A pull parked because the buffer was empty.
interface Waiter<M extends DataMode> {
  resolve: (result: IteratorResult<MessageOf<M>, void>) => void
  reject: (err: unknown) => void
}

// Byte accounting: binary counts byteLength, text approximates via UTF-16 code
// units (length * 2).
//
// An over-estimate on purpose, rather than a real UTF-8 measurement that would
// cost an encode per message on the hot path. Mostly-ASCII text is counted at
// roughly twice its wire size, so `highWaterMark` and `maxBufferedBytes` bite
// about twice as early for a text stream. Both are safety valves, so pausing (or
// failing) sooner is the right direction to be wrong in — but a caller sizing
// them for text should know the units are UTF-16 code units × 2, not wire bytes.
function messageBytes(data: string | Uint8Array): number {
  return typeof data === 'string' ? data.length * 2 : data.byteLength
}

// The detail for an abnormal end with no close frame (socket error,
// heartbeat/idle timeout, signal abort) — the WHATWG convention of 1006.
// Exported so both transports report the same shape for their own frame-less
// failures instead of each duplicating this literal.
export const ABNORMAL_CLOSE_DETAIL: CloseEventDetail = {
  code: CloseCode.Abnormal,
  reason: '',
  wasClean: false,
}

/**
 * Wraps a channel's iterator so it settles only once `closed` resolves — the
 * transport's signal that the socket's close event has fired.
 *
 * This is what lets a consumer treat the end of iteration as "teardown is done".
 * Two paths need it, both of which would otherwise settle while the socket is
 * still closing: a consumer `break` (whose `return()` only *asks* the transport
 * to close) and a failure the transport records before its close event lands.
 *
 * The wait is bounded by the transport — on Node by `ws`'s `closeTimeout`, which
 * forces the close event if a peer never answers the handshake.
 */
export function closeGuard<M extends DataMode>(
  iterable: AsyncIterable<MessageOf<M>, void, undefined>,
  closed: Promise<void>,
): AsyncIterator<MessageOf<M>, void, undefined> {
  const iterator = iterable[Symbol.asyncIterator]()
  return {
    async next(): Promise<IteratorResult<MessageOf<M>, void>> {
      try {
        const result = await iterator.next()
        // Only the terminal pull waits: a yielded message means the connection is
        // still live, and delaying data until close would deadlock the stream.
        if (result.done) await closed
        return result
      } catch (error) {
        // A rejection is the end of iteration too, so it waits the same way.
        await closed
        throw error
      }
    },
    async return(): Promise<IteratorResult<MessageOf<M>, void>> {
      // Asks the channel to stop (which asks the transport to close the socket),
      // then waits for the socket to actually be down.
      await iterator.return?.()
      await closed
      return { value: undefined, done: true }
    },
  }
}

/**
 * How a caller-supplied stop reason maps onto a close: a bare `ac.abort()` (an
 * `AbortError`) is an orderly stop and closes with 1000; a `CloseError` says
 * which code to close with; anything else is a failure, so the connection is
 * destroyed rather than closed politely.
 *
 * Returns the close code to send, or `undefined` to terminate.
 */
export function closeCodeForStop(reason: unknown): number | undefined {
  if (reason instanceof CloseError) return reason.code
  // A DOMException named AbortError is what `ac.abort()` produces with no
  // argument; treat that bare "please stop" as orderly.
  //
  // Matched on shape rather than `instanceof Error` on purpose: if the module
  // realm differs from the one `AbortController` came from — jest's ESM VM
  // contexts being the case that caught this — the DOMException isn't an
  // `instanceof` of *this* module's `Error`, so the check silently failed and
  // downgraded every graceful shutdown to a destroyed connection.
  if (
    typeof reason === 'object' &&
    reason !== null &&
    (reason as { name?: unknown }).name === 'AbortError'
  ) {
    return CloseCode.Normal
  }
  return undefined
}

/**
 * The shared receive-side engine for a WebSocket client: pure logic, no sockets.
 * A transport pushes received frames in via `push()`; a single consumer pulls
 * them out via `iterable`. Owns byte-counted buffering, high/low watermarks,
 * `dataMode` enforcement, and the idle timeout — all as closure state, so both
 * platform transports share one implementation instead of duplicating it.
 */
export function createMessageChannel<M extends DataMode>(
  options: MessageChannelOptions<M>,
): MessageChannel<M> {
  const dataMode: DataMode = options.dataMode
  const highWaterMark = options.highWaterMark ?? 1_048_576
  const maxBufferedBytes = options.maxBufferedBytes ?? Infinity
  const idleTimeoutMs = options.idleTimeoutMs
  const { backpressure, onAbort } = options
  // Whether this platform can actually stop the peer from sending: Node can (it
  // pauses the socket), the browser can't. Gates the pause state itself, not
  // just the callbacks — see `idleTick`.
  const canBackpressure = backpressure != null

  const buffer: QueueItem<M>[] = []
  const waiters: Waiter<M>[] = []
  let bufferedBytes = 0
  let terminal: Terminal | null = null
  let paused = false

  // Flag-based idle check: each tick either finds evidence (a message arrived
  // since the last tick) and clears the flag, or finds none and times out.
  // Detection latency is therefore 1x-2x idleTimeoutMs — a message arriving just
  // after a tick resets the flag, so the timeout waits for the tick after next.
  let idleActive = true
  let idleTimer: ReturnType<typeof setInterval> | null = null

  function clearIdleTimer(): void {
    if (idleTimer !== null) {
      clearInterval(idleTimer)
      idleTimer = null
    }
  }

  function idleTick(): void {
    // No messages can arrive while paused for backpressure, so count the
    // self-inflicted pause as liveness rather than false-timing-out a healthy
    // connection. Refreshing the flag grants a full window after resume.
    //
    // Only reachable when the platform can actually pause (`canBackpressure`).
    // Otherwise a merely-full buffer would latch this exemption and suppress the
    // timeout, which in the browser is the only dead-connection detector.
    if (paused) {
      idleActive = true
      return
    }
    if (!idleActive) {
      const error = new IdleTimeoutError()
      fail(error)
      invokeHook(onAbort, error)
      return
    }
    idleActive = false
  }

  if (idleTimeoutMs != null) {
    idleTimer = setInterval(idleTick, idleTimeoutMs)
    idleTimer.unref?.()
  }

  function rejectWaiters(error: unknown): void {
    let waiter: Waiter<M> | undefined
    while ((waiter = waiters.shift())) {
      waiter.reject(error)
    }
  }

  function resolveWaitersDone(): void {
    let waiter: Waiter<M> | undefined
    while ((waiter = waiters.shift())) {
      waiter.resolve({ value: undefined as never, done: true })
    }
  }

  function fail(error: unknown): void {
    if (terminal) return
    terminal = { type: 'error', error }
    clearIdleTimer()
    // Discard undelivered buffered messages: never yield post-failure data.
    buffer.length = 0
    bufferedBytes = 0
    rejectWaiters(error)
  }

  function finish(): void {
    if (terminal) return
    terminal = { type: 'done' }
    clearIdleTimer()
    // Leave the buffer intact so pull() drains it before reporting done: a
    // server-initiated clean close never discards received data. Waiters only
    // exist when the buffer is empty (push() delivers straight to a waiter
    // instead of buffering), so settling them as done is safe.
    resolveWaitersDone()
  }

  function afterDrain(): void {
    // Only resume once well below the high-water mark, so the caller isn't
    // rapidly flipped between paused and resumed around the threshold.
    if (paused && bufferedBytes < highWaterMark / 2) {
      paused = false
      invokeHook(backpressure?.onResume)
    }
  }

  function push(data: string | Uint8Array): void {
    // Drop after a terminal: the channel has already ended.
    if (terminal) return

    // A message arrived: liveness evidence for the idle check, even if it turns
    // out to violate dataMode.
    idleActive = true

    const received = typeof data === 'string' ? 'text' : 'binary'
    if (dataMode !== 'auto' && dataMode !== received) {
      const error = new DataModeError(dataMode, received)
      fail(error)
      invokeHook(onAbort, error, CloseCode.UnsupportedData)
      return
    }

    const value = data as MessageOf<M>
    const waiter = waiters.shift()
    if (waiter) {
      waiter.resolve({ value, done: false })
      return
    }

    const bytes = messageBytes(data)
    buffer.push({ value, bytes })
    bufferedBytes += bytes

    // Hard ceiling checked before the watermark: fail rather than merely pause
    // on an oversized push, since silent unbounded growth is worse.
    if (bufferedBytes > maxBufferedBytes) {
      const error = new BufferOverflowError(bufferedBytes)
      fail(error)
      invokeHook(onAbort, error)
      return
    }

    if (canBackpressure && !paused && bufferedBytes > highWaterMark) {
      paused = true
      invokeHook(backpressure.onPause)
    }
  }

  function pull(): Promise<IteratorResult<MessageOf<M>, void>> {
    // Drain buffered messages first, even after a `done` terminal: a
    // server-initiated clean close never drops received data.
    const item = buffer.shift()
    if (item) {
      bufferedBytes -= item.bytes
      afterDrain()
      return Promise.resolve({ value: item.value, done: false })
    }
    if (terminal) {
      if (terminal.type === 'done') {
        return Promise.resolve({ value: undefined as never, done: true })
      }
      return Promise.reject(terminal.error)
    }
    return new Promise<IteratorResult<MessageOf<M>, void>>(
      (resolve, reject) => {
        waiters.push({ resolve, reject })
      },
    )
  }

  function iteratorReturn(): Promise<IteratorResult<MessageOf<M>, void>> {
    // The consumer abandoned iteration (a `break`/`return` in a `for await`).
    // Stopping is a loss of interest, not a request to drain, so discard the
    // buffer. First-wins: a channel that already ended is left as-is.
    if (!terminal) {
      terminal = { type: 'done' }
      clearIdleTimer()
      buffer.length = 0
      bufferedBytes = 0
      resolveWaitersDone()
      invokeHook(onAbort, undefined, CloseCode.Normal)
    }
    return Promise.resolve({ value: undefined as never, done: true })
  }

  const iterable: AsyncIterable<MessageOf<M>, void, undefined> = {
    [Symbol.asyncIterator]() {
      return {
        next: () => pull(),
        return: () => iteratorReturn(),
      }
    },
  }

  return {
    iterable,
    push,
    fail,
    finish,
  }
}
