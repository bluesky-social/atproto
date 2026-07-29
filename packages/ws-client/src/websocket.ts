import { CloseCode } from './lib/close-codes.js'
import { CloseError, WebSocketConnectionError } from './lib/errors.js'
import { invokeHook } from './lib/invoke-hook.js'
import { backoffMs, defaultShouldReconnect } from './lib/reconnect-policy.js'
import {
  ABNORMAL_CLOSE_DETAIL,
  type CloseEventDetail,
  type DataMode,
  type MessageOf,
} from './message-channel.js'
import type {
  Sender,
  TransportFactory,
  TransportOptions,
} from './transport/transport.js'

export type Awaitable<T> = T | Promise<T>

/**
 * The receive, liveness, and flow-control options a transport accepts, minus
 * the per-connection wiring the reconnect loop supplies for itself: `url` and
 * `signal` (a fresh connection and teardown channel per attempt) and
 * `onOpen`/`onClose` (how the loop observes each connection). Omitting them
 * here means a caller cannot collide with the loop's own bookkeeping.
 */
export type ConnectionOptions<M extends DataMode = 'auto'> = Omit<
  TransportOptions<M>,
  'url' | 'signal' | 'dataMode' | 'onOpen' | 'onClose'
> & { dataMode?: M }

export interface WebSocketOptions<M extends DataMode = 'auto'>
  extends ConnectionOptions<M> {
  /** Exponential-backoff ceiling in seconds. Default 64. */
  maxReconnectSeconds?: number
  /** Abort to end the stream permanently; the iterator rejects with the reason. */
  signal?: AbortSignal
  /**
   * Controls reconnection. `true` (the default) uses the built-in policy
   * ({@link defaultShouldReconnect}: typed errors self-classify, close codes
   * by RFC 6455). `false` never reconnects — the first end is terminal. A
   * function fully replaces the default classification.
   */
  shouldReconnect?: boolean | ((error: unknown, attempt: number) => boolean)
  /**
   * The stream is live for the first time. Fires once, immediately before the
   * first `onConnect`.
   *
   * Takes no sender: per-connection concerns belong to `onConnect`, which fires
   * for the first connection too. Pairs with `onClose` to bookend the stream.
   *
   * Hooks are called with `this` pinned to `null` and must not throw — a
   * thrown error is re-thrown as an uncaught exception on a microtask.
   */
  onOpen?: () => void
  /**
   * A connection is up, including the first. `sender` is valid until that
   * connection ends, after which its `send()` rejects — so use the one handed
   * to the most recent `onConnect`, never a retained older one.
   */
  onConnect?: (sender: Sender<M>) => void
  /**
   * The current connection ended, so the sender last handed out is now dead.
   *
   * Pairs with `onConnect` exactly: every `onConnect` is followed by one
   * `onDisconnect`, and a dial that never connected produces neither. So a
   * stream stuck retrying reports one `onDisconnect` for the connection it
   * lost, then an `onError` per failed dial — not a disconnect per attempt.
   *
   * This, not `onError`, is the reliable point at which to stop using a sender:
   * the loop only advances when the consumer pulls, so `onError` can arrive
   * long after the socket died, and a hook holding the sender in between would
   * hand data to a dead connection and see it silently dropped.
   */
  onDisconnect?: () => void
  /**
   * A connection ended with an error. `reconnect` is present (with the
   * attempt count) when a retry is coming, absent when giving up.
   */
  onError?: (error: unknown, reconnect?: { attempt: number }) => void
  /**
   * The stream ended, terminally. Fires exactly once per started stream —
   * however it ended: a fatal error, a non-reconnectable close, an aborted
   * signal, or a consumer `break` — and only once the local socket is closed,
   * so a caller can treat it as "teardown is done" and release what the stream
   * depended on.
   *
   * `detail` is whatever the transport observed. `wasClean: true` means the
   * close was orderly on our end; it is not a claim that the peer acknowledged,
   * which no client can wait on without risking an indefinite hang.
   */
  onClose?: (detail: CloseEventDetail) => void
}

