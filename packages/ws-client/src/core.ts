import {
  AbnormalCloseError,
  BufferOverflowError,
  SocketError,
  WebSocketCoreError,
} from './errors.js'
import type {
  Transport,
  TransportCapabilities,
  TransportFactory,
  TransportHandlers,
} from './transport.js'

export type DataMode = 'auto' | 'text' | 'binary'

export type MessageOf<M extends DataMode> = M extends 'text'
  ? string
  : M extends 'binary'
    ? Uint8Array
    : string | Uint8Array

export interface CloseInfo {
  code: number
  reason: string
}

export interface WebSocketCoreOptions<M extends DataMode = 'auto'> {
  protocols?: string | string[]
  dataMode?: M
  heartbeat?: { intervalMs?: number } | false
  idleTimeoutMs?: number
  highWaterMark?: number
  maxBufferedBytes?: number
  signal?: AbortSignal
}

type ReadyState = 'connecting' | 'open' | 'closing' | 'closed'

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

const CLEAN_CLOSE_CODES = new Set([1000, 1001])

export class WebSocketCoreEngine<M extends DataMode = 'auto'>
  implements AsyncIterable<MessageOf<M>>
{
  readonly capabilities: TransportCapabilities

  private readonly transport: Transport
  private readonly dataMode: DataMode
  private readonly signal?: AbortSignal
  private onAbort?: () => void

  private state: ReadyState = 'connecting'
  private negotiatedProtocol = ''

  private readonly buffer: QueueItem<MessageOf<M>>[] = []
  private readonly waiters: Waiter<MessageOf<M>>[] = []
  private bufferedBytes = 0
  private terminal: Terminal | null = null
  private iterated = false

  private readonly highWaterMark: number
  private readonly maxBufferedBytes: number
  private paused = false

  private resolveOpened!: () => void
  private rejectOpened!: (err: unknown) => void
  private resolveClosed!: (info: CloseInfo) => void
  private rejectClosed!: (err: unknown) => void
  readonly opened: Promise<void>
  readonly closed: Promise<CloseInfo>

  constructor(
    createTransport: TransportFactory,
    url: string | URL,
    private readonly options: WebSocketCoreOptions<M> = {},
  ) {
    this.dataMode = options.dataMode ?? 'auto'
    this.signal = options.signal
    this.highWaterMark = options.highWaterMark ?? 1_048_576
    this.maxBufferedBytes = options.maxBufferedBytes ?? Infinity

    this.opened = new Promise<void>((resolve, reject) => {
      this.resolveOpened = resolve
      this.rejectOpened = reject
    })
    this.closed = new Promise<CloseInfo>((resolve, reject) => {
      this.resolveClosed = resolve
      this.rejectClosed = reject
    })
    // Pre-attach no-op handlers so non-observers never trigger unhandled
    // rejection warnings.
    this.opened.catch(() => {})
    this.closed.catch(() => {})

    this.transport = createTransport(url, options.protocols)
    this.capabilities = this.transport.capabilities
    this.transport.handlers = this.buildHandlers()

    if (this.signal) {
      if (this.signal.aborted) {
        // Defer so the caller can attach consumers first.
        queueMicrotask(() => this.fail(this.signal!.reason, true))
      } else {
        this.onAbort = () => this.fail(this.signal!.reason, true)
        this.signal.addEventListener('abort', this.onAbort, { once: true })
      }
    }

    // Retained for later tasks and referenced here to satisfy noUnusedLocals
    // until then: `dataMode` is enforced in Task 6; `options` carries the
    // heartbeat/idleTimeoutMs (Tasks 7–8) settings consumed by the hooks
    // above.
    void this.dataMode
    void this.options
  }

  get readyState(): ReadyState {
    return this.state
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
        this.resolveOpened()
        this.onOpen() // Tasks 7–8 start timers here
      },
      onMessage: (data, isBinary) => {
        if (this.terminal) return // post-failure discard
        this.recordLiveness() // Tasks 7–8
        this.onMessage(data, isBinary)
      },
      onPong: () => {
        if (this.terminal) return
        this.recordPong() // Task 7
      },
      onClose: (code, reason, wasClean) => {
        if (this.terminal) return
        if (CLEAN_CLOSE_CODES.has(code)) {
          this.state = 'closed'
          this.finishDone()
          this.resolveClosed({ code, reason })
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

  // Hooks overridden/extended by later tasks. Base implementations here.
  private onOpen(): void {
    // Tasks 7–8: start heartbeat & idle timers.
  }
  private recordLiveness(): void {
    // Tasks 7–8: heartbeat + idle liveness flags.
  }
  private recordPong(): void {
    // Task 7: heartbeat liveness flag (pong only).
  }
  private clearTimers(): void {
    // Tasks 7–8: clear heartbeat & idle intervals.
  }

  // ---- message intake (Task 5 adds watermarks, Task 6 adds dataMode) ----

  private onMessage(data: string | Uint8Array, isBinary: boolean): void {
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

  // ---- terminal transitions ----

  private finishDone(): void {
    this.terminal = { type: 'done' }
    this.clearTimers()
    this.detachSignal()
    // Deliver `done` to any pending waiters (buffer is empty when waiters exist).
    let waiter: Waiter<MessageOf<M>> | undefined
    while ((waiter = this.waiters.shift())) {
      waiter.resolve({ value: undefined as never, done: true })
    }
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
    this.rejectOpened(error)
    this.rejectClosed(error)
    let waiter: Waiter<MessageOf<M>> | undefined
    while ((waiter = this.waiters.shift())) {
      waiter.reject(error)
    }
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

  close(code = 1000, reason?: string): Promise<void> {
    if (this.state === 'connecting' || this.state === 'open') {
      this.state = 'closing'
      this.transport.close(code, reason)
    }
    return this.closed.then(() => undefined)
  }

  terminate(): void {
    this.state = 'closed'
    this.clearTimers()
    this.transport.terminate()
  }

  // ---- async iteration ----

  [Symbol.asyncIterator](): AsyncIterator<MessageOf<M>> {
    if (this.iterated) {
      throw new WebSocketCoreError('WebSocketCore is already being iterated')
    }
    this.iterated = true
    return {
      next: () => this.next(),
      return: async () => {
        // Consumer abandoned iteration: polite close.
        if (this.state === 'open' || this.state === 'connecting') {
          void this.close(1000).catch(() => {})
        }
        return { value: undefined as never, done: true }
      },
    }
  }

  private next(): Promise<IteratorResult<MessageOf<M>>> {
    // 1. Drain buffered messages first (even after a clean-close terminal).
    const item = this.buffer.shift()
    if (item) {
      this.bufferedBytes -= item.bytes
      this.afterDrain() // Task 5: resume below low-water mark
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
    // Hysteresis: only resume once well below the high-water mark.
    if (this.paused && this.bufferedBytes < this.highWaterMark / 2) {
      this.paused = false
      this.transport.resume()
    }
  }
}

// Byte accounting: binary counts byteLength; strings approximate via UTF-16
// code units (length * 2) — cheap, deterministic, good enough for watermarks.
function messageBytes(data: string | Uint8Array, isBinary: boolean): number {
  return isBinary ? (data as Uint8Array).byteLength : (data as string).length * 2
}
