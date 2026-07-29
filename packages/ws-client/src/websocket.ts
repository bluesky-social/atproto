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
 * The receive, liveness, and flow-control options a transport accepts. The
 * per-connection wiring (`url`, `signal`, `onOpen`, `onClose`) is omitted
 * because the reconnect loop supplies it for itself, so a caller can't collide
 * with it.
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
   * The stream is live for the first time. Fires once, just before the first
   * `onConnect`, and pairs with `onClose` to bookend the stream.
   *
   * Takes no sender: per-connection concerns belong to `onConnect`, which fires
   * for the first connection too.
   *
   * Hooks are called with `this` pinned to `null` and must not throw — a thrown
   * error is re-thrown as an uncaught exception on a microtask.
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
   * Pairs with `onConnect` exactly, and a dial that never connected produces
   * neither. So a stream stuck retrying reports one `onDisconnect` for the
   * connection it lost, then an `onError` per failed dial.
   *
   * This, not `onError`, is where to stop using a sender: the loop only advances
   * when the consumer pulls, so `onError` can arrive long after the socket died.
   */
  onDisconnect?: () => void
  /**
   * A connection ended with an error. `reconnect` is present (with the attempt
   * count) when a retry is coming, absent when giving up.
   */
  onError?: (error: unknown, reconnect?: { attempt: number }) => void
  /**
   * The stream ended. Fires exactly once per started stream, however it ended,
   * and only once the local socket is closed — so a caller can treat it as
   * "teardown is done".
   *
   * `detail` is whatever the transport observed. `wasClean: true` means the
   * close was orderly on our end, not that the peer acknowledged it.
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
 * stream spans reconnects, so a consumer never has to notice that the underlying
 * connection was torn down and replaced. Ends on `break`, `throw`, or an aborted
 * `signal`.
 *
 * An `AsyncGenerator` rather than a bare `AsyncIterable`, so a consumer can use
 * `next()` or `return()` if it wants to. The runtime object is a generator
 * either way, and a quieter type would only hide that.
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

// Reported when a stream ends with no close frame ever having applied — e.g. a
// stop while parked in backoff between attempts. 1005 is the WHATWG convention
// for "no status received".
const NO_STATUS_DETAIL: CloseEventDetail = {
  code: CloseCode.NoStatus,
  reason: '',
  wasClean: false,
}

// How long the terminal waits for a politely-closed connection to report its
// close before reporting "no status" instead. Bounded so an unresponsive peer
// delays teardown briefly rather than forever.
const CLOSE_GRACE_MS = 1_000

/**
 * Binds a platform transport factory into the public `websocket()` generator.
 * Called once per entrypoint; the `#transport` imports condition selects the
 * platform.
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
    // backoff restarts at ~1s after any stable open and only escalates across
    // repeated failures with nothing working in between.
    let retries = 0
    let firstOpen = true
    // This attempt's close detail, recorded synchronously by the transport's
    // `onClose` below — so it is already set when a completed `yield*` resumes.
    // Both the thrown CloseError and the terminal hook report it.
    let closeDetail: CloseEventDetail | undefined
    // The current connection's close promise, awaited by the terminal when no
    // detail has arrived yet. Undefined before the first connection.
    let awaitClose: Promise<void> | undefined

    try {
      // The generator body doesn't run until the first pull, so an
      // already-aborted signal rejects that first `next()` rather than the call
      // that created the generator.
      signal?.throwIfAborted()

      for (;;) {
        const resolved = typeof url === 'function' ? await url() : url
        // Resolving the url is an async gap: an abort that lands while it's in
        // flight must not fall through to a connection nothing tears down.
        signal?.throwIfAborted()

        // A transport is created already connecting and has no close method —
        // aborting is the only way to end it. Forwarding the caller's signal in
        // means an outer abort reaches the socket; aborting in the `finally`
        // means every exit path tears the connection down exactly once.
        const teardown = new AbortController()
        forwardAbort(signal, teardown)
        // Hooks get a sender scoped to this connection rather than the transport
        // itself, so it can be revoked as soon as the connection ends — see the
        // onClose wiring below.
        let live = true
        let opened = false
        // Both of these are per-attempt, and must be cleared here rather than
        // only written on success: a detail left over from an earlier connection
        // would be reported as this stream's ending, and an `awaitClose` armed
        // for a transport that never got constructed would never settle,
        // stalling the terminal for the full grace period.
        closeDetail = undefined
        awaitClose = undefined
        // Settles when the transport reports this connection's close. The
        // terminal awaits it so `onClose` fires with the transport's own detail,
        // and only once the connection has really finished.
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
              // Stop accepting writes on the scoped sender *now*. Waiting for
              // the loop to notice would leave a window — the loop only advances
              // when the consumer pulls — in which a hook holding the sender
              // could hand data to a dead socket and see it silently dropped.
              const wasLive = live
              invalidateSender()
              // Only for a connection that actually connected, and only once:
              // this is what makes onConnect/onDisconnect pair exactly.
              if (wasLive && opened) invokeHook(options.onDisconnect)
            },
          })
          // Construction succeeded, so a close event is now possible and the
          // terminal may wait for it.
          awaitClose = closeReported

          // Per the ordinary iterator contract, a transport reports a failure by
          // rejecting and an orderly close by completing. So a close arrives
          // here as a normal completion, and this layer turns its detail into
          // the error the policy below classifies — which saves transports from
          // inventing an error for something that isn't one. `closeDetail` was
          // recorded synchronously by the `onClose` above, before this resumed.
          //
          // A consumer `break` also lands here, resuming with a return
          // completion: it runs the `finally` and leaves the loop without
          // reaching the throw.
          yield* transport
          throw closeError(closeDetail)
        } catch (error) {
          // An abort is the caller's decision, not a connection failure:
          // surface the reason rather than classifying it as retryable.
          signal?.throwIfAborted()

          const willReconnect = shouldReconnect(error, retries)
          // A clean close goes to the policy like anything else, so an override
          // can re-dial a server that closes after each batch. But when the
          // policy declines, a peer that ended the session normally is a
          // *completed* stream, not a failure the consumer has to catch — only
          // an unclean end rejects.
          const wasClean = error instanceof CloseError && error.wasClean
          if (!willReconnect && wasClean) return

          invokeHook(
            options.onError,
            error,
            willReconnect ? { attempt: retries } : undefined,
          )
          if (!willReconnect) throw error

          // Backoff lives in the one branch that actually retries rather than at
          // the top of the loop, because the other three exits (a fatal error
          // rethrowing, a non-reconnectable clean close returning, a consumer
          // `break` resuming at the `yield*`) must not be delayed by it.
          // Post-increment so the first reconnect waits ~1s (2^0) and each
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
      // The single terminal transition. Reaching the generator body started this
      // stream, so this runs however it ends, exactly once. A generator that was
      // never pulled never gets here: no lifecycle, no `onClose`.
      //
      // The close detail has one source: whatever the transport reported. Where
      // the socket is closed politely rather than destroyed, its close event is
      // asynchronous and lands just after the generator unwinds — so wait for
      // it, bounded, rather than synthesizing a second answer here.
      //
      // NB that means "our end is closed", not "the peer acknowledged". Both
      // `ws` and WHATWG fire close as soon as the local socket is done, well
      // before the peer sees anything, and waiting on the peer isn't something a
      // client can do: a handshake it never answers would hang teardown.
      if (closeDetail === undefined && awaitClose !== undefined) {
        await Promise.race([awaitClose, sleep(CLOSE_GRACE_MS, undefined)])
      }
      invokeHook(options.onClose, closeDetail ?? NO_STATUS_DETAIL)
    }
  }
}

// The error a completed transport iteration is classified as. A transport only
// completes when the connection closed in an orderly way, so there is always a
// recorded detail — but synthesize an abnormal close if one ever completes
// without reporting one, rather than classifying `undefined`.
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
// layer's own concerns (reconnect policy, backoff, hooks) and the per-connection
// wiring the loop supplies itself.
//
// `dataMode` is optional to a caller but required by a transport, so the default
// is resolved here, at the one boundary that has to state it, rather than being
// re-defaulted inside each transport.
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
// Bound with `{ signal: target.signal }`, so aborting the target detaches the
// listener. There's no separate cleanup to remember, and a per-attempt
// controller that's always aborted in a `finally` can never leak one.
function forwardAbort(
  source: AbortSignal | undefined,
  target: AbortController,
): void {
  source?.addEventListener('abort', () => target.abort(source.reason), {
    once: true,
    signal: target.signal,
  })
}

// Resolves after `ms`, or promptly when `signal` aborts. Never rejects — the
// caller classifies the stop itself.
//
// NB the timer stays ref'd: a process whose only pending work is this backoff
// should stay alive to reconnect rather than exiting mid-wait.
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
