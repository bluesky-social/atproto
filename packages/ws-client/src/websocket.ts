import { CloseCode } from './lib/close-codes.js'
import { CloseError, WebSocketConnectionError } from './lib/errors.js'
import { invokeHook } from './lib/invoke-hook.js'
import { backoffMs, defaultShouldReconnect } from './lib/reconnect-policy.js'
import type {
  CloseEventDetail,
  DataMode,
  MessageOf,
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
   * The first connection succeeded. Fires once. `sender` is valid until that
   * connection ends, after which its `send()` rejects.
   *
   * Hooks are called with `this` pinned to `null` and must not throw — a
   * thrown error is re-thrown as an uncaught exception on a microtask.
   */
  onOpen?: (sender: Sender<M>) => void
  /** A later connection succeeded; fires per reconnect with the fresh sender. */
  onReconnect?: (sender: Sender<M>) => void
  /**
   * The current connection ended, so the sender last handed out is now dead.
   * Fires once per connection that opened, before any `onError`/`onReconnect`
   * for the same event, and independently of whether a retry follows.
   *
   * Distinct from `onClose`, which fires once for the whole stream: this is
   * the per-connection edge, and it is the reliable point at which to stop
   * using a sender. Waiting for `onError` is not equivalent — the loop only
   * advances when the consumer pulls, so a hook could otherwise hand data to
   * a socket that has already gone away.
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
   * signal, or a consumer `break`.
   */
  onClose?: (detail: CloseEventDetail) => void
}

export type NodeWebSocketOptions<M extends DataMode = 'auto'> =
  WebSocketOptions<M>
export type BrowserWebSocketOptions<M extends DataMode = 'auto'> = Omit<
  WebSocketOptions<M>,
  'headers'
>

export type WebSocketFn = <M extends DataMode = 'auto'>(
  url: string | URL | (() => Awaitable<string | URL>),
  options?: WebSocketOptions<M>,
) => AsyncGenerator<MessageOf<M>, void, undefined>

// The detail reported when a stream ends without any close frame having
// applied — e.g. a stop while parked in backoff between attempts. 1005 is the
// WHATWG convention for "no status received".
const NO_STATUS_DETAIL: CloseEventDetail = {
  code: CloseCode.NoStatus,
  reason: '',
  wasClean: false,
}

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
  ): AsyncGenerator<MessageOf<M>, void, undefined> {
    const { signal } = options
    const maxMs = 1000 * (options.maxReconnectSeconds ?? 64)
    const shouldReconnect = normalizeShouldReconnect(options.shouldReconnect)

    // Consecutive failed connections since the last successful open, so the
    // backoff restarts at ~1s after any stable open and escalates only across
    // repeated failures with nothing working in between.
    let retries = 0
    let firstAttempt = true
    let firstOpen = true
    // The most recent connection's close detail, re-reported by the terminal
    // hook below. Undefined when no close frame ever applied.
    let lastDetail: CloseEventDetail | undefined

    try {
      // The generator body doesn't run until the first pull, so an
      // already-aborted signal surfaces here — rejecting that first `next()`
      // rather than at the call that created the generator.
      signal?.throwIfAborted()

      for (;;) {
        if (!firstAttempt) {
          await sleep(backoffMs(retries, maxMs), signal)
          signal?.throwIfAborted()
          // Escalate for the *next* consecutive failure; a successful open
          // resets this to 0.
          retries++
        }
        firstAttempt = false

        const resolved = typeof url === 'function' ? await url() : url
        // Resolving the url is an async gap: an abort landing while it was in
        // flight must not fall through to a connection nothing tears down.
        signal?.throwIfAborted()

        // A transport is created already connecting and has no close method —
        // its signal is the only teardown channel. Linking the caller's signal
        // in means an outer abort reaches the socket; aborting in the `finally`
        // means every exit path tears this connection down exactly once.
        const connection = new AbortController()
        const unlink = link(signal, connection)
        // Hooks receive a sender scoped to this connection rather than the
        // transport itself, so it can be revoked the moment the connection
        // ends — see the onClose wiring below.
        let live = true
        let opened = false
        const invalidateSender = () => {
          live = false
        }
        try {
          const transport = createTransport<M>({
            ...connectionOptions(options),
            url: resolved,
            signal: connection.signal,
            onOpen: (sender) => {
              retries = 0 // a stable open: the backoff starts over
              opened = true
              const scoped: Sender<M> = {
                send: (data) =>
                  live
                    ? sender.send(data)
                    : Promise.reject(
                        new WebSocketConnectionError(
                          'WebSocket is not open: this connection has ended',
                        ),
                      ),
              }
              if (firstOpen) {
                firstOpen = false
                invokeHook(options.onOpen, scoped)
              } else {
                invokeHook(options.onReconnect, scoped)
              }
            },
            onClose: (detail) => {
              lastDetail = detail
              // This connection is over, so the sender handed to onOpen /
              // onReconnect must stop accepting writes *now*. Waiting for the
              // loop to notice would leave a window — the loop only advances
              // when the consumer pulls — in which a hook holding the sender
              // could hand data to a dead socket and see it silently dropped.
              const wasLive = live
              invalidateSender()
              // Only report the edge for a connection that actually opened,
              // and only once.
              if (wasLive && opened) invokeHook(options.onDisconnect)
            },
          })

          // Every way a connection ends arrives here as a throw — the
          // transports surface even a clean close as a `CloseError` carrying
          // its code, precisely so the policy below can classify it. So this
          // never falls through: it either throws, or the consumer stopped us
          // (a `break` resumes the generator at this `yield*` with a return
          // completion, which runs the `finally` and leaves the loop).
          yield* transport
          return
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
          // Loop: backoff, then re-resolve the url and redial.
        } finally {
          unlink()
          connection.abort()
        }
      }
    } finally {
      // The single terminal transition. Reaching the generator body started
      // this stream, so this runs however it ends — fatal error,
      // non-reconnectable close, abort, or a consumer `break` — and exactly
      // once. A generator that was never pulled never gets here: no
      // lifecycle, no `onClose`.
      invokeHook(options.onClose, lastDetail ?? NO_STATUS_DETAIL)
    }
  }
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

// Forwards an outer abort into a per-connection controller, returning a
// detach function. Bound with `{ signal }` so it self-removes when the
// connection ends — no manual listener bookkeeping — and idempotent, since
// the caller detaches and aborts in the same `finally`.
function link(
  signal: AbortSignal | undefined,
  connection: AbortController,
): () => void {
  if (!signal) return () => {}
  const onAbort = () => connection.abort(signal.reason)
  signal.addEventListener('abort', onAbort, {
    once: true,
    signal: connection.signal,
  })
  return () => signal.removeEventListener('abort', onAbort)
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
