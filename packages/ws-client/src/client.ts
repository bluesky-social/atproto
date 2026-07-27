import type {
  CloseEventDetail,
  DataMode,
  MessageOf,
  ReadyState,
  WebSocketConnectionEngine,
  WebSocketConnectionOptions,
} from './connection.js'
import { CloseCode } from './lib/close-codes.js'
import { CloseError, WebSocketClientError } from './lib/errors.js'
import { invokeHook } from './lib/invoke-hook.js'
import { backoffMs, defaultShouldReconnect } from './lib/reconnect-policy.js'
import type { HeadersInit } from './transport/transport.js'

export type Awaitable<T> = T | Promise<T>

export type ConnectionFactory = <M extends DataMode>(
  url: string | URL,
  options: WebSocketConnectionOptions<M>,
) => WebSocketConnectionEngine<M>

export interface WebSocketClientOptions<M extends DataMode = 'auto'> {
  protocols?: string | string[]
  dataMode?: M
  /**
   * Node.js only. Applied to the underlying `ws` connection. Accepts any
   * `HeadersInit` (a plain record, entry pairs, or a WHATWG `Headers`). The
   * browser throws on construction if headers are provided — the native
   * WebSocket API has no request-header mechanism; use URL/subprotocol auth
   * instead. See {@link BrowserWebSocketClientOptions}.
   */
  headers?: HeadersInit
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
  /**
   * Called when the first connection succeeds.
   *
   * Hooks are called with `this` pinned to `null` and must not throw — a
   * thrown error is re-thrown as an uncaught exception on a microtask.
   */
  onOpen?: () => void
  /** Called when a later connection succeeds (every reconnect). */
  onReconnect?: () => void
  /**
   * Called when a connection ends with an error. `reconnect` is present
   * (with the attempt count) when the client will retry, and absent when
   * it's giving up (onClose follows).
   */
  onError?: (error: unknown, reconnect?: { attempt: number }) => void
  /**
   * Called exactly once per started client when it stops, terminally —
   * whether it stopped on its own (a fatal error, or a non-reconnectable
   * clean close) or was stopped (close(), an aborted `signal`). `detail`
   * carries the real close code when a close frame provided one, or 1005
   * (no status) when none did (e.g. a stop mid-backoff).
   */
  onClose?: (detail: CloseEventDetail) => void
}

export type NodeWebSocketClientOptions<M extends DataMode = 'auto'> =
  WebSocketClientOptions<M>
export type BrowserWebSocketClientOptions<M extends DataMode = 'auto'> = Omit<
  WebSocketClientOptions<M>,
  'headers'
>

// Sentinel abort reason distinguishing a clean, user-intended close() from an
// external signal abort on the shared stop signal: close() resolves the
// iterator; an external abort rejects it with the signal's reason.
const STOPPED_BY_CLOSE = Symbol('WebSocketClient stopped by close()')

