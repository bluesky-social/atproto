import {
  type CloseInfo,
  type DataMode,
  type MessageOf,
  type WebSocketCoreOptions,
  WebSocketCoreEngine,
} from './core.js'
import { AbnormalCloseError } from './errors.js'
import { backoffMs, defaultShouldReconnect } from './reconnect-policy.js'

export type Awaitable<T> = T | Promise<T>

export type CoreFactory = <M extends DataMode>(
  url: string | URL,
  options: WebSocketCoreOptions<M>,
) => WebSocketCoreEngine<M>

export interface ReconnectingOptions<M extends DataMode = 'auto'> {
  protocols?: string | string[]
  dataMode?: M
  /**
   * Node only. Applied to the underlying `ws` connection. Accepts a plain
   * record or a WHATWG `Headers`. Ignored in the browser build — the native
   * WebSocket API has no request-header mechanism; use URL/subprotocol auth.
   */
  headers?: Record<string, string> | Headers
  heartbeat?: { intervalMs?: number } | false
  /**
   * Forwarded to core. Doubles as the browser's dead-connection detector where
   * protocol heartbeat is unavailable (`capabilities.heartbeat === false`): an
   * elapsed idle window fails the connection and triggers a reconnect. Best for
   * chatty protocols (e.g. a firehose).
   */
  idleTimeoutMs?: number
  highWaterMark?: number
  /**
   * Forwarded to core. Doubles as the browser's backpressure backstop where
   * real read-side backpressure is unavailable (`capabilities.pauseResume ===
   * false`): exceeding this ceiling fails the connection with
   * BufferOverflowError (a reconnect trigger) rather than buffering unbounded.
   */
  maxBufferedBytes?: number
  /** Exponential-backoff ceiling in seconds. Default 64. */
  maxReconnectSeconds?: number
  /** Abort to end the reconnect loop permanently. */
  signal?: AbortSignal
  /** Fired after each successful (re)open. `reconnect` is false on the first. */
  onOpen?: (info: { reconnect: boolean }) => void
  /** Fired when a connection ends with an error. */
  onError?: (
    error: unknown,
    info: { willReconnect: boolean; attempt: number },
  ) => void
  /** Override the default reconnect classification. */
  shouldReconnect?: (error: unknown, attempt: number) => boolean
}

export type NodeReconnectingOptions<M extends DataMode = 'auto'> =
  ReconnectingOptions<M>
export type BrowserReconnectingOptions<M extends DataMode = 'auto'> = Omit<
  ReconnectingOptions<M>,
  'headers'
>

type ReadyState = 'connecting' | 'open' | 'closing' | 'closed'

