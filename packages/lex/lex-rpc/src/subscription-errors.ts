import type { LexErrorCode, LexErrorData, LexMap } from '@atproto/lex-data'
import { LexError } from '@atproto/lex-data'
import type {
  InferMethodError,
  LexValidationError,
  Subscription,
} from '@atproto/lex-schema'
import { type RetryableErrorCode, isRetryableErrorCode } from './errors.js'
import { type TransientError, isTransientError } from './types.js'

/**
 * Abstract base class for every error originating from an XRPC subscription:
 * its params, its connection, the server, or the messages it sent.
 *
 * {@link shouldRetry} tells the agent's `websocketHandler`, to which a frame
 * that fails to decode or validate is handed back, whether to reconnect.
 *
 * @typeParam M - The subscription method type
 * @typeParam N - The error code type
 *
 * @see {@link XrpcSubscriptionParamsError} - For params that could not be built
 * @see {@link XrpcSubscriptionConnectionError} - For connection failures
 * @see {@link XrpcSubscriptionServerError} - For error frames sent by the server
 * @see {@link XrpcSubscriptionFrameError} - For undecodable messages
 * @see {@link XrpcSubscriptionMessageError} - For messages not matching the schema
 */
export abstract class XrpcSubscriptionError<
  M extends Subscription = Subscription,
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'XrpcSubscriptionError'

  constructor(
    readonly method: M,
    error: N,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(error, message, options)
  }

  /**
   * Indicates whether the error is transient, so a reconnect may succeed.
   */
  abstract shouldRetry(): boolean
}

/**
 * Whether `error` is an {@link XrpcSubscriptionError} after which a reconnect
 * may succeed (see {@link XrpcSubscriptionError.shouldRetry}). Meant for the
 * reconnect policy of a `websocketHandler`, to which a frame that fails to
 * decode or validate (an error frame included) is handed back.
 * `defaultSubscriptionShouldReconnect()`, from `@atproto/lex-rpc/subscription`
 * (the default policy of its `createWebSocketFactory()`), combines it with
 * `@atproto/ws-client`'s own `defaultShouldReconnect()`.
 *
 * @example Over `@atproto/ws-client` directly
 * ```typescript
 * import { defaultShouldReconnect, websocket } from '@atproto/ws-client'
 *
 * websocket<'binary'>(url, {
 *   dataMode: 'binary',
 *   shouldReconnect: (err) =>
 *     defaultShouldReconnect(err) || isRetryableSubscriptionError(err),
 * })
 * ```
 */
export function isRetryableSubscriptionError(error: unknown): boolean {
  return error instanceof XrpcSubscriptionError && error.shouldRetry()
}

/**
 * The URL of the subscription endpoint could not be built, before connecting:
 * a `params` function threw, or the params do not match the method's schema.
 * The underlying error is available as {@link cause}.
 *
 * Like the `XrpcInternalError` of a request, its code is `InternalServerError`,
 * the failure being the client's own. Unlike it, it is retryable when its cause
 * is (e.g. an `XrpcError` from a cursor looked up over XRPC, while that service
 * is unavailable), so that a reconnect invokes the `params` function again.
 *
 * @typeParam M - The subscription method type
 */
export class XrpcSubscriptionParamsError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionError<M, 'InternalServerError'> {
  name = 'XrpcSubscriptionParamsError'

  constructor(method: M, cause: unknown) {
    super(method, 'InternalServerError', 'Failed to build XRPC request URL', {
      cause,
    })
  }

  /** Classified by the underlying error, if it classifies itself. */
  shouldRetry(): boolean {
    return isTransientError(this.cause) && this.cause.shouldRetry()
  }
}

/**
 * The connection to the subscription endpoint failed: a network error, a
 * liveness timeout, a close frame, a rejected upgrade request, etc. The
 * underlying error, as reported by the agent's `websocketHandler`, is available
 * as {@link cause}.
 *
 * @typeParam M - The subscription method type
 */
export class XrpcSubscriptionConnectionError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionError<M, 'UpstreamFailure'> {
  name = 'XrpcSubscriptionConnectionError'

  declare readonly cause: TransientError

  constructor(method: M, cause: TransientError) {
    super(method, 'UpstreamFailure', cause.message, { cause })
  }

  /**
   * Classified by the underlying connection error (e.g. by close code, or by
   * the HTTP status of a rejected upgrade).
   */
  shouldRetry(): boolean {
    return this.cause.shouldRetry()
  }
}

/**
 * The server sent an error frame (and is expected to close the connection).
 *
 * Use {@link matchesSchemaErrors} to check whether the error code is one of
 * those declared by the subscription's schema (narrowing its type when the
 * error is typed with its method).
 *
 * @typeParam M - The subscription method type
 * @typeParam N - The error code type
 *
 * @example
 * ```typescript
 * try {
 *   for await (const message of xrpcSubscribe(relay, com.atproto.sync.subscribeRepos, {
 *     params: { cursor },
 *   })) { ... }
 * } catch (err) {
 *   if (err instanceof XrpcSubscriptionServerError && err.error === 'FutureCursor') {
 *     // The cursor is ahead of the server: start over from the live tip
 *   }
 * }
 * ```
 */
export class XrpcSubscriptionServerError<
  M extends Subscription = Subscription,
  N extends LexErrorCode = LexErrorCode,
> extends XrpcSubscriptionError<M, N> {
  name = 'XrpcSubscriptionServerError'

  constructor(method: M, body: LexErrorData<N>) {
    super(method, body.error, body.message ?? `${body.error} error frame`)
  }

  /**
   * Only the codes for an unexpected server condition are retried (see
   * {@link isRetryableErrorCode}), as they would be for an XRPC request.
   * Errors declared by the subscription's schema, such as `FutureCursor`,
   * describe the request itself and would recur on reconnect.
   */
  shouldRetry(): this is XrpcSubscriptionServerError<M, RetryableErrorCode> {
    return isRetryableErrorCode(this.error)
  }

  matchesSchemaErrors(): this is XrpcSubscriptionServerError<
    M,
    InferMethodError<M>
  > {
    return this.method.errors?.includes(this.error) ?? false
  }
}

/**
 * The server sent a frame that is not a valid XRPC event stream frame (invalid
 * CBOR, invalid header, etc.). Per the event stream specification, the
 * connection is dropped rather than the frame skipped.
 *
 * @typeParam M - The subscription method type
 */
export class XrpcSubscriptionFrameError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionError<M, 'InvalidResponse'> {
  name = 'XrpcSubscriptionFrameError'

  constructor(method: M, message: string, options?: ErrorOptions) {
    super(method, 'InvalidResponse', message, options)
  }

  /** The server would send the same (kind of) frame again. */
  shouldRetry(): boolean {
    return false
  }
}

/**
 * The server sent a message that does not match the subscription's message
 * schema. The offending (decoded) message is available as {@link value}.
 *
 * @typeParam M - The subscription method type
 */
export class XrpcSubscriptionMessageError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionFrameError<M> {
  name = 'XrpcSubscriptionMessageError'

  constructor(
    method: M,
    readonly value: LexMap,
    readonly cause: LexValidationError,
  ) {
    super(method, `Invalid message: ${cause.message}`, { cause })
  }
}
