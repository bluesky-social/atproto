import { CloseCode } from './close-codes.js'
import {
  AbnormalCloseError,
  BufferOverflowError,
  DataModeError,
  HeartbeatTimeoutError,
  IdleTimeoutError,
  SocketError,
  WebSocketConnectionError,
} from './errors.js'
import type {
  Transport,
  TransportCapabilities,
  TransportFactory,
  TransportHandlers,
} from './transport.js'
import {
  type CloseEventDetail,
  TypedEventTarget,
  type WebSocketConnectionEventMap,
} from './typed-event-target.js'

export type DataMode = 'auto' | 'text' | 'binary'

export type MessageOf<M extends DataMode> = M extends 'text'
  ? string
  : M extends 'binary'
    ? Uint8Array
    : string | Uint8Array

export interface WebSocketConnectionOptions<M extends DataMode = 'auto'> {
  protocols?: string | string[]
  dataMode?: M
  heartbeat?: { intervalMs?: number } | false
  idleTimeoutMs?: number
  highWaterMark?: number
  maxBufferedBytes?: number
  signal?: AbortSignal
  /**
   * Node only. Applied to the underlying `ws` upgrade request. Accepts a plain
   * record or a WHATWG `Headers` (normalized to a record). Ignored in the
   * browser build — the native WebSocket API has no request-header mechanism;
   * use URL/subprotocol-based auth there instead.
   */
  headers?: Record<string, string> | Headers
}

type ReadyState = 'initialized' | 'connecting' | 'open' | 'closing' | 'closed'

interface QueueItem<T> {
  value: T
  bytes: number
}

interface Waiter<T> {
  resolve: (result: IteratorResult<T>) => void
  reject: (err: unknown) => void
}

// The two terminal outcomes. `done` drains the buffer first; `error` discards it.
type Terminal = { type: 'done' } | { type: 'error'; error: unknown }

const CLEAN_CLOSE_CODES = new Set([CloseCode.Normal, CloseCode.GoingAway])