export type NodeWebSocketOptions<M extends DataMode = 'auto'> =
  WebSocketOptions<M>
export type BrowserWebSocketOptions<M extends DataMode = 'auto'> = Omit<
  WebSocketOptions<M>,
  'headers'
>

/**
 * A reconnecting stream of WebSocket messages: `for await` over it and the
 * stream spans reconnects, so a consumer never has to notice that the
 * underlying connection was torn down and replaced. Termination is `break`,
 * `throw`, or an aborted `signal`.
 *
 * An `AsyncGenerator` rather than a bare `AsyncIterable`, so a consumer that
 * wants single-step control (`next()`) or explicit termination (`return()`) can
 * have it — the runtime object is a generator either way, and a quieter type
 * would only hide that.
 */
export type WebSocketIterable<M extends DataMode = 'auto'> = AsyncGenerator<
  MessageOf<M>,
  void,
  undefined
>

export type WebSocketFn = <M extends DataMode = 'auto'>(
  url: string | URL | (() => Awaitable<string | URL>),
  options?: WebSocketOptions<M>,
) => WebSocketIterable<M>

// The detail reported when a stream ends without any close frame having
// applied — e.g. a stop while parked in backoff between attempts. 1005 is the
// WHATWG convention for "no status received".
const NO_STATUS_DETAIL: CloseEventDetail = {
  code: CloseCode.NoStatus,
  reason: '',
  wasClean: false,
}

// How long the terminal waits for a politely-closed connection to report its
// close before giving up and reporting "no status". Bounded so an unresponsive
// peer delays teardown briefly rather than indefinitely.
const CLOSE_GRACE_MS = 1_000

/**
 * Binds a platform transport factory into the public `websocket()` generator.
 * Called once per entrypoint; the `#transport` package-imports condition is
 * what selects the platform.
 */
