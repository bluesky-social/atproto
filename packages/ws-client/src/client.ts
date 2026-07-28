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
   *
   * Fires only once the stream has fully ended — unlike `WebSocketConnection`'s
   * onClose, which reports the socket-level close (a clean-close drain may
   * still yield afterward).
   */
  onClose?: (detail: CloseEventDetail) => void
}

export type NodeWebSocketClientOptions<M extends DataMode = 'auto'> =
  WebSocketClientOptions<M>
export type BrowserWebSocketClientOptions<M extends DataMode = 'auto'> = Omit<
  WebSocketClientOptions<M>,
  'headers'
>

// Sentinel abort reason for a clean stop — close(), or the loop ending on a
// non-reconnectable clean close: the iterator resolves. Any other reason (an
// external signal abort, or a fatal error recorded by the loop) rejects the
// iterator with that reason.
const STOPPED_CLEANLY = Symbol('WebSocketClient stopped cleanly')

export class WebSocketClientBase<M extends DataMode = 'auto'>
  implements AsyncIterable<MessageOf<M>>
{
  #connection: WebSocketConnectionEngine<M> | null = null
  #state: ReadyState = 'initialized'
  #iterated = false
  // The handed-out generator, kept so a stop can drive it to its terminal
  // even when the consumer has abandoned it (parked at yield, no one
  // pulling): iterator.return() resumes it with a return completion — the
  // same mechanism a consumer break uses — running the terminal `finally`.
  #iterator?: AsyncGenerator<MessageOf<M>, void, unknown>
  // Whether the generator body actually ran (first next() called). This is
  // the definition of a "started" lifecycle: the terminal `finally` is coming
  // iff this is true. An iterator obtained but never pulled never starts —
  // return() on it resolves without running the body.
  #loopStarted = false
  // The most recent child connection's close detail: the final onClose hook
  // carries the real close code when a close frame provided one, or the
  // WHATWG-conventional 1005 (no status) when none did (e.g. a stop
  // mid-backoff).
  #lastCloseDetail?: CloseEventDetail
  // The single internal stop signal. Aborts exactly once, with the stop cause
  // as its reason: STOPPED_CLEANLY for close() and clean loop exits (the
  // iterator resolves), the external signal's abort reason (the iterator
  // rejects with it), or a fatal error recorded by the loop's terminal. The
  // external signal is bound into it at construction; a parked backoff
  // `sleep` also wakes on it. First cause wins.
  //
  // State ownership: `#state = 'closed'` has exactly two writers, split by
  // whether the lifecycle (the generator body) started. Started: the loop's
  // `finally` is the single terminal transition — it settles state and fires
  // onClose. Never started: no `finally` is coming, so the stop cause itself
  // settles state (#stop, mirroring the connection's initialized → closed
  // edge) and no onClose fires. One deliberate exception: an external abort
  // on a started client also settles state synchronously, mirroring
  // WebSocketConnection#fail's settle-at-the-moment behavior; the loop's
  // later idempotent write re-affirms it.
  readonly #stopController = new AbortController()

  // Record a stop cause from outside the loop (close(), or signal abort).
  #stop(reason: unknown): void {
    this.#stopController.abort(reason)
    if (!this.#loopStarted || reason !== STOPPED_CLEANLY) {
      // Never-started (no terminal transition coming), or an abort on a
      // started client (mirror #fail's synchronous settle). A started clean
      // close instead shows 'closing' until the loop's terminal.
      if (this.#state !== 'closing') this.#state = 'closed'
    }
    // Drive the generator to its terminal: return() lands a return completion
    // at the suspended yield, running the terminal `finally`. This serves two
    // purposes: an abandoned iterator (parked at yield, no consumer pulling)
    // reaches its terminal at all, and an active consumer's stream ends
    // promptly (at most one in-flight pull settles first) rather than
    // draining — a stop is a loss of interest; drop, don't deliver. For a
    // never-pulled iterator this resolves without running the body —
    // correctly no terminal, there was no lifecycle. Fire-and-forget:
    // completion is observed via #done, not this promise. NB: this swallows
    // the generator's outcome (a resumed generator reports to its resumer) —
    // the iterator wrapper in [Symbol.asyncIterator] re-delivers an abnormal
    // stop cause to the consumer's next pull.
    void this.#iterator?.return(undefined).catch(() => {})
  }

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
    signal?.addEventListener('abort', () => this.#stop(signal.reason), {
      once: true,
      signal: this.#stopController.signal,
    })
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
   *
   * Resolution means hand-off (flushed to the OS socket on Node.js, accepted
   * by the WebSocket in the browser), not delivery — at-most-once, like a
   * bare WebSocket. Nothing is queued or replayed across reconnects; layer
   * application-level acknowledgements for delivery guarantees.
   */
  async send(data: MessageOf<M>): Promise<void> {
    if (!this.#connection) {
      throw new WebSocketClientError('WebSocketClient is not connected')
    }
    return this.#connection.send(data)
  }

  #closing?: Promise<void>
  // Resolves at the lifecycle's terminal transition (the loop's `finally`),
  // after the final onClose hook has fired — what close() awaits on a
  // started client.
  #resolveDone!: () => void
  readonly #done = new Promise<void>((resolve) => {
    this.#resolveDone = resolve
  })

  /**
   * Stops the client, terminally; resolves once the client has fully closed
   * (after the final onClose hook, on a started client). Ends the stream
   * immediately: buffered, undelivered messages are dropped. Idempotent,
   * matching WHATWG WebSocket and `ws` close() behavior: repeat and
   * concurrent calls share the first call's completion (later `code`/`reason`
   * args are ignored), and a close() after the client already stopped (a
   * signal abort, or a terminal failure) is an inert no-op.
   */
  close(code: number = CloseCode.Normal, reason?: string): Promise<void> {
    // Already stopped: state settled at the stop cause (and the loop, if
    // started, fires onClose) — nothing to close.
    return (this.#closing ??= this.#stopController.signal.aborted
      ? Promise.resolve()
      : this.#close(code, reason))
  }

  // Runs at most once, as the first stop cause — close() memoizes and routes
  // an already-stopped client away from here. NB: on a started client this
  // method does NOT settle state or fire onClose itself: it causes the stop
  // and awaits the loop's terminal transition (see #iterate's finally), which
  // owns both. A never-started client has no loop, so #stop settles state
  // directly and no onClose fires ("exactly once per *started* client").
  async #close(code: number, reason?: string): Promise<void> {
    // Assert the at-most-once invariant rather than tolerate a violation.
    this.#stopController.signal.throwIfAborted()
    if (!this.#loopStarted) {
      // Never started (never pulled): straight to 'closed' (via #stop) with
      // no 'closing' — mirroring the connection's initialized → closed edge.
      this.#stop(STOPPED_CLEANLY)
      return
    }
    // Started: signal shutdown-in-progress, then stop (#stop also nudges an
    // abandoned iterator to its terminal). With a live connection run the
    // close handshake (its onClose hook supplies the real close detail);
    // without one (mid-backoff, or parked in resolveUrl) there is no
    // handshake and the terminal synthesizes 1005 (no status).
    this.#state = 'closing'
    this.#stop(STOPPED_CLEANLY)
    if (this.#connection && this.#connection.readyState !== 'closed') {
      // close() signals user-intended shutdown and must resolve cleanly even
      // if the connection fails mid-handshake.
      await this.#connection.close(code, reason).catch(() => {})
    } else {
      // No status code from a server applies to this stop: drop any stale
      // detail (e.g. the failed connection's 1006 that preceded the backoff)
      // so the terminal synthesizes 1005.
      this.#lastCloseDetail = undefined
    }
    // Resolve at the true terminal: after the loop's finally has settled
    // state and fired the final onClose. The loop always gets there — active
    // consumers drive it, abandoned iterators are driven by #stop, and
    // internal parks are stop-aware. The one exception: a user-supplied url
    // function that never resolves parks the loop (and this close()) with it.
    await this.#done
  }

  // Fire this client's single, final onClose hook — called exactly once, from
  // the loop's terminal transition. Uses the child connection's real close
  // detail when a close frame provided one; otherwise synthesizes 1005 (no
  // status received), matching the WHATWG convention for an end with no
  // status code from the server.
  #dispatchClose(): void {
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
    //
    // Starting iteration on a client that has already stopped (close(),
    // abort, or a terminal failure) is a programmer error — surface it rather
    // than yield an empty stream, mirroring WebSocketConnection's terminal
    // iteration guard. An abort or failure rethrows its cause (the more
    // useful diagnosis); a clean stop throws a descriptive error. Checked
    // before the already-iterated guard for the same reason as on the
    // connection.
    const stopSignal = this.#stopController.signal
    if (stopSignal.aborted) {
      if (stopSignal.reason !== STOPPED_CLEANLY) {
        throw stopSignal.reason
      }
      throw new WebSocketClientError(
        'Cannot iterate a WebSocketClient that has already closed',
      )
    }
    if (this.#iterated) {
      throw new WebSocketClientError(
        'WebSocketClient is already being iterated',
      )
    }
    this.#iterated = true
    const iterator = (this.#iterator = this.#iterate())
    // Wrap the generator rather than handing it out raw: when a stop's nudge
    // (#stop's iterator.return()) resumes the generator, the generator's
    // outcome is delivered to the nudge — not to the consumer, whose next
    // pull would see a clean `done` even for an abort. Mirror the
    // connection's stored-terminal behavior instead: once the generator has
    // completed, a pull rejects with an abnormal stop cause (an abort's
    // reason, a fatal error) rather than reporting a clean end.
    return {
      next: async () => {
        const result = await iterator.next()
        if (
          result.done &&
          stopSignal.aborted &&
          stopSignal.reason !== STOPPED_CLEANLY
        ) {
          throw stopSignal.reason
        }
        return result
      },
      return: async (value?: unknown) => {
        // Consumer break/return: a deliberate, clean end — never re-thrown.
        return iterator.return(value as never)
      },
    }
  }

  async *#iterate(): AsyncGenerator<MessageOf<M>, void, unknown> {
    // The lifecycle starts here: the body ran, so the terminal `finally` below
    // is now guaranteed to run — see the state-ownership note on
    // #stopController.
    this.#loopStarted = true

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
      if (stopSignal.reason !== STOPPED_CLEANLY) throw stopSignal.reason
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
            if (stopSignal.reason !== STOPPED_CLEANLY) connection.terminate()
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
              // Fatal: record the failure as the stop cause (so a later
              // close() is inert and re-iteration rethrows it), then unwind —
              // the enclosing finally settles state and fires the final
              // onClose, so onError (above) precedes onClose.
              this.#stopController.abort(error)
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
      // The generator body is the lifecycle: entering it started this client,
      // and this finally is its single terminal transition — whichever way
      // the loop exits (fatal error, non-reconnectable clean close, close(),
      // abort, or a consumer break/return). Record the stop cause if none
      // was recorded (clean exits — server-sent fatal close, or consumer
      // break — never abort the stop signal themselves), settle state, fire
      // the one onClose, and release close() waiters. A never-iterated
      // client never runs this: no lifecycle, no onClose.
      if (!stopSignal.aborted) this.#stopController.abort(STOPPED_CLEANLY)
      this.#state = 'closed'
      this.#dispatchClose()
      this.#resolveDone()
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