export class WebSocketConnectionEngine<M extends DataMode = 'auto'>
  extends TypedEventTarget<WebSocketConnectionEventMap>
  implements AsyncIterable<MessageOf<M>>
{
  readonly capabilities: TransportCapabilities

  private readonly transport: Transport
  private readonly dataMode: DataMode
  private readonly signal?: AbortSignal
  private onAbort?: () => void

  private state: ReadyState = 'initialized'
  private openTriggered = false
  private negotiatedProtocol = ''

  private readonly buffer: QueueItem<MessageOf<M>>[] = []
  private readonly waiters: Waiter<MessageOf<M>>[] = []
  private bufferedBytes = 0
  private terminal: Terminal | null = null
  private iterated = false

  private readonly highWaterMark: number
  private readonly maxBufferedBytes: number
  private paused = false

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatIntervalMs: number | null = null
  private heartbeatAlive = true

  private idleInterval: ReturnType<typeof setInterval> | null = null
  private idleTimeoutMs: number | null = null
  private idleActive = true

  constructor(
    createTransport: TransportFactory,
    url: string | URL,
    private readonly options: WebSocketConnectionOptions<M> = {},
  ) {
    super()
    this.dataMode = options.dataMode ?? 'auto'
    this.signal = options.signal
    this.highWaterMark = options.highWaterMark ?? 1_048_576
    this.maxBufferedBytes = options.maxBufferedBytes ?? Infinity

    this.transport = createTransport(url, {
      protocols: options.protocols,
      headers: options.headers,
    })
    this.capabilities = this.transport.capabilities
    this.transport.handlers = this.buildHandlers()

    const hb = options.heartbeat
    if (hb !== false && this.transport.capabilities.heartbeat) {
      this.heartbeatIntervalMs = hb?.intervalMs ?? 10_000
    }
    this.idleTimeoutMs = this.options.idleTimeoutMs ?? null

    if (this.signal) {
      if (this.signal.aborted) {
        // Defer so the caller can attach consumers first.
        queueMicrotask(() => this.fail(this.signal!.reason, true))
      } else {
        this.onAbort = () => this.fail(this.signal!.reason, true)
        this.signal.addEventListener('abort', this.onAbort, { once: true })
      }
    }
  }

  get readyState(): ReadyState {
    return this.state
  }

  get connected(): boolean {
    return this.state === 'open'
  }

  get protocol(): string {
    return this.negotiatedProtocol
  }

  // ---- transport handlers ----

  private buildHandlers(): TransportHandlers {
    return {
      onOpen: () => {
        if (this.terminal || this.state !== 'connecting') return
        this.state = 'open'
        this.negotiatedProtocol = this.transport.protocol
        this.dispatchEvent(new Event('open'))
        this.onOpen()
      },
      onMessage: (data, isBinary) => {
        if (this.terminal) return // post-failure discard
        this.recordLiveness()
        this.onMessage(data, isBinary)
      },
      onPong: () => {
        if (this.terminal) return
        this.recordPong()
      },
      onClose: (code, reason, wasClean) => {
        if (this.terminal) return
        if (CLEAN_CLOSE_CODES.has(code)) {
          this.state = 'closed'
          this.finishDone({ code, reason, wasClean })
        } else {
          this.fail(new AbnormalCloseError(code, reason, wasClean))
        }
      },
      onError: (err) => {
        if (this.terminal) return
        this.fail(new SocketError(err))
      },
    }
  }

  // Start the liveness timers once the socket is open.
  private onOpen(): void {
    if (this.heartbeatIntervalMs != null) {
      this.heartbeatAlive = true
      this.heartbeatInterval = setInterval(
        () => this.heartbeatTick(),
        this.heartbeatIntervalMs,
      )
      this.heartbeatInterval.unref?.()
    }
    if (this.idleTimeoutMs != null) {
      this.idleActive = true
      this.idleInterval = setInterval(() => this.idleTick(), this.idleTimeoutMs)
      this.idleInterval.unref?.()
    }
  }
  private recordLiveness(): void {
    this.heartbeatAlive = true
    this.idleActive = true
  }
  private recordPong(): void {
    this.heartbeatAlive = true
  }
  private clearTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.idleInterval) {
      clearInterval(this.idleInterval)
      this.idleInterval = null
    }
  }

  // Flag-based liveness check: each tick either finds evidence (a pong or
  // any incoming message) since the previous tick and pings again, or finds
  // none and terminates. Detection latency is therefore 1x-2x intervalMs.
  private heartbeatTick(): void {
    if (!this.heartbeatAlive) {
      this.fail(new HeartbeatTimeoutError(), true)
      return
    }
    this.heartbeatAlive = false
    this.transport.ping()
  }

  // Flag-based idle check, independent of the heartbeat timer: each tick
  // either finds evidence (an incoming message, not a pong) since the
  // previous tick and clears the flag, or finds none and terminates.
  // Detection latency is therefore 1x-2x idleTimeoutMs.
  private idleTick(): void {
    if (!this.idleActive) {
      this.fail(new IdleTimeoutError(), true)
      return
    }
    this.idleActive = false
  }

  // ---- message intake: dataMode enforcement, then buffering/watermarks ----

  private onMessage(data: string | Uint8Array, isBinary: boolean): void {
    const received = isBinary ? 'binary' : 'text'
    if (this.dataMode === 'text' && isBinary) {
      this.rejectDataMode('text', received)
      return
    }
    if (this.dataMode === 'binary' && !isBinary) {
      this.rejectDataMode('binary', received)
      return
    }
    const value = data as MessageOf<M>
    const bytes = messageBytes(data, isBinary)
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve({ value, done: false })
      return
    }
    this.buffer.push({ value, bytes })
    this.bufferedBytes += bytes
    // Hard ceiling first: crash over silent unbounded growth.
    if (this.bufferedBytes > this.maxBufferedBytes) {
      this.fail(new BufferOverflowError(this.bufferedBytes), true)
      return
    }
    // High-water mark: request the transport pause the socket.
    if (!this.paused && this.bufferedBytes > this.highWaterMark) {
      this.paused = true
      this.transport.pause()
    }
  }

  private rejectDataMode(
    expected: 'text' | 'binary',
    received: 'text' | 'binary',
  ): void {
    // Attempt a protocol-level close (unsupported data), then hard kill.
    this.transport.close(CloseCode.UnsupportedData)
    this.fail(new DataModeError(expected, received), true)
  }

  // ---- terminal transitions ----

  private dispatchClose(detail: CloseEventDetail): void {
    this.dispatchEvent(new CustomEvent('close', { detail }))
  }

  private finishDone(info: CloseEventDetail): void {
    this.terminal = { type: 'done' }
    this.clearTimers()
    this.detachSignal()
    // Deliver `done` to any pending waiters (buffer is empty when waiters exist).
    let waiter: Waiter<MessageOf<M>> | undefined
    while ((waiter = this.waiters.shift())) {
      waiter.resolve({ value: undefined as never, done: true })
    }
    this.dispatchClose(info)
  }

  private fail(error: unknown, terminateTransport = false): void {
    if (this.terminal) return
    this.terminal = { type: 'error', error }
    this.state = 'closed'
    this.clearTimers()
    this.detachSignal()
    // Discard undelivered buffered messages: never yield post-failure data.
    this.buffer.length = 0
    this.bufferedBytes = 0
    if (terminateTransport) this.transport.terminate()
    let waiter: Waiter<MessageOf<M>> | undefined
    while ((waiter = this.waiters.shift())) {
      waiter.reject(error)
    }
    this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
    this.dispatchClose(closeDetailForError(error))
  }

  private detachSignal(): void {
    if (this.signal && this.onAbort) {
      this.signal.removeEventListener('abort', this.onAbort)
      this.onAbort = undefined
    }
  }

  // ---- public methods ----

  send(data: MessageOf<M>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.state !== 'open') {
        reject(new Error('WebSocket is not open'))
        return
      }
      this.transport.send(data, (err) => (err ? reject(err) : resolve()))
    })
  }

  close(code: number = CloseCode.Normal, reason?: string): Promise<void> {
    if (this.state === 'initialized') {
      // Never opened: clean no-op teardown, no events, resolve immediately.
      this.state = 'closed'
      // Set a done terminal so an iterate-after-no-op-close resolves { done: true }
      // instead of parking a waiter that never resolves. Dispatches no events —
      // there was never a connection to close.
      this.terminal = { type: 'done' }
      this.detachSignal()
      return Promise.resolve()
    }
    if (this.state === 'closed') return Promise.resolve()
    const done = new Promise<void>((resolve) => {
      this.addEventListener('close', () => resolve(), { once: true })
    })
    if (this.state === 'connecting' || this.state === 'open') {
      this.state = 'closing'
      this.transport.close(code, reason)
    }
    return done
  }

  terminate(): void {
    // Idempotent teardown: a terminal is already settled (from a prior
    // fail()/finishDone()/terminate()), so just poke the transport again
    // and return — never double-settle the close event/waiters.
    if (this.terminal) {
      this.transport.terminate()
      return
    }
    // Self-settle synchronously (discarding the buffer) instead of waiting
    // on the transport to asynchronously echo a close/error. This keeps
    // "immediate teardown" honest across adapters: the browser adapter maps
    // terminate() to ws.close(), which can echo back a clean 1000 and would
    // otherwise route through finishDone() and deliver buffered messages —
    // contradicting "no handshake". Once this sets a terminal, that later
    // echo is a harmless no-op (fail()/finishDone() both guard on it).
    this.fail(new SocketError(new Error('WebSocket terminated')), true)
  }

  // ---- async iteration ----

  [Symbol.asyncIterator](): AsyncIterator<MessageOf<M>> {
    // Starting iteration on a connection that has already terminated (iterating
    // after close()/abort/failure) is a programmer error — surface it rather
    // than yielding an empty stream or hanging. Checked before the
    // already-iterated guard: on a dead connection there are no messages for a
    // second consumer to steal, and the terminal cause is the more useful
    // diagnosis. An error terminal rethrows its cause (same as a mid-stream
    // next() would); a clean terminal throws a descriptive error.
    if (this.terminal) {
      if (this.terminal.type === 'error') {
        throw this.terminal.error
      }
      throw new WebSocketConnectionError(
        'Cannot iterate a WebSocketConnection that has already closed',
      )
    }
    if (this.iterated) {
      throw new WebSocketConnectionError(
        'WebSocketConnection is already being iterated',
      )
    }
    this.iterated = true
    return {
      next: () => this.next(),
      return: async () => {
        // Consumer abandoned iteration: polite close.
        if (this.state === 'open' || this.state === 'connecting') {
          void this.close(CloseCode.Normal).catch(() => {})
        }
        return { value: undefined as never, done: true }
      },
    }
  }

  private triggerOpen(): void {
    if (this.openTriggered) return
    this.openTriggered = true
    // Only open if still in the pre-open state (close()/abort before the first
    // pull may have already moved us to 'closed').
    if (this.state === 'initialized') {
      this.state = 'connecting'
      this.transport.open()
    }
  }

  private next(): Promise<IteratorResult<MessageOf<M>>> {
    this.triggerOpen()
    // 1. Drain buffered messages first (even after a clean-close terminal).
    const item = this.buffer.shift()
    if (item) {
      this.bufferedBytes -= item.bytes
      this.afterDrain() // resume the transport once below the low-water mark
      return Promise.resolve({ value: item.value, done: false })
    }
    // 2. Buffer empty: honor a stored terminal.
    if (this.terminal) {
      if (this.terminal.type === 'done') {
        return Promise.resolve({ value: undefined as never, done: true })
      }
      return Promise.reject(this.terminal.error)
    }
    // 3. Otherwise park a waiter.
    return new Promise<IteratorResult<MessageOf<M>>>((resolve, reject) => {
      this.waiters.push({ resolve, reject })
    })
  }

  private afterDrain(): void {
    // Only resume once well below the high-water mark, so the transport
    // doesn't rapidly flip between paused and resumed around the threshold.
    if (this.paused && this.bufferedBytes < this.highWaterMark / 2) {
      this.paused = false
      this.transport.resume()
    }
  }
}

function closeDetailForError(error: unknown): CloseEventDetail {
  if (error instanceof AbnormalCloseError) {
    return { code: error.code, reason: error.reason, wasClean: error.wasClean }
  }
  // Codeless fatal error (SocketError / timeouts / overflow / dataMode):
  // synthesize an abnormal close, matching WHATWG's 1006 for a frame-less end.
  return { code: CloseCode.Abnormal, reason: '', wasClean: false }
}

// Byte accounting: binary counts byteLength; strings approximate via UTF-16
// code units (length * 2) — cheap, deterministic, good enough for watermarks.
function messageBytes(data: string | Uint8Array, isBinary: boolean): number {
  return isBinary
    ? (data as Uint8Array).byteLength
    : (data as string).length * 2
}