export class ReconnectingWebSocketBase<M extends DataMode = 'auto'>
  implements AsyncIterable<MessageOf<M>>
{
  private core: WebSocketCoreEngine<M> | null = null
  private state: ReadyState = 'connecting'
  private stopped = false
  private iterated = false

  constructor(
    private readonly createCore: CoreFactory,
    private readonly url: string | URL | (() => Awaitable<string | URL>),
    private readonly options: ReconnectingOptions<M> = {},
  ) {}

  get readyState(): ReadyState {
    return this.state
  }

  get connected(): boolean {
    return this.core?.readyState === 'open'
  }

  send(data: MessageOf<M>): Promise<void> {
    if (!this.core || this.core.readyState !== 'open') {
      return Promise.reject(new Error('WebSocket is not connected'))
    }
    return this.core.send(data)
  }

  async close(code = 1000, reason?: string): Promise<void> {
    this.stopped = true
    this.state = 'closing'
    if (this.core) {
      await this.core.close(code, reason)
    }
    this.state = 'closed'
  }

  private resolveUrl(): Awaitable<string | URL> {
    return typeof this.url === 'function' ? this.url() : this.url
  }

  private coreOptions(): WebSocketCoreOptions<M> {
    const o = this.options
    return {
      protocols: o.protocols,
      dataMode: o.dataMode,
      headers: o.headers,
      heartbeat: o.heartbeat,
      idleTimeoutMs: o.idleTimeoutMs,
      highWaterMark: o.highWaterMark,
      maxBufferedBytes: o.maxBufferedBytes,
      // NB: no `signal` here — the reconnect loop owns lifecycle; aborting the
      // per-connection core would look like a transport failure and reconnect.
      // The loop watches this.options.signal itself (see below).
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<MessageOf<M>> {
    if (this.iterated) {
      throw new Error('ReconnectingWebSocket is already being iterated')
    }
    this.iterated = true

    const maxMs = 1000 * (this.options.maxReconnectSeconds ?? 64)
    const shouldReconnect =
      this.options.shouldReconnect ??
      ((error: unknown) => defaultShouldReconnect(error))

    // `retries` is the count of consecutive failed connections since the last
    // successful open (reset to 0 in the `opened` callback below). `retries ===
    // 0` means the upcoming attempt is either the first attempt after a stable
    // open or the very first connect — both are "fast" (<=1s). It escalates
    // with `backoffMs` only across repeated failures with no open in between.
    let retries = 0
    let firstAttempt = true // true until the first connection is created
    let firstOpen = true // true until the first successful open (onOpen flag)

    const signal = this.options.signal
    // End the loop promptly on external abort.
    if (signal?.aborted) throw signal.reason

    while (!this.stopped) {
      if (signal?.aborted) throw signal.reason

      if (!firstAttempt) {
        // Fast first reconnect (attempt 0); exponential backoff afterwards.
        const waitMs =
          retries === 0 ? Math.min(1000, maxMs) : backoffMs(retries, maxMs)
        await sleep(waitMs, signal) // rejects with signal.reason on abort
        if (this.stopped) break
        // Escalate the delay for the *next* consecutive failure. Reset to 0
        // happens on open, so the first reconnect after a stable open is fast.
        retries++
      }
      firstAttempt = false

      const url = await this.resolveUrl()
      const core = this.createCore<M>(url, this.coreOptions())
      this.core = core
      this.state = 'connecting'

      // Wire the external signal to terminate the current core.
      const onAbort = () => core.terminate()
      signal?.addEventListener('abort', onAbort, { once: true })

      let cleanClose: CloseInfo | null = null
      try {
        core.opened
          .then(() => {
            this.state = 'open'
            retries = 0 // stable open: next reconnect is fast again
            this.options.onOpen?.({ reconnect: !firstOpen })
            firstOpen = false
          })
          .catch(() => {})

        for await (const msg of core) {
          yield msg
        }
        // Clean iterator completion (1000/1001). Read the code to classify.
        cleanClose = await core.closed
      } catch (error) {
        signal?.removeEventListener('abort', onAbort)
        // Abort surfaces to the consumer as a rejection (the terminated core
        // throws a transport error, which we replace with the abort reason).
        if (signal?.aborted) throw signal.reason
        // Consumer-initiated close(): end quietly, no reconnect.
        if (this.stopped) break
        const willReconnect = shouldReconnect(error, retries)
        this.options.onError?.(error, { willReconnect, attempt: retries })
        if (!willReconnect) {
          this.state = 'closed'
          throw error
        }
        this.state = 'connecting'
        continue
      }
      signal?.removeEventListener('abort', onAbort)

      if (this.stopped) break
      if (signal?.aborted) throw signal.reason

      // Clean close: 1000 stops; 1001 (and any non-fatal clean code) reconnects.
      // Only 1000/1001 arrive here (core ends cleanly only for those); 1000 is
      // fatal, 1001 reconnects. Reuse `shouldReconnect` via a synthetic
      // AbnormalCloseError so an override applies uniformly to clean codes too.
      const code = cleanClose?.code ?? 1000
      const reconnectClean =
        code !== 1000 &&
        shouldReconnect(
          new AbnormalCloseError(code, cleanClose?.reason ?? '', true),
          retries,
        )
      if (!reconnectClean) {
        this.state = 'closed'
        break
      }
      this.state = 'connecting'
    }
    this.state = 'closed'
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal!.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    // Node: don't keep the process alive on the backoff timer.
    ;(timer as { unref?: () => void }).unref?.()
  })
}
