import { CloseCode } from './lib/close-codes.js'
import { CloseError, UnexpectedResponseError } from './lib/errors.js'
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
  WebSocketHandle,
} from './transport/transport.js'
import { takeWebSocket } from './websocket-response.js'

export type Awaitable<T> = T | Promise<T>

/**
 * The request a {@link WebSocketUrl} function performs when it opens the
 * connection itself: a `GET` with the handshake headers (`Connection`,
 * `Upgrade` and, from `protocols`, `Sec-WebSocket-Protocol`) plus the caller's
 * `headers`, and the attempt's teardown signal.
 */
export interface WebSocketHandshakeInit extends RequestInit {
  method: 'GET'
  headers: Headers
  signal: AbortSignal
}

/**
 * Where to connect. A function is invoked for every connection attempt,
 * reconnects included, and returns either the URL to dial, or the `Response`
 * to a handshake it performed itself — typically by passing the
 * {@link WebSocketHandshakeInit} to a `fetch()` created with
 * `createWebSocketFetch()`, possibly through wrappers adding credentials or
 * retrying the request. Such a response is a `101` that the stream takes over;
 * any other status fails the attempt with an {@link UnexpectedResponseError}.
 *
 * A function that throws or rejects fails the attempt like a connection
 * failure, classified by `shouldReconnect`.
 */
export type WebSocketUrl =
  | string
  | URL
  | ((init: WebSocketHandshakeInit) => Awaitable<string | URL | Response>)

/**
 * The receive, liveness, and flow-control options a transport accepts, as a
 * caller supplies them. The per-connection wiring (`url`, `signal`, `onOpen`,
 * `onClose`) is omitted because the reconnect loop supplies it for itself, so a
 * caller can't collide with it.
 *
 * `Partial` because a transport's own contract requires every field — being
 * internal, it is spelled `undefined | T` so a missing one is a type error at the
 * single call site (see {@link TransportOptions}). Out here every field is
 * genuinely optional, and {@link connectionOptions} bridges the two.
 */
type ConnectionOptions<M extends DataMode> = Partial<
  Omit<
    TransportOptions<M>,
    'url' | 'signal' | 'dataMode' | 'onOpen' | 'onClose'
  >
> & { dataMode?: M }

export interface WebSocketOptions<
  M extends DataMode,
  T = MessageOf<M>,
> extends ConnectionOptions<M> {
  /** Exponential-backoff ceiling in seconds. Default 64. */
  maxReconnectSeconds?: number
  /**
   * Turns each message into what the stream yields, in the scope of the
   * connection that received it. Runs synchronously when the consumer pulls the
   * message, not when it arrives, so it adds no work to the receive path.
   *
   * The return value is yielded; `undefined` skips the message. A throw ends
   * the connection that delivered the message — its undelivered buffer is
   * discarded and it closes with 1000 — and the error is then classified by
   * `shouldReconnect` exactly like a transport failure: a retry reports it to
   * `onReconnect` and the stream carries on over a new connection, anything
   * else reports it to `onError` and the iterator rejects with it. This is how a
   * caller turns a message that proves the connection is unusable (a malformed
   * frame, a protocol-level error message) into a reconnect or a terminal
   * failure, rather than having to end the whole stream.
   */
  parseMessage?: (message: MessageOf<M>) => T | undefined
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
   * connection it lost, then an `onReconnect` per failed dial.
   *
   * This, not `onReconnect`, is where to stop using a sender: the loop only
   * advances when the consumer pulls, so `onReconnect` can arrive long after the
   * socket died.
   */
  onDisconnect?: () => void
  /**
   * A connection ended with an error the stream will not retry, so this is the
   * end of the stream. The same error is what the iterator rejects with, so a
   * caller can handle it here, in a `catch` around the loop, or both.
   */
  onError?: (error: unknown) => void
  /**
   * A connection ended with an error and a retry is coming, `attempt` counting
   * consecutive failures since the last successful open (so `0` is the first
   * retry of a cycle).
   *
   * Unlike `onError` this is the *only* place such a failure surfaces: the stream
   * swallows it and keeps going, so a caller that wants to see transient trouble
   * has to observe it here.
   */
  onReconnect?: (error: unknown, reconnect: { attempt: number }) => void
  /**
   * The stream ended. Fires exactly once per started stream, however it ended,
   * and only once the local socket is closed — so a caller can treat it as
   * "teardown is done". The end of a `for await` over the stream carries the same
   * guarantee, since a transport settles its iteration only after its socket has
   * closed.
   *
   * `detail` is whatever the transport observed, or a 1006 abnormal close if the
   * stream ended without any connection having closed — a stop while parked in
   * backoff between attempts, say. `wasClean: true` means the close was orderly
   * on our end, not that the peer acknowledged it.
   */
  onClose?: (detail: CloseEventDetail) => void
}

