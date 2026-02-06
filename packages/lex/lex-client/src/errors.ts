import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import {
  InferMethodError,
  Procedure,
  Query,
  ResultFailure,
  lexErrorDataSchema,
} from '@atproto/lex-schema'
import { XrpcResponsePayload } from './util.js'
import {
  WWWAuthenticate,
  parseWWWAuthenticateHeader,
} from './www-authenticate.js'

/**
 * HTTP status codes that indicate a transient error that may succeed on retry.
 *
 * Includes:
 * - 408 Request Timeout
 * - 425 Too Early
 * - 429 Too Many Requests (rate limited)
 * - 500 Internal Server Error
 * - 502 Bad Gateway
 * - 503 Service Unavailable
 * - 504 Gateway Timeout
 * - 522 Connection Timed Out (Cloudflare)
 * - 524 A Timeout Occurred (Cloudflare)
 */
export const RETRYABLE_HTTP_STATUS_CODES: ReadonlySet<number> = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

export { LexError }
export type { LexErrorCode, LexErrorData }

/**
 * The payload structure for XRPC error responses.
 *
 * All XRPC errors return JSON with an `error` code and optional `message`.
 *
 * @typeParam N - The specific error code type
 */
export type XrpcErrorPayload<N extends LexErrorCode = LexErrorCode> = {
  body: LexErrorData<N>
  encoding: 'application/json'
}

/**
 * All unsuccessful responses should follow a standard error response
 * schema. The Content-Type should be application/json, and the payload
 * should be a JSON object with the following fields:
 *
 * - `error` (string, required): type name of the error (generic ASCII
 *   constant, no whitespace)
 * - `message` (string, optional): description of the error, appropriate for
 *   display to humans
 *
 * This function checks whether a given payload matches this schema.
 */
export function isXrpcErrorPayload(
  payload: XrpcResponsePayload | null | undefined,
): payload is XrpcErrorPayload {
  return (
    payload != null &&
    payload.encoding === 'application/json' &&
    lexErrorDataSchema.matches(payload.body)
  )
}

/**
 * Abstract base class for all XRPC errors.
 *
 * Extends {@link LexError} and implements {@link ResultFailure} for use with
 * safe/result-based error handling patterns.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 * @typeParam N - The error code type
 * @typeParam TReason - The reason type for ResultFailure
 *
 * @see {@link XrpcResponseError} - For valid XRPC error responses
 * @see {@link XrpcUpstreamError} - For invalid/unexpected responses
 * @see {@link XrpcInternalError} - For network/internal errors
 */
export abstract class XrpcError<
    M extends Procedure | Query = Procedure | Query,
    N extends LexErrorCode = LexErrorCode,
    TReason = unknown,
  >
  extends LexError<N>
  implements ResultFailure<TReason>
{
  name = 'XrpcError'

  constructor(
    readonly method: M,
    error: N,
    message: string = `${error} Lexicon RPC error`,
    options?: ErrorOptions,
  ) {
    super(error, message, options)
  }

  /**
   * @see {@link ResultFailure.success}
   */
  readonly success = false as const

  /**
   * @see {@link ResultFailure.reason}
   */
  abstract readonly reason: TReason

  /**
   * Indicates whether the error is transient and can be retried.
   */
  abstract shouldRetry(): boolean

  matchesSchema(): this is XrpcError<M, InferMethodError<M>> {
    return this.method.errors?.includes(this.error) ?? false
  }
}

/**
 * Error class for valid XRPC error responses from the server.
 *
 * This represents a properly formatted XRPC error where the server returned
 * a non-2xx status with a valid JSON error payload containing `error` and
 * optional `message` fields.
 *
 * Use {@link matchesSchema} to check if the error matches the method's declared
 * error types for type-safe error handling.
 *
 * @typeParam M - The XRPC method type
 * @typeParam N - The error code type (inferred from method or generic)
 *
 * @example Handling specific errors
 * ```typescript
 * try {
 *   await client.xrpc(someMethod, options)
 * } catch (err) {
 *   if (err instanceof XrpcResponseError && err.error === 'RecordNotFound') {
 *     // Handle not found case
 *   }
 * }
 * ```
 */
export class XrpcResponseError<
  M extends Procedure | Query = Procedure | Query,
  N extends LexErrorCode = InferMethodError<M> | LexErrorCode,
> extends XrpcError<M, N, XrpcResponseError<M, N>> {
  name = 'XrpcResponseError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload: XrpcErrorPayload<N>,
    options?: ErrorOptions,
  ) {
    const { error, message } = payload.body
    super(method, error, message, options)
  }

  override get reason(): this {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  override toJSON() {
    return this.payload.body
  }

  override toResponse(): Response {
    // Re-expose schema-valid errors as-is to downstream clients
    if (this.matchesSchema()) {
      const status = this.response.status >= 500 ? 502 : this.response.status
      return Response.json(this.toJSON(), { status })
    }

    return this.response.status >= 500
      ? // The upstream server had an error, return a generic upstream failure
        Response.json({ error: 'UpstreamFailure' }, { status: 502 })
      : // If the error is on our side, return a generic internal server error
        Response.json({ error: 'InternalServerError' }, { status: 500 })
  }

  get body(): LexErrorData {
    return this.payload.body
  }
}

export type { WWWAuthenticate }