export function createWebSocket(
  createTransport: TransportFactory,
): WebSocketFn {
  return async function* websocket<M extends DataMode = 'auto'>(
    url: string | URL | (() => Awaitable<string | URL>),
    options: WebSocketOptions<M> = {},
  ): WebSocketIterable<M> {
    const { signal } = options
    const maxMs = 1000 * (options.maxReconnectSeconds ?? 64)
    const shouldReconnect = normalizeShouldReconnect(options.shouldReconnect)

    // Consecutive failed connections since the last successful open, so the
    // backoff restarts at ~1s after any stable open and escalates only across
    // repeated failures with nothing working in between.
    let retries = 0
    let firstOpen = true
    // This attempt's close detail, recorded synchronously by the transport's
    // `onClose` below — so it is already set when a completed `yield*` resumes,
    // and it is what both the thrown CloseError and the terminal hook report.
    // Reset per attempt (see below), so it can never describe an earlier
    // connection as this stream's ending.
    let closeDetail: CloseEventDetail | undefined
    // The most recent connection's close promise, awaited by the terminal when
    // no detail has arrived yet. Undefined before the first connection.
    let awaitClose: Promise<void> | undefined

    try {
      // The generator body doesn't run until the first pull, so an
      // already-aborted signal surfaces here — rejecting that first `next()`
      // rather than at the call that created the generator.
      signal?.throwIfAborted()

      for (;;) {
        const resolved = typeof url === 'function' ? await url() : url
        // Resolving the url is an async gap: an abort landing while it was in
        // flight must not fall through to a connection nothing tears down.
        signal?.throwIfAborted()

        // A transport is created already connecting and has no close method —
        // aborting this is the only way to end it. Forwarding the caller's
        // signal into it means an outer abort reaches the socket; aborting it in
        // the `finally` means every exit path tears the connection down exactly
        // once.
        const teardown = new AbortController()
        forwardAbort(signal, teardown)
        // Hooks receive a sender scoped to this connection rather than the
        // transport itself, so it can be revoked the moment the connection
        // ends — see the onClose wiring below.
        let live = true
        let opened = false
        // Settles when the transport reports this connection's close. The
        // terminal awaits it so `onClose` fires with the transport's own detail
        // — one source of truth — and only once the connection has actually
        // finished, rather than racing the socket's asynchronous close event.
        //
        // Both of these are per-attempt and must be cleared here rather than
        // only written on success: a detail left over from an earlier
        // connection would be reported as this stream's ending, and an
        // `awaitClose` armed for a transport that never got constructed would
        // never settle, stalling the terminal for the full grace period.
        closeDetail = undefined
        awaitClose = undefined
        let reportClosed!: () => void
        const closeReported = new Promise<void>((resolve) => {
          reportClosed = resolve
        })
        const invalidateSender = () => {
          live = false
        }
        try {
          const transport = createTransport<M>({
            ...connectionOptions(options),
            url: resolved,
            signal: teardown.signal,
            onOpen: (sender) => {
              retries = 0 // a stable open: the backoff starts over
              opened = true
              const scoped: Sender<M> = {
                async send(data) {
                  if (!live) {
                    throw new WebSocketConnectionError(
                      'WebSocket is not open: this connection has ended',
                    )
                  }
                  return sender.send(data)
                },
              }
              // onOpen bookends the stream and fires once, before the first
              // onConnect; onConnect fires for every connection including this
              // one.
              if (firstOpen) {
                firstOpen = false
                invokeHook(options.onOpen)
              }
              invokeHook(options.onConnect, scoped)
            },
            onClose: (detail) => {
              closeDetail = detail
              reportClosed()
              // This connection is over, so the sender handed to onOpen /
              // onConnect must stop accepting writes *now*. Waiting for the
              // loop to notice would leave a window — the loop only advances
              // when the consumer pulls — in which a hook holding the sender
              // could hand data to a dead socket and see it silently dropped.
              const wasLive = live
              invalidateSender()
              // Only for a connection that actually connected, and only once:
              // this is what makes onConnect/onDisconnect pair exactly.
              if (wasLive && opened) invokeHook(options.onDisconnect)
            },
          })
          // Construction succeeded, so a close event is now possible: from here
          // the terminal may wait for it.
          awaitClose = closeReported

          // A transport reports a failure by rejecting, and an orderly close by
          // completing — the ordinary iterator contract. A close therefore
          // arrives here as a normal completion, and this layer turns the close
          // detail into the error the policy below classifies. Doing it here
          // rather than inside the transport keeps transports from having to
          // invent an error for something that isn't one: `closeDetail` is
          // already recorded by the `onClose` above, synchronously, before this
          // resumes.
          //
          // A consumer `break` also lands here, resuming the generator with a
          // return completion — which runs the `finally` and leaves the loop
          // without reaching the throw.
          yield* transport
          throw closeError(closeDetail)
        } catch (error) {
          // An abort is the caller's decision, not a connection failure:
          // surface the reason rather than classifying it as retryable.
          signal?.throwIfAborted()

          const willReconnect = shouldReconnect(error, retries)
          // A clean close is reported to the policy like anything else (so an
          // override can re-dial a server that closes after each batch), but
          // when the policy declines, the distinction matters: the peer ending
          // the session normally is a *completed* stream, not a failure the
          // consumer has to catch. Only an unclean end rejects.
          const wasClean = error instanceof CloseError && error.wasClean
          if (!willReconnect && wasClean) return

          invokeHook(
            options.onError,
            error,
            willReconnect ? { attempt: retries } : undefined,
          )
          if (!willReconnect) throw error

          // Backoff lives here, in the one branch that actually retries,
          // rather than at the top of the loop: the other three exits (a fatal
          // error rethrowing, a non-reconnectable clean close returning, a
          // consumer `break` resuming at the `yield*`) must not be delayed by
          // it. Post-increment so the first reconnect waits ~1s (2^0) and each
          // consecutive failure escalates; a successful open resets to 0.
          await sleep(backoffMs(retries++, maxMs), signal)
          signal?.throwIfAborted()
          // Loop: re-resolve the url and redial.
        } finally {
          // Also detaches the forwarding listener, which is bound to this
          // controller's own signal.
          teardown.abort()
        }
      }
    } finally {
      // The single terminal transition. Reaching the generator body started
      // this stream, so this runs however it ends — fatal error,
      // non-reconnectable close, abort, or a consumer `break` — and exactly
      // once. A generator that was never pulled never gets here: no
      // lifecycle, no `onClose`.
      // One source of truth for the close detail: whatever the transport
      // reported. On the paths where the socket is closed politely rather than
      // destroyed, its close event is asynchronous and lands just after the
      // generator unwinds — so wait for it, bounded, rather than synthesizing a
      // second answer here.
      //
      // NB the guarantee is "our end is closed", not "the peer acknowledged":
      // both `ws` and WHATWG fire their close event as soon as the local socket
      // is done (measured at +1ms, well before the peer observes anything).
      // Waiting on the peer is not something a client can do — a close handshake
      // it never answers would hang teardown indefinitely.
      if (closeDetail === undefined && awaitClose !== undefined) {
        await Promise.race([awaitClose, sleep(CLOSE_GRACE_MS, undefined)])
      }
      invokeHook(options.onClose, closeDetail ?? NO_STATUS_DETAIL)
    }
  }
}

