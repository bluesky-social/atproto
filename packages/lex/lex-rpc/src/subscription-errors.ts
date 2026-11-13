import type { LexErrorCode, LexErrorData } from '@atproto/lex-data'
import { LexError } from '@atproto/lex-data'
import type {
  InferMethodError,
  LexValidationError,
  Subscription,
} from '@atproto/lex-schema'
import type { WebSocketClientError } from '@atproto/ws-client'
import { RETRYABLE_ERROR_CODES } from './errors.js'

/**
 * Abstract base class for every error originating from an XRPC subscription:
 * its connection, the server, or the messages it sent.
 *
 * {@link shouldRetry} is what the default reconnect policy of `xrpcSubscribe()`
 * and `Client.subscribe()` consults.
 *
 * @typeParam M - The subscription method type
 * @typeParam N - The error code type
 *
 * @see {@link XrpcSubscriptionConnectionError} - For connection failures
 * @see {@link XrpcSubscriptionServerError} - For error frames sent by the server
 * @see {@link XrpcSubscriptionInvalidMessageError} - For undecodable messages
 * @see {@link XrpcSubscriptionValidationError} - For messages not matching the schema
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
 * The connection to the subscription endpoint failed: a network error, a
 * liveness timeout, a close frame, a rejected upgrade request, etc. The
 * underlying `@atproto/ws-client` error is available as {@link cause}.
 *
 * @typeParam M - The subscription method type
 */
export class XrpcSubscriptionConnectionError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionError<M, 'UpstreamFailure'> {
  name = 'XrpcSubscriptionConnectionError'

  declare readonly cause: WebSocketClientError

  constructor(method: M, cause: WebSocketClientError) {
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
 *   for await (const message of client.subscribeRepos({ cursor })) { ... }
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
   * {@link RETRYABLE_ERROR_CODES}), as they would be for an XRPC request.
   * Errors declared by the subscription's schema, such as `FutureCursor`,
   * describe the request itself and would recur on reconnect.
   */
  shouldRetry(): boolean {
    return RETRYABLE_ERROR_CODES.has(this.error)
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
export class XrpcSubscriptionInvalidMessageError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionError<M, 'InvalidResponse'> {
  name = 'XrpcSubscriptionInvalidMessageError'

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
export class XrpcSubscriptionValidationError<
  M extends Subscription = Subscription,
> extends XrpcSubscriptionInvalidMessageError<M> {
  name = 'XrpcSubscriptionValidationError'

  constructor(
    method: M,
    readonly value: unknown,
    readonly cause: LexValidationError,
  ) {
    super(method, `Invalid message: ${cause.message}`, { cause })
  }
}