/**
 * Error class for 401 Unauthorized XRPC responses.
 *
 * Extends {@link XrpcResponseError} with access to parsed WWW-Authenticate header
 * information, useful for implementing authentication flows.
 *
 * Authentication errors are never retryable as they require user intervention
 * (e.g., re-authentication, token refresh).
 *
 * @typeParam M - The XRPC method type
 * @typeParam N - The error code type
 *
 * @example Handling authentication errors
 * ```typescript
 * try {
 *   await client.xrpc(someMethod, options)
 * } catch (err) {
 *   if (err instanceof XrpcAuthenticationError) {
 *     const { DPoP } = err.wwwAuthenticate
 *     if (DPoP?.error === 'use_dpop_nonce') {
 *       // Handle DPoP nonce requirement
 *     }
 *   }
 * }
 * ```
 */
export class XrpcAuthenticationError<
  M extends Procedure | Query = Procedure | Query,
  N extends LexErrorCode = LexErrorCode,
> extends XrpcResponseError<M, N> {
  name = 'XrpcAuthenticationError'

  override shouldRetry(): boolean {
    return false
  }

  #wwwAuthenticateCached?: WWWAuthenticate
  /**
   * Parsed WWW-Authenticate header from the response.
   * Contains authentication scheme parameters (e.g., Bearer realm, DPoP nonce).
   */
  get wwwAuthenticate(): WWWAuthenticate {
    return (this.#wwwAuthenticateCached ??=
      parseWWWAuthenticateHeader(
        this.response.headers.get('www-authenticate'),
      ) ?? {})
  }
}

/**
 * Error class for invalid or unprocessable XRPC responses from upstream servers.
 *
 * This occurs when the server returns a response that doesn't conform to the
 * XRPC protocol, such as:
 * - Missing or invalid Content-Type header
 * - Response body that doesn't match the method's output schema
 * - Non-JSON error responses
 * - Responses from non-XRPC endpoints
 *
 * The error code is always 'UpstreamFailure' and maps to HTTP 502 Bad Gateway
 * when converted to a response.
 *
 * @typeParam M - The XRPC method type
 */
export class XrpcUpstreamError<
  M extends Procedure | Query = Procedure | Query,
> extends XrpcError<M, 'UpstreamFailure', XrpcUpstreamError<M>> {
  name = 'XrpcUpstreamError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload: XrpcResponsePayload | null = null,
    message: string = `Unexpected upstream XRPC response`,
    options?: ErrorOptions,
  ) {
    super(method, 'UpstreamFailure', message, options)
  }

  override get reason(): this {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  override toResponse(): Response {
    return Response.json(this.toJSON(), { status: 502 })
  }
}

/**
 * Error class for internal/client-side errors during XRPC requests.
 *
 * This represents errors that occur before or during the request that are not
 * server responses, such as:
 * - Network errors (connection refused, DNS failure)
 * - Request timeouts
 * - Request aborted via AbortSignal
 * - Invalid request construction
 *
 * The error code is always 'InternalServerError' and these errors are
 * optimistically considered retryable.
 *
 * @typeParam M - The XRPC method type
 */
export class XrpcInternalError<
  M extends Procedure | Query = Procedure | Query,
> extends XrpcError<M, 'InternalServerError', XrpcInternalError<M>> {
  name = 'XrpcInternalError'

  constructor(method: M, message?: string, options?: ErrorOptions) {
    super(
      method,
      'InternalServerError',
      message ?? 'Unable to fulfill XRPC request',
      options,
    )
  }

  override get reason(): this {
    return this
  }

  override shouldRetry(): true {
    // Ideally, we would inspect the reason to determine if it's retryable
    // (by detecting network errors, timeouts, etc.). Since these cases are
    // highly platform-dependent, we optimistically assume all internal
    // errors are retryable.
    return true
  }

  override toResponse(): Response {
    // Do not expose internal error details to downstream clients
    return Response.json({ error: this.error }, { status: 500 })
  }
}

/**
 * Union type of all possible XRPC failure types.
 *
 * Used as the return type for safe/non-throwing XRPC methods. Check the
 * `success` property to distinguish between success and failure:
 *
 * @typeParam M - The XRPC method type
 *
 * @example
 * ```typescript
 * const result = await client.xrpcSafe(someMethod, options)
 * if (result.success) {
 *   console.log(result.body) // XrpcResponse
 * } else {
 *   // result is XrpcFailure (XrpcResponseError | XrpcUpstreamError | XrpcInternalError)
 *   console.error(result.error, result.message)
 * }
 * ```
 */
export type XrpcFailure<M extends Procedure | Query = Procedure | Query> =
  // The server returned a valid XRPC error response
  | XrpcResponseError<M>
  // The response was not a valid XRPC response, or it does not match the schema
  | XrpcUpstreamError<M>
  // Something went wrong (network error, etc.)
  | XrpcInternalError<M>

/**
 * Converts an unknown error into an appropriate {@link XrpcFailure} type.
 *
 * If the error is already an XrpcFailure for the given method, returns it as-is.
 * Otherwise, wraps it in an {@link XrpcInternalError}.
 *
 * @param method - The XRPC method that was called
 * @param cause - The error to convert
 * @returns An XrpcFailure instance
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch(...)
 *   // ... process response
 * } catch (err) {
 *   return asXrpcFailure(method, err)
 * }
 * ```
 */
export function asXrpcFailure<M extends Procedure | Query>(
  method: M,
  cause: unknown,
): XrpcFailure<M> {
  if (
    cause instanceof XrpcResponseError ||
    cause instanceof XrpcUpstreamError ||
    cause instanceof XrpcInternalError
  ) {
    if (cause.method === method) return cause
  }

  return new XrpcInternalError(method, undefined, { cause })
}