// The error a completed transport iteration is classified as. A transport
// completes rather than rejecting when the connection closed in an orderly way,
// so there is always a recorded detail — but synthesize an abnormal close if a
// transport ever completes without reporting one, rather than classifying
// `undefined`.
function closeError(detail: CloseEventDetail | undefined): CloseError {
  const { code, reason, wasClean } = detail ?? ABNORMAL_CLOSE_DETAIL
  return new CloseError(code, reason, wasClean)
}

function normalizeShouldReconnect(
  option: boolean | ((error: unknown, attempt: number) => boolean) | undefined,
): (error: unknown, attempt: number) => boolean {
  if (typeof option === 'function') return option
  if (option === false) return () => false
  return (error) => defaultShouldReconnect(error)
}

// The transport-facing subset of the caller's options: everything except this
// layer's own concerns (reconnect policy, backoff, the caller's hooks) and the
// per-connection wiring the loop supplies itself.
//
// `dataMode` is optional to a caller but required by a transport, so the
// default is resolved here — at the one boundary that has to state it — rather
// than being re-defaulted inside each transport.
function connectionOptions<M extends DataMode>(
  options: WebSocketOptions<M>,
): Omit<ConnectionOptions<M>, 'dataMode'> & { dataMode: M } {
  return {
    dataMode: options.dataMode ?? ('auto' as M),
    protocols: options.protocols,
    headers: options.headers,
    heartbeat: options.heartbeat,
    idleTimeoutMs: options.idleTimeoutMs,
    highWaterMark: options.highWaterMark,
    maxBufferedBytes: options.maxBufferedBytes,
  }
}

// Forwards an abort from `source` (the caller's signal, if any) into `target`,
// preserving the reason — which is what decides how the socket ends.
//
// The listener is bound with `{ signal: target.signal }`, so aborting the target
// detaches it: there is no separate cleanup to remember, and a per-attempt
// controller that is always aborted in a `finally` can never leak one.
function forwardAbort(
  source: AbortSignal | undefined,
  target: AbortController,
): void {
  source?.addEventListener('abort', () => target.abort(source.reason), {
    once: true,
    signal: target.signal,
  })
}

// Resolves after `ms`, or promptly when `signal` aborts — never rejects; the
// caller classifies the stop itself.
//
// NB: the timer stays ref'd. A process whose only pending work is this backoff
// must stay alive to reconnect rather than exiting mid-wait.
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onStop)
      resolve()
    }, ms)
    const onStop = () => {
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', onStop, { once: true })
  })
}
