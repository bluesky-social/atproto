import { CloseCode } from './lib/close-codes.js'
import {
  BufferOverflowError,
  CloseError,
  DataModeError,
  IdleTimeoutError,
  WebSocketConnectionError,
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
  /** Called when buffered bytes pass highWaterMark. Node pauses its socket
      here; the browser supplies neither hook and relies on the byte cap. */
  onPause?: () => void
  /** Called once buffered bytes fall back below highWaterMark / 2. */
  onResume?: () => void
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
  /** End the channel cleanly; already-buffered messages still drain. */
  finish(detail: CloseEventDetail): void
  /** Close detail once ended; undefined before that. */
  readonly closeDetail: CloseEventDetail | undefined
}

// The two terminal outcomes. `done` drains the buffer first; `error` discards it.
type Terminal = { type: 'done' } | { type: 'error'; error: unknown }

// Byte accounting: binary counts byteLength; strings approximate via UTF-16
// code units (length * 2) — cheap, deterministic, good enough for watermarks.
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

// A codeless failure (overflow / dataMode / idle timeout / any foreign
// error) synthesizes an abnormal close, matching WHATWG's 1006 for a
// frame-less end. A `CloseError` (a real close frame the transport
// observed) carries its own detail through instead.
function closeDetailForError(error: unknown): CloseEventDetail {
  if (error instanceof CloseError) {
    return { code: error.code, reason: error.reason, wasClean: error.wasClean }
  }
  return ABNORMAL_CLOSE_DETAIL
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
  type Msg = MessageOf<M>
  interface QueueItem {
    value: Msg
    bytes: number
  }
  interface Waiter {
    resolve: (result: IteratorResult<Msg, void>) => void
    reject: (err: unknown) => void
  }

  const dataMode: DataMode = options.dataMode
  const highWaterMark = options.highWaterMark ?? 1_048_576
  const maxBufferedBytes = options.maxBufferedBytes ?? Infinity
  const idleTimeoutMs = options.idleTimeoutMs
  const { onPause, onResume, onAbort } = options

  const buffer: QueueItem[] = []
  const waiters: Waiter[] = []
  let bufferedBytes = 0
  let terminal: Terminal | null = null
  let paused = false
  let closeDetail: CloseEventDetail | undefined

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
    let waiter: Waiter | undefined
    while ((waiter = waiters.shift())) {
      waiter.reject(error)
    }
  }

  function resolveWaitersDone(): void {
    let waiter: Waiter | undefined
    while ((waiter = waiters.shift())) {
      waiter.resolve({ value: undefined as never, done: true })
    }
  }

  function fail(error: unknown): void {
    if (terminal) return
    terminal = { type: 'error', error }
    closeDetail = closeDetailForError(error)
    clearIdleTimer()
    // Discard undelivered buffered messages: never yield post-failure data.
    buffer.length = 0
    bufferedBytes = 0
    rejectWaiters(error)
  }

  function finish(detail: CloseEventDetail): void {
    if (terminal) return
    terminal = { type: 'done' }
    closeDetail = detail
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
      invokeHook(onResume)
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

    const value = data as Msg
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

    if (!paused && bufferedBytes > highWaterMark) {
      paused = true
      invokeHook(onPause)
    }
  }

  function pull(): Promise<IteratorResult<Msg, void>> {
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
    return new Promise<IteratorResult<Msg, void>>((resolve, reject) => {
      waiters.push({ resolve, reject })
    })
  }

  function iteratorReturn(): Promise<IteratorResult<Msg, void>> {
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

  const iterable: AsyncIterable<Msg, void, undefined> = {
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
    get closeDetail() {
      return closeDetail
    },
  }
}

/**
 * Adapts a channel's iterable to a *transport's* iteration contract: every
 * way the connection itself ends must reach the consumer as an error, even a
 * clean close. The channel reports a clean `finish()` as a plain `done: true`
 * — the right internal representation — but a transport's consumer needs to
 * know *why* iteration stopped, and the reconnect policy above classifies by
 * close code. Only an error can carry one.
 *
 * A consumer-initiated stop is the exception: `break`ing a `for await`, or
 * calling `return()` directly, is the consumer's own decision and completes
 * normally. Crucially that has to stay true for any *later* pull as well —
 * `yield* transport` can pull again after a downstream `return()` propagates,
 * and turning that into a retryable error would trigger a spurious reconnect.
 *
 * Shared here rather than written per-transport: the logic is entirely
 * platform-neutral, and two copies that must stay behaviorally identical is
 * exactly the divergence risk this module exists to remove.
 */
export function toTransportIterable<M extends DataMode>(
  channel: MessageChannel<M>,
): AsyncIterable<MessageOf<M>, void, undefined> {
  return {
    [Symbol.asyncIterator]() {
      const inner = channel.iterable[Symbol.asyncIterator]()
      let consumerStopped = false
      return {
        async next() {
          const result = await inner.next()
          if (!result.done) return result
          // Precedence: a terminal the *connection* already reached wins over
          // a later consumer stop. The channel records a close detail only
          // for a real ending (close frame, socket error, timeout), never for
          // a consumer stop — so its presence means the connection ended on
          // its own and the consumer deserves that cause, even if it has
          // since stopped listening. Absent a detail, a stopped consumer gets
          // the clean completion it asked for; anything else is a connection
          // that ended with nothing to say about it.
          const detail = channel.closeDetail
          if (detail) {
            throw new CloseError(detail.code, detail.reason, detail.wasClean)
          }
          if (consumerStopped) return { value: undefined, done: true }
          // Unreachable under the channel's contract: the only `done` terminal
          // that records no close detail is the consumer's own return(), which
          // sets the flag above. Assert it rather than guessing — and note the
          // error is deliberately non-retryable, so an invariant violation
          // fails fast instead of driving an endless reconnect loop.
          throw new WebSocketConnectionError(
            'WebSocket iteration ended with neither a close detail nor a consumer stop',
          )
        },
        async return() {
          consumerStopped = true
          await inner.return?.()
          return { value: undefined, done: true }
        },
      }
    },
  }
}