/**
 * A reconnecting stream of WebSocket messages: `for await` over it and the
 * stream spans reconnects, so a consumer never has to notice that the
 * underlying connection was torn down and replaced. Ends on `break`, `throw`,
 * or an aborted `signal` (see {@link WebSocketOptions.signal}). When throwing,
 * or aborting, use a {@link CloseError} to control the close code and message
 * sent to the server; any other value results in a normal close with code 1000
 * and no message.
 */
export type WebSocketIterable<
  M extends DataMode = 'auto',
  T = MessageOf<M>,
> = AsyncGenerator<T, void, unknown>

/**
 * Binds a platform transport factory into the public `websocket()` generator.
 * Called once per entrypoint; the `#transport` imports condition selects the
 * platform.
 */

export async function* websocketFactory<
  M extends DataMode = 'auto',
  T = MessageOf<M>,
>(
  url: WebSocketUrl,
  createTransport: TransportFactory,
  options: WebSocketOptions<M, T> = {},
): WebSocketIterable<M, T> {
  const { signal, parseMessage } = options
  const maxMs = 1000 * (options.maxReconnectSeconds ?? 64)
  const shouldReconnect = normalizeShouldReconnect(options.shouldReconnect)

  // Consecutive failed connections since the last successful open, so the
  // backoff restarts at ~1s after any stable open and only escalates across
  // repeated failures with nothing working in between.
  let retries = 0
  let firstOpen = true
  // How the last connection ended, recorded by the transport's `onClose` below.
  // A transport settles its iteration only after its socket has closed, so this
  // is always already set when a `yield*` resumes or rejects — which is what
  // lets both the thrown CloseError and the terminal hook read it directly,
  // with no synchronization of their own.
  let closeDetail: CloseEventDetail | undefined

  try {
    for (;;) {
      // One abort check for every way this loop is entered: the first pull (the
      // generator body doesn't run until then, so an already-aborted signal
      // rejects that `next()` rather than the call that created the generator),
      // and each re-entry after a backoff.
      signal?.throwIfAborted()

      // A transport is created already connecting and has no close method —
      // aborting is the only way to end it. Forwarding the caller's signal in
      // means an outer abort reaches the socket; aborting in the `finally`
      // means every exit path tears the connection down exactly once.
      const teardown = new AbortController()
      forwardAbort(signal, teardown)
      let opened = false
      // Per-attempt, and cleared here rather than only written on success: a
      // detail left over from an earlier connection would otherwise be reported
      // as this stream's ending.
      closeDetail = undefined
      try {
        // Read once per attempt, since `headers` may be an iterable computing
        // them as it is iterated: what was read is what this attempt sends,
        // through the url function's handshake or through the transport.
        const headers = new Headers(options.headers)

        // Resolved inside the `try`, since the url function may perform the
        // handshake itself: it fails like any connection attempt.
        const target =
          typeof url === 'function'
            ? await url(handshakeInit(headers, options, teardown.signal))
            : url
        // Resolving the url is an async gap of its own: an abort that lands while
        // it's in flight must not fall through to a connection nothing tears down.
        signal?.throwIfAborted()

        const socket =
          target instanceof Response ? await upgradedSocket(target) : undefined

        const transport = createTransport<M>({
          // The transport-facing subset of the caller's options
          dataMode: options.dataMode ?? ('auto' as M),
          protocols: options.protocols,
          headers,
          heartbeat: options.heartbeat,
          idleTimeoutMs: options.idleTimeoutMs,
          highWaterMark: options.highWaterMark,
          maxBufferedBytes: options.maxBufferedBytes,
          // Transport options wired by this websocket implementation and not directly by the caller
          url: target instanceof Response ? undefined : target,
          socket,
          signal: teardown.signal,
          // The sender handed out is the transport's own: its send() already
          // rejects once this connection is no longer open, which the
          // transport knows the moment its socket closes, errors, or aborts.
          onOpen: (sender) => {
            retries = 0 // a stable open: the backoff starts over
            opened = true
            // onOpen bookends the stream and fires once, before the first
            // onConnect; onConnect fires for every connection including this
            // one.
            if (firstOpen) {
              firstOpen = false
              invokeHook(options.onOpen)
            }
            invokeHook(options.onConnect, sender)
          },
          onClose: (detail) => {
            closeDetail = detail
            // Only for a connection that actually connected, and only once:
            // this is what makes onConnect/onDisconnect pair exactly.
            if (opened) {
              opened = false
              invokeHook(options.onDisconnect)
            }
          },
        })

        // Per the ordinary iterator contract, a transport reports a failure by
        // rejecting and an orderly close by completing. So a close arrives
        // here as a normal completion, and this layer turns its detail into
        // the error the policy below classifies — which saves transports from
        // inventing an error for something that isn't one. `closeDetail` is
        // always already recorded here, since a transport settles its iteration
        // only after its socket has closed.
        //
        // A consumer `break` also lands here, resuming with a return
        // completion: it runs the `finally` and leaves the loop without
        // reaching the throw.
        if (parseMessage) {
          // Same teardown as `yield*` on every exit: a throw from
          // `parseMessage`, or a consumer `break` or `throw()` at the `yield`,
          // makes the `for await` close the transport through `return()`, which
          // settles only once the socket is down. A throw then reaches the
          // `catch` below and is classified like any connection failure.
          for await (const message of transport) {
            const value = parseMessage(message)
            if (value !== undefined) yield value
          }
        } else {
          // Without a parser the stream yields raw messages, which is what `T`
          // defaults to.
          yield* transport as AsyncIterable<T>
        }
        throw closeError(closeDetail)
      } catch (error) {
        // An abort is the caller's decision, not a connection failure:
        // surface the reason rather than classifying it as retryable.
        signal?.throwIfAborted()

        const willReconnect = shouldReconnect(error, retries)
        // A 1000 close goes to the policy like anything else, so an override can
        // re-dial a server that closes after each batch. But when the policy
        // declines, a peer that ended the session normally is a *completed*
        // stream, not a failure the consumer has to catch.
        //
        // Keyed on the code rather than on `wasClean`, which asks a different
        // question: whether the closing handshake completed. A fatal 1002
        // protocol close completes its handshake too, and must still reject.
        const endedNormally =
          error instanceof CloseError && error.code === CloseCode.Normal
        if (!willReconnect && endedNormally) return

        // Two hooks rather than one with an optional argument, because they
        // report different things: `onReconnect` is the only place a swallowed
        // failure surfaces, while an `onError` error is also what the iterator
        // rejects with — so a caller can handle it there or in a `catch`.
        if (!willReconnect) {
          invokeHook(options.onError, error)
          throw error
        }
        invokeHook(options.onReconnect, error, { attempt: retries })

        // Backoff lives in the one branch that actually retries rather than at
        // the top of the loop, because the other three exits (a fatal error
        // rethrowing, a non-reconnectable clean close returning, a consumer
        // `break` resuming at the `yield*`) must not be delayed by it.
        // Post-increment so the first reconnect waits ~1s (2^0) and each
        // consecutive failure escalates; a successful open resets to 0.
        await sleep(backoffMs(retries++, maxMs), signal)
        // Loop: the check at the top catches an abort that landed during the
        // backoff, then the url is re-resolved and redialed.
      } finally {
        // Also detaches the forwarding listener, which is bound to this
        // controller's own signal.
        teardown.abort()
      }
    }
  } finally {
    // The single terminal transition: runs however the stream ends, exactly
    // once. A generator that was never pulled never gets here.
    //
    // No waiting for the close: a transport settles its iteration only after
    // its socket has closed and its detail was reported, so by the time this
    // runs there is nothing left to synchronize with. `closeDetail` is unset
    // only when no connection ever closed — a stop while parked in backoff, or
    // a transport that threw at construction — where an abnormal close is the
    // honest answer.
    invokeHook(options.onClose, closeDetail ?? ABNORMAL_CLOSE_DETAIL)
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

function handshakeInit<M extends DataMode, T>(
  callerHeaders: Headers,
  options: WebSocketOptions<M, T>,
  signal: AbortSignal,
): WebSocketHandshakeInit {
  // A copy: the caller's headers also go to the transport, if the url function
  // returns a URL rather than a handshake response.
  const headers = new Headers(callerHeaders)
  headers.set('connection', 'Upgrade')
  headers.set('upgrade', 'websocket')
  const protocols = [options.protocols ?? []].flat()
  if (protocols.length > 0) {
    headers.set('sec-websocket-protocol', protocols.join(', '))
  }
  return { method: 'GET', headers, signal }
}

// The connection of a handshake response, if it was upgraded.
async function upgradedSocket(response: Response): Promise<WebSocketHandle> {
  const socket = takeWebSocket(response)
  if (socket) return socket
  // Refused by the server, or performed by a fetch that cannot open WebSockets.
  await response.body?.cancel().catch(() => {})
  throw new UnexpectedResponseError(
    response.status,
    response.statusText,
    response.headers,
  )
}

function normalizeShouldReconnect(
  option: boolean | ((error: unknown, attempt: number) => boolean) | undefined,
): (error: unknown, attempt: number) => boolean {
  if (typeof option === 'function') return option
  if (option === false) return () => false
  return defaultShouldReconnect
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
// The timer stays ref'd on purpose: a process whose only pending work is this
// backoff should stay alive to reconnect rather than exiting mid-wait.
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
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