export class WebSocketClientBase<M extends DataMode = 'auto'>
  implements AsyncIterable<MessageOf<M>>
{
  #connection: WebSocketConnectionEngine<M> | null = null
  #state: ReadyState = 'initialized'
  #iterated = false
  // The most recent child connection's close detail, and whether this
  // client's own final onClose hook has fired. Together these let every
  // started lifecycle end with exactly one onClose — carrying the real close
  // code when a close frame provided one, or the WHATWG-conventional 1005
  // (no status) when none did (e.g. a stop mid-backoff).
  #lastCloseDetail?: CloseEventDetail
  #closeDispatched = false
  // The single internal stop signal. Aborts exactly once, with the stop cause
  // as its reason: STOPPED_BY_CLOSE for close() (a clean stop — the iterator
  // resolves), or the external signal's abort reason (the iterator rejects
  // with it). The external signal is bound into it at construction; a parked
  // backoff `sleep` also wakes on it. First cause wins.
  readonly #stopController = new AbortController()

  readonly #createConnection: ConnectionFactory
  readonly #url: string | URL | (() => Awaitable<string | URL>)
  readonly #options: WebSocketClientOptions<M>

  constructor(
    createConnection: ConnectionFactory,
    url: string | URL | (() => Awaitable<string | URL>),
    options: WebSocketClientOptions<M> = {},
  ) {
    this.#createConnection = createConnection
    this.#url = url
    this.#options = options
    const { signal } = options
    // Constructing an already-stopped client is a programmer error: fail now
    // rather than produce an instance that can never connect.
    signal?.throwIfAborted()
    signal?.addEventListener(
      'abort',
      () => this.#stopController.abort(signal.reason),
      { once: true, signal: this.#stopController.signal },
    )
  }

  get readyState(): ReadyState {
    return this.#state
  }

  get connected(): boolean {
    return this.#connection?.readyState === 'open'
  }

  /**
   * Sends a message over the current connection. With no connection at hand
   * (never iterated, or stopped), rejects with a {@link WebSocketClientError};
   * otherwise the connection answers for itself — rejecting with a
   * {@link WebSocketConnectionError} if it can't send (e.g. mid-reconnect).
   */
  async send(data: MessageOf<M>): Promise<void> {
    if (!this.#connection) {
      throw new WebSocketClientError('WebSocketClient is not connected')
    }
    return this.#connection.send(data)
  }

  // Idempotent, matching WHATWG WebSocket and `ws` close() behavior.
  async close(code: number = CloseCode.Normal, reason?: string): Promise<void> {
    this.#stopController.abort(STOPPED_BY_CLOSE)
    this.#state = 'closing'
    if (this.#connection && this.#connection.readyState !== 'closed') {
      // A live connection: run the close handshake. Its onClose hook supplies
      // the real close detail for this client's own final onClose hook.
      // close() signals user-intended shutdown and must resolve cleanly even
      // if the connection fails mid-handshake.
      await this.#connection.close(code, reason).catch(() => {})
    } else {
      // No live connection to hand-shake with (never opened, or stopped
      // mid-backoff after a failure): no status code from the server applies
      // to this stop, so drop any stale detail — the final onClose hook
      // synthesizes 1005 (no status) per the WHATWG convention.
      this.#lastCloseDetail = undefined
    }
    this.#state = 'closed'
  }

  // Fire this client's single, final onClose hook. Guarded so every started
  // lifecycle ends with exactly one onClose no matter which terminal path
  // fires it (fatal error, clean stop, user close(), or abort). Uses the
  // child connection's real close detail when a close frame provided one;
  // otherwise synthesizes 1005 (no status received), matching the WHATWG
  // convention for an end with no status code from the server.
  #dispatchClose(): void {
    if (this.#closeDispatched) return
    this.#closeDispatched = true
    invokeHook(
      this.#options.onClose,
      this.#lastCloseDetail ?? {
        code: CloseCode.NoStatus,
        reason: '',
        wasClean: false,
      },
    )
  }

  async #resolveUrl(): Promise<string | URL> {
    return typeof this.#url === 'function' ? this.#url() : this.#url
  }

  #connectionOptions(): WebSocketConnectionOptions<M> {
    const o = this.#options
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
      // reconnect. The loop watches this.#options.signal itself (see below).
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<MessageOf<M>> {
    // Guarded here (not inside the async generator below) because an async
    // generator's body doesn't run until the first `.next()` call — a bare
    // `async *` method wouldn't throw synchronously on a second call to
    // `[Symbol.asyncIterator]()` itself, only once consumption starts.
    if (this.#iterated) {
      throw new WebSocketClientError(
        'WebSocketClient is already being iterated',
      )
    }
    this.#iterated = true
    return this.#iterate()
  }

  async *#iterate(): AsyncGenerator<MessageOf<M>, void, unknown> {
    const maxMs = 1000 * (this.#options.maxReconnectSeconds ?? 64)
    const shouldReconnectOpt = this.#options.shouldReconnect ?? true
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

    const stopSignal = this.#stopController.signal
    // Returns true when stopped cleanly by close() — the caller breaks the
    // loop; an external signal abort instead throws its reason, surfacing to
    // the consumer as an iterator rejection.
    const checkStop = (): boolean => {
      if (!stopSignal.aborted) return false
      if (stopSignal.reason !== STOPPED_BY_CLOSE) throw stopSignal.reason
      return true
    }

    try {
      while (!checkStop()) {
        if (!firstAttempt) {
          // Exponential backoff: ~1s (with jitter) on the first reconnect after
          // an open, escalating across consecutive failures. Wakes promptly
          // (resolves, never rejects) when the stop signal aborts; the loop
          // condition then classifies the stop.
          await sleep(backoffMs(retries, maxMs), stopSignal)
          if (checkStop()) break
          // Escalate the delay for the *next* consecutive failure. Reset to 0
          // happens on open, so the backoff starts over after a stable open.
          retries++
        }
        firstAttempt = false

        const url = await this.#resolveUrl()
        // resolveUrl() is an async gap: close() or signal abort landing while
        // it's in flight must not fall through to creating (and leaking) a
        // connection that nothing will ever terminate. Re-check before
        // createConnection — a stop here would otherwise be missed entirely,
        // since an already-aborted signal never fires a listener added after
        // the fact.
        if (checkStop()) break
        // Observe the child connection's lifecycle via its hooks: `onOpen`
        // promotes each successful open to this layer's onOpen (first) /
        // onReconnect (subsequent) hook; `onClose` captures the close detail
        // so the terminal path below can re-emit the real close
        // code/reason/wasClean.
        let closeDetail: CloseEventDetail | undefined
        const connection = this.#createConnection<M>(url, {
          ...this.#connectionOptions(),
          onOpen: () => {
            this.#state = 'open'
            retries = 0 // stable open: backoff starts over
            if (firstOpen) {
              firstOpen = false
              invokeHook(this.#options.onOpen)
            } else {
              invokeHook(this.#options.onReconnect)
            }
          },
          onClose: (detail) => {
            closeDetail = detail
            this.#lastCloseDetail = detail
          },
        })
        this.#connection = connection
        this.#state = 'connecting'

        // Terminate the current connection when an external abort stops the
        // client (a close() stop instead hand-shakes via connection.close()).
        // The listener detaches itself when this connection ends (its own
        // controller aborts on either path).
        const connectionDone = new AbortController()
        stopSignal.addEventListener(
          'abort',
          () => {
            if (stopSignal.reason !== STOPPED_BY_CLOSE) connection.terminate()
          },
          { once: true, signal: connectionDone.signal },
        )

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
            // A stop surfaces per its cause: external abort rejects with the
            // abort reason (replacing the terminated connection's transport
            // error); close() ends quietly — no reconnect, no onClose hook
            // (the user observes the stop via close() resolving).
            if (checkStop()) break
            const willReconnect = shouldReconnect(error, retries)
            invokeHook(
              this.#options.onError,
              error,
              willReconnect ? { attempt: retries } : undefined,
            )
            if (!willReconnect) {
              // Fatal: the enclosing finally settles state and fires the final
              // onClose as this throw unwinds, so onError (above) precedes
              // onClose.
              throw error
            }
            this.#state = 'connecting'
            continue
          }
        } finally {
          connectionDone.abort()
        }

        // User-driven stop (close()/abort): break/throw — the enclosing
        // finally emits the final onClose hook.
        if (checkStop()) break

        // Clean close (only 1000/1001 end the connection's iterator cleanly):
        // consult `shouldReconnect` via a synthetic CloseError so the policy
        // applies uniformly to clean codes too. The default policy stops on
        // 1000 (it's in FATAL_CLOSE_CODES) and reconnects on 1001; an override
        // may reconnect on either — a server-sent 1000 reaching this point is
        // the server's choice, not the user's (user close() breaks above).
        const code = closeDetail?.code ?? CloseCode.Normal
        const reconnectClean = shouldReconnect(
          new CloseError(code, closeDetail?.reason ?? '', true),
          retries,
        )
        if (!reconnectClean) break
        this.#state = 'connecting'
      }
    } finally {
      // Every started lifecycle ends with exactly one onClose, whichever way
      // the loop exits: fatal error, clean stop, user close(), or abort. A
      // client that never attempted a connection (e.g. close() before any
      // iteration) dispatches nothing — there was no lifecycle to close.
      this.#state = 'closed'
      if (this.#connection) this.#dispatchClose()
    }
  }
}

// Resolves after `ms`, or promptly (never rejects) when `stopSignal` aborts —
// the caller classifies the stop via the signal's reason.
function sleep(ms: number, stopSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (stopSignal.aborted) return resolve()
    const timer = setTimeout(() => {
      stopSignal.removeEventListener('abort', onStop)
      resolve()
    }, ms)
    const onStop = () => {
      clearTimeout(timer)
      resolve()
    }
    stopSignal.addEventListener('abort', onStop, { once: true })
    // NB: the timer stays ref'd — a process whose only pending work is this
    // backoff must stay alive to reconnect, not exit mid-backoff.
  })
}
