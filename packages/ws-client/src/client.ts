import { CloseCode } from './close-codes.js'
import type {
  DataMode,
  MessageOf,
  WebSocketConnectionEngine,
  WebSocketConnectionOptions,
} from './connection.js'
import { AbnormalCloseError, WebSocketClientError } from './errors.js'
import { backoffMs, defaultShouldReconnect } from './reconnect-policy.js'
import {
  type CloseEventDetail,
  TypedEventTarget,
  type WebSocketClientEventMap,
} from './typed-event-target.js'

export type Awaitable<T> = T | Promise<T>

export type ConnectionFactory = <M extends DataMode>(
  url: string | URL,
  options: WebSocketConnectionOptions<M>,
) => WebSocketConnectionEngine<M>

export interface WebSocketClientOptions<M extends DataMode = 'auto'> {
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
   * Forwarded to the connection. Doubles as the browser's dead-connection
   * detector where protocol heartbeat is unavailable
   * (`capabilities.heartbeat === false`): an elapsed idle window fails the
   * connection and triggers a reconnect. Best for chatty protocols (e.g. a
   * firehose).
   */
  idleTimeoutMs?: number
  highWaterMark?: number
  /**
   * Forwarded to the connection. Doubles as the browser's backpressure
   * backstop where real read-side backpressure is unavailable
   * (`capabilities.pauseResume === false`): exceeding this ceiling fails the
   * connection with BufferOverflowError (a reconnect trigger) rather than
   * buffering unbounded.
   */
  maxBufferedBytes?: number
  /** Exponential-backoff ceiling in seconds. Default 64. */
  maxReconnectSeconds?: number
  /** Abort to end the reconnect loop permanently. */
  signal?: AbortSignal
  /**
   * Controls reconnection. `true` (default) uses the built-in policy
   * (typed-error + RFC-6455 close-code classification). `false` never
   * reconnects — every terminal error is fatal. A function `(error, attempt)
   * => boolean` fully replaces the default classification.
   */
  shouldReconnect?: boolean | ((error: unknown, attempt: number) => boolean)
}

export type NodeWebSocketClientOptions<M extends DataMode = 'auto'> =
  WebSocketClientOptions<M>
export type BrowserWebSocketClientOptions<M extends DataMode = 'auto'> = Omit<
  WebSocketClientOptions<M>,
  'headers'
>

type ReadyState = 'initialized' | 'connecting' | 'open' | 'closing' | 'closed'

