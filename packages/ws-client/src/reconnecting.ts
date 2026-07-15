import type {
  DataMode,
  MessageOf,
  WebSocketCoreEngine,
  WebSocketCoreOptions,
} from './core.js'
import { AbnormalCloseError } from './errors.js'
import { backoffMs, defaultShouldReconnect } from './reconnect-policy.js'
import {
  type CloseEventDetail,
  type ReconnectingEventMap,
  TypedEventTarget,
} from './typed-event-target.js'

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
  /** Override the default reconnect classification. */
  shouldReconnect?: (error: unknown, attempt: number) => boolean
}

export type NodeReconnectingOptions<M extends DataMode = 'auto'> =
  ReconnectingOptions<M>
export type BrowserReconnectingOptions<M extends DataMode = 'auto'> = Omit<
  ReconnectingOptions<M>,
  'headers'
>

type ReadyState = 'initialized' | 'connecting' | 'open' | 'closing' | 'closed'

export class ReconnectingWebSocketBase<M extends DataMode = 'auto'>
  extends TypedEventTarget<ReconnectingEventMap>
  implements AsyncIterable<MessageOf<M>>
{
  private core: WebSocketCoreEngine<M> | null = null
  private state: ReadyState = 'initialized'
  private stopped = false
  private iterated = false
  // Internal wake signal for close(): lets a parked backoff `sleep` resolve
  // (not reject) promptly instead of waiting out the full backoff window.
  // Distinct from `options.signal`, which is the caller's abort — that path
  // must still reject the iterator with the abort reason.
  private readonly stopController = new AbortController()

  constructor(
    private readonly createCore: CoreFactory,
    private readonly url: string | URL | (() => Awaitable<string | URL>),
    private readonly options: ReconnectingOptions<M> = {},
  ) {
    super()
  }

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
    this.stopController.abort()
    this.state = 'closing'
    if (this.core) {
      // `this.core` may be a stale core that already failed (e.g. we're
      // parked in a backoff sleep after a reconnectable close) — its state
      // is already 'closed', so `core.close()` resolves immediately. Mirror
      // core.ts's own `[Symbol.asyncIterator]().return()` handling: close()
      // signals user-intended shutdown and must resolve cleanly regardless.
      await this.core.close(code, reason).catch(() => {})
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
    // successful open (reset to 0 in `onCoreOpen` below). `retries === 0`
    // means the upcoming attempt is either the first attempt after a stable
    // open or the very first connect — both are "fast" (<=1s). It escalates
    // with `backoffMs` only across repeated failures with no open in between.
    let retries = 0
    let firstAttempt = true // true until the first connection is created
    let firstOpen = true // true until the first successful open

    const signal = this.options.signal
    // End the loop promptly on external abort.
    if (signal?.aborted) throw signal.reason

    while (!this.stopped) {
      if (signal?.aborted) throw signal.reason

      if (!firstAttempt) {
        // Fast first reconnect (attempt 0); exponential backoff afterwards.
        const waitMs =
          retries === 0 ? Math.min(1000, maxMs) : backoffMs(retries, maxMs)
        // Rejects with signal.reason on external abort; resolves promptly
        // (not rejects) on close()'s internal stop signal — the loop below
        // observes `this.stopped` and exits the clean way.
        await sleep(waitMs, signal, this.stopController.signal)
        if (this.stopped) break
        // Escalate the delay for the *next* consecutive failure. Reset to 0
        // happens on open, so the first reconnect after a stable open is fast.
        retries++
      }
      firstAttempt = false

      const url = await this.resolveUrl()
      // resolveUrl() is an async gap: close() or signal abort landing while
      // it's in flight must not fall through to creating (and leaking) a
      // connection that nothing will ever terminate. Re-check both before
      // createCore — an abort here would otherwise be missed entirely, since
      // an already-aborted signal never fires a listener added after the fact.
      if (this.stopped) break
      if (signal?.aborted) throw signal.reason
      const core = this.createCore<M>(url, this.coreOptions())
      this.core = core
      this.state = 'connecting'

      // Consume the child core's own lifecycle events. `onCoreOpen` promotes
      // each successful open to this layer's `'open'` (first) / `'reconnect'`
      // (subsequent) event; `onCoreClose` captures the close detail so the
      // terminal path below can re-emit the real close code/reason/wasClean.
      let closeDetail: CloseEventDetail | undefined
      const onCoreOpen = () => {
        this.state = 'open'
        retries = 0 // stable open: next reconnect is fast again
        if (firstOpen) {
          firstOpen = false
          this.dispatchEvent(new Event('open'))
        } else {
          this.dispatchEvent(new Event('reconnect'))
        }
      }
      const onCoreClose = (e: CustomEvent<CloseEventDetail>) => {
        closeDetail = e.detail
      }
      core.addEventListener('open', onCoreOpen)
      core.addEventListener('close', onCoreClose)

      // Wire the external signal to terminate the current core.
      const onAbort = () => core.terminate()
      signal?.addEventListener('abort', onAbort, { once: true })

      // The `finally` covers every exit from this connection's body: the
      // normal fall-through below, the `throw`/`break`/`continue` in `catch`,
      // and a consumer `break` (which resumes the generator's `return()` at
      // the `yield` and would otherwise skip listener cleanup entirely).
      try {
        try {
          for await (const msg of core) {
            yield msg
          }
          // Clean iterator completion (1000/1001): fall through with the
          // captured `closeDetail` carrying the real close code.
        } catch (error) {
          // Abort surfaces to the consumer as a rejection (the terminated core
          // throws a transport error, which we replace with the abort reason).
          if (signal?.aborted) throw signal.reason
          // Consumer-initiated close(): end quietly, no reconnect, no 'close'
          // event (the user observes the stop via close() resolving).
          if (this.stopped) break
          const willReconnect = shouldReconnect(error, retries)
          this.dispatchEvent(
            new CustomEvent('error', {
              detail: willReconnect
                ? { error, reconnect: { attempt: retries } }
                : { error },
            }),
          )
          if (!willReconnect) {
            this.state = 'closed'
            // Fatal: emit the final close (the child core already dispatched
            // its own close carrying the same detail).
            this.dispatchEvent(
              new CustomEvent('close', {
                detail: closeDetail ?? {
                  code: 1006,
                  reason: '',
                  wasClean: false,
                },
              }),
            )
            throw error
          }
          this.state = 'connecting'
          continue
        }
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }

      // User-driven stop (close()/abort): break/throw without a 'close' event.
      if (this.stopped) break
      if (signal?.aborted) throw signal.reason

      // Clean close: 1000 stops; 1001 (and any non-fatal clean code) reconnects.
      // Only 1000/1001 arrive here (core ends cleanly only for those); 1000 is
      // fatal, 1001 reconnects. Reuse `shouldReconnect` via a synthetic
      // AbnormalCloseError so an override applies uniformly to clean codes too.
      const code = closeDetail?.code ?? 1000
      const reconnectClean =
        code !== 1000 &&
        shouldReconnect(
          new AbnormalCloseError(code, closeDetail?.reason ?? '', true),
          retries,
        )
      if (!reconnectClean) {
        this.state = 'closed'
        // Final clean close (1000, or a non-reconnectable clean code).
        this.dispatchEvent(
          new CustomEvent('close', {
            detail: closeDetail ?? { code: 1000, reason: '', wasClean: true },
          }),
        )
        break
      }
      this.state = 'connecting'
    }
    this.state = 'closed'
  }
}

// `signal` is the caller's external abort: it REJECTS with `signal.reason`
// (surfaces to the consumer as an iterator rejection). `stopSignal` is
// close()'s internal wake-up: it RESOLVES instead — a clean stop, not a
// rejection — so the loop falls through to its own `if (this.stopped) break`.
function sleep(
  ms: number,
  signal?: AbortSignal,
  stopSignal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    if (stopSignal?.aborted) return resolve()
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      stopSignal?.removeEventListener('abort', onStop)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = () => {
      cleanup()
      reject(signal!.reason)
    }
    const onStop = () => {
      cleanup()
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    stopSignal?.addEventListener('abort', onStop, { once: true })
    // Node: don't keep the process alive on the backoff timer.
    ;(timer as { unref?: () => void }).unref?.()
  })
}
