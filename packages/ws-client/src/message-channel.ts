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
   * wired to `ws.pause()`/`resume()`; the browser passes nothing, because the
   * WHATWG API cannot pause a socket.
   *
   * Present or absent as a unit, deliberately: a channel that could pause but
   * never resume would stall permanently, and one that tracks a "paused" state
   * it can never actually enter would suppress the idle timeout — the browser's
   * only dead-connection detector.
   */
  backpressure?: {
    /** Buffered bytes passed `highWaterMark`. */
    onPause: () => void
    /** Buffered bytes fell back below `highWaterMark / 2`. */
    onResume: () => void
  }
  /** Invoked when the channel itself decides the connection must end —
      a dataMode violation, a byte-cap overflow, or an idle timeout. The
      transport uses it to send an appropriate close code before tearing
      down. `code` is the close code to send, or undefined for none. */
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
   * Takes no detail: how the connection ended is reported by the transport's own
   * `onClose`, and duplicating it here was a second source of truth for the same
   * fact.
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

// Byte accounting: binary counts byteLength; strings approximate via UTF-16
// code units (length * 2) — cheap, deterministic, good enough for watermarks.
//
// Deliberately an over-estimate rather than a real UTF-8 measurement, which
// would cost an encode per message on the hot path. Mostly-ASCII text is
// therefore counted at roughly twice its wire size, so `highWaterMark` and
// `maxBufferedBytes` bite about twice as early for a text stream. Both are
// safety valves, so erring toward pausing (or failing) sooner is the right
// direction to be wrong in — but a caller sizing them precisely for text should
// know the units are "UTF-16 code units × 2", not bytes on the wire.
function messageBytes(data: string | Uint8Array): number {
  return typeof data === 'string' ? data.length * 2 : data.byteLength
}

// The synthetic detail for an abnormal end with no close frame (socket
// error, heartbeat/idle timeout, signal abort) — the WHATWG convention of
// 1006. Exported so the platform transports can report the same shape for
// their own frame-less failures instead of each duplicating this literal.
export const ABNORMAL_CLOSE_DETAIL: CloseEventDetail = {
  code: CloseCode.Abnormal,
  reason: '',
  wasClean: false,
}

/**
 * How a caller-supplied stop reason maps onto a close: a bare `ac.abort()`
 * (an `AbortError`) is an orderly stop and closes with 1000; a `CloseError`
 * says which code to close with; anything else is a failure and the connection
 * is destroyed rather than closed politely.
 *
 * Returns the close code to send, or `undefined` to terminate.
 */
export function closeCodeForStop(reason: unknown): number | undefined {
  if (reason instanceof CloseError) return reason.code
  // A DOMException named AbortError is what `ac.abort()` produces with no
  // argument; treat that bare "please stop" as orderly.
  //
  // Matched on shape rather than `instanceof Error`, deliberately: under a
  // module realm that differs from the one `AbortController` came from — jest's
  // ESM VM contexts being the case that caught this — the DOMException is not an
  // `instanceof` of *this* module's `Error`, and the check silently failed,
  // downgrading every graceful shutdown to a destroyed connection.
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
 * Creates the shared receive-side engine for a WebSocket client: pure logic,
 * no sockets. A transport pushes received frames in via `push()`; a single
 * consumer pulls them out via `iterable`. Owns byte-counted buffering,
 * high/low watermarks, `dataMode` enforcement, and an idle timeout — all as
 * closure state, so two platform transports (Node, browser) can share one
 * implementation instead of duplicating it.
 */
export function createMessageChannel<M extends DataMode>(
  options: MessageChannelOptions<M>,
): MessageChannel<M> {
  const dataMode: DataMode = options.dataMode
  const highWaterMark = options.highWaterMark ?? 1_048_576
  const maxBufferedBytes = options.maxBufferedBytes ?? Infinity
  const idleTimeoutMs = options.idleTimeoutMs
  const { backpressure, onAbort } = options
  // Whether this platform can actually stop the peer from sending. Node can
  // (it pauses the socket); the browser cannot. This gates the pause state
  // itself, not just the callbacks — see `idleTick`.
  const canBackpressure = backpressure != null

  const buffer: QueueItem<M>[] = []
  const waiters: Waiter<M>[] = []
  let bufferedBytes = 0
  let terminal: Terminal | null = null
  let paused = false

  // Flag-based idle check: each tick either finds evidence (a message
  // arrived since the previous tick) and clears the flag, or finds none and
  // times out. Detection latency is therefore 1x-2x idleTimeoutMs: a message
  // that arrives just after a tick resets the flag, but the timeout doesn't
  // fire until the tick after next.
  let idleActive = true
  let idleTimer: ReturnType<typeof setInterval> | null = null

  function clearIdleTimer(): void {
    if (idleTimer !== null) {
      clearInterval(idleTimer)
      idleTimer = null
    }
  }

  function idleTick(): void {
    // No messages can arrive while paused for backpressure — treat the
    // self-inflicted pause as liveness rather than false-timing-out a
    // healthy connection. The refreshed flag grants a full detection window
    // after resume.
    //
    // Only reachable when the platform can actually pause (`canBackpressure`):
    // otherwise a merely-full buffer would latch this exemption and suppress
    // the timeout entirely, which in the browser is the only dead-connection
    // detector there is.
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
    // Buffer is left intact so pull() drains it before reporting done — a
    // server-initiated clean close never discards received data. Waiters
    // only exist when the buffer is empty (push() delivers directly to a
    // waiter instead of buffering), so it's safe to settle them as done.
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

    // A message arrived: liveness evidence for the idle check, regardless
    // of whether it turns out to violate dataMode.
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

    // Hard ceiling checked before the watermark: crash over silent
    // unbounded growth rather than merely pausing on an oversized push.
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
    // Drain buffered messages first, even after a `done` terminal — a
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
    // Consumer abandoned iteration (a `break`/`return` in a `for await`): a
    // stop is a loss of interest, not a request to drain, so the buffer is
    // discarded. First-wins: a channel already ended is left as-is.
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