export class WebSocketClientBase<M extends DataMode = 'auto'>
  extends TypedEventTarget<WebSocketClientEventMap>
  implements AsyncIterable<MessageOf<M>>
{
  private connection: WebSocketConnectionEngine<M> | null = null
  private state: ReadyState = 'initialized'
  private stopped = false
  private iterated = false
  // The most recent child connection's close detail, and whether this
  // client's own final 'close' event has been dispatched. Together these let
  // every started lifecycle end with exactly one 'close' — carrying the real
  // close code when a close frame provided one, or the WHATWG-conventional
  // 1005 (no status) when none did (e.g. a stop mid-backoff).
  private lastCloseDetail?: CloseEventDetail
  private closeDispatched = false
  // Internal wake signal for close(): lets a parked backoff `sleep` resolve
  // (not reject) promptly instead of waiting out the full backoff window.
  // Distinct from `options.signal`, which is the caller's abort — that path
  // must still reject the iterator with the abort reason.
  private readonly stopController = new AbortController()

  constructor(
    private readonly createConnection: ConnectionFactory,
    private readonly url: string | URL | (() => Awaitable<string | URL>),
    private readonly options: WebSocketClientOptions<M> = {},
  ) {
    super()
  }

  get readyState(): ReadyState {
    return this.state
  }

  get connected(): boolean {
    return this.connection?.readyState === 'open'
  }

  send(data: MessageOf<M>): Promise<void> {
    // With no connection at hand (never iterated, or stopped) the client
    // speaks for itself; otherwise the connection does — it rejects with a
    // WebSocketConnectionError if it can't send (e.g. mid-reconnect).
    if (!this.connection) {
      return Promise.reject(
        new WebSocketClientError('WebSocketClient is not connected'),
      )
    }
    return this.connection.send(data)
  }

  async close(code: number = CloseCode.Normal, reason?: string): Promise<void> {
    this.stopped = true
    this.stopController.abort()
    this.state = 'closing'
    if (this.connection && this.connection.readyState !== 'closed') {
      // A live connection: run the close handshake. Its 'close' event supplies
      // the real close detail for this client's own final 'close' event.
      // close() signals user-intended shutdown and must resolve cleanly even
      // if the connection fails mid-handshake.
      await this.connection.close(code, reason).catch(() => {})
    } else {
      // No live connection to hand-shake with (never opened, or stopped
      // mid-backoff after a failure): no status code from the server applies
      // to this stop, so drop any stale detail — the final 'close' event
      // synthesizes 1005 (no status) per the WHATWG convention.
      this.lastCloseDetail = undefined
    }
    this.state = 'closed'
  }

  // Dispatch this client's single, final 'close' event. Guarded so every
  // started lifecycle ends with exactly one 'close' no matter which terminal
  // path fires it (fatal error, clean stop, user close(), or abort). Uses the
  // child connection's real close detail when a close frame provided one;
  // otherwise synthesizes 1005 (no status received), matching the WHATWG
  // convention for an end with no status code from the server.
  private dispatchClose(): void {
    if (this.closeDispatched) return
    this.closeDispatched = true
    this.dispatchEvent(
      new CustomEvent('close', {
        detail: this.lastCloseDetail ?? {
          code: CloseCode.NoStatus,
          reason: '',
          wasClean: false,
        },
      }),
    )
  }

  private resolveUrl(): Awaitable<string | URL> {
    return typeof this.url === 'function' ? this.url() : this.url
  }

  private connectionOptions(): WebSocketConnectionOptions<M> {
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
      // per-connection engine would look like a transport failure and
      // reconnect. The loop watches this.options.signal itself (see below).
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<MessageOf<M>> {
    // Guarded here (not inside the async generator below) because an async
    // generator's body doesn't run until the first `.next()` call — a bare
    // `async *` method wouldn't throw synchronously on a second call to
    // `[Symbol.asyncIterator]()` itself, only once consumption starts.
    if (this.iterated) {
      throw new WebSocketClientError(
        'WebSocketClient is already being iterated',
      )
    }
    this.iterated = true
    return this.iterate()
  }

  private async *iterate(): AsyncGenerator<MessageOf<M>> {
    const maxMs = 1000 * (this.options.maxReconnectSeconds ?? 64)
    const shouldReconnectOpt = this.options.shouldReconnect ?? true
    const shouldReconnect =
      typeof shouldReconnectOpt === 'function'
        ? shouldReconnectOpt
        : shouldReconnectOpt
          ? (error: unknown) => defaultShouldReconnect(error)
          : () => false

    // `retries` is the count of consecutive failed connections since the last
    // successful open (reset to 0 in `onConnectionOpen` below), so the backoff
    // starts over at ~1s after any stable open and escalates only across
    // repeated failures with no open in between.
    let retries = 0
    let firstAttempt = true // true until the first connection is created
    let firstOpen = true // true until the first successful open

    const signal = this.options.signal
    // End the loop promptly on external abort.
    if (signal?.aborted) throw signal.reason

    try {
      while (!this.stopped) {
        if (signal?.aborted) throw signal.reason

        if (!firstAttempt) {
          // Exponential backoff: ~1s (with jitter) on the first reconnect after
          // an open, escalating across consecutive failures.
          // Rejects with signal.reason on external abort; resolves promptly
          // (not rejects) on close()'s internal stop signal — the loop below
          // observes `this.stopped` and exits the clean way.
          await sleep(
            backoffMs(retries, maxMs),
            signal,
            this.stopController.signal,
          )
          if (this.stopped) break
          // Escalate the delay for the *next* consecutive failure. Reset to 0
          // happens on open, so the backoff starts over after a stable open.
          retries++
        }
        firstAttempt = false

        const url = await this.resolveUrl()
        // resolveUrl() is an async gap: close() or signal abort landing while
        // it's in flight must not fall through to creating (and leaking) a
        // connection that nothing will ever terminate. Re-check both before
        // createConnection — an abort here would otherwise be missed entirely,
        // since an already-aborted signal never fires a listener added after
        // the fact.
        if (this.stopped) break
        if (signal?.aborted) throw signal.reason
        const connection = this.createConnection<M>(
          url,
          this.connectionOptions(),
        )
        this.connection = connection
        this.state = 'connecting'

        // Consume the child connection's own lifecycle events.
        // `onConnectionOpen` promotes each successful open to this layer's
        // `'open'` (first) / `'reconnect'` (subsequent) event;
        // `onConnectionClose` captures the close detail so the terminal path
        // below can re-emit the real close code/reason/wasClean.
        let closeDetail: CloseEventDetail | undefined
        const onConnectionOpen = () => {
          this.state = 'open'
          retries = 0 // stable open: backoff starts over
          if (firstOpen) {
            firstOpen = false
            this.dispatchEvent(new Event('open'))
          } else {
            this.dispatchEvent(new Event('reconnect'))
          }
        }
        const onConnectionClose = (e: CustomEvent<CloseEventDetail>) => {
          closeDetail = e.detail
          this.lastCloseDetail = e.detail
        }
        connection.addEventListener('open', onConnectionOpen)
        connection.addEventListener('close', onConnectionClose)

        // Wire the external signal to terminate the current connection.
        const onAbort = () => connection.terminate()
        signal?.addEventListener('abort', onAbort, { once: true })

        // The `finally` covers every exit from this connection's body: the
        // normal fall-through below, the `throw`/`break`/`continue` in `catch`,
        // and a consumer `break` (which resumes the generator's `return()` at
        // the `yield` and would otherwise skip listener cleanup entirely).
        try {
          try {
            yield* connection
            // Clean iterator completion (1000/1001): fall through with the
            // captured `closeDetail` carrying the real close code.
          } catch (error) {
            // Abort surfaces to the consumer as a rejection (the terminated
            // connection throws a transport error, which we replace with the
            // abort reason).
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
              // Fatal: the enclosing finally emits the final 'close' as this
              // throw unwinds, so 'error' (above) precedes 'close'.
              throw error
            }
            this.state = 'connecting'
            continue
          }
        } finally {
          signal?.removeEventListener('abort', onAbort)
        }

        // User-driven stop (close()/abort): break/throw — the enclosing
        // finally emits the final 'close' event.
        if (this.stopped) break
        if (signal?.aborted) throw signal.reason

        // Clean close: 1000 stops; 1001 (and any non-fatal clean code)
        // reconnects. Only 1000/1001 arrive here (connection ends cleanly
        // only for those); 1000 is fatal, 1001 reconnects. Reuse
        // `shouldReconnect` via a synthetic AbnormalCloseError so an override
        // applies uniformly to clean codes too.
        const code = closeDetail?.code ?? CloseCode.Normal
        const reconnectClean =
          code !== CloseCode.Normal &&
          shouldReconnect(
            new AbnormalCloseError(code, closeDetail?.reason ?? '', true),
            retries,
          )
        if (!reconnectClean) {
          this.state = 'closed'
          break
        }
        this.state = 'connecting'
      }
    } finally {
      // Every started lifecycle ends with exactly one 'close', whichever way
      // the loop exits: fatal error, clean stop, user close(), or abort. A
      // client that never attempted a connection (e.g. close() before any
      // iteration) dispatches nothing — there was no lifecycle to close.
      this.state = 'closed'
      if (this.connection) this.dispatchClose()
    }
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
