import {
  LexError,
  LexErrorCode,
  LexErrorData,
  LexValue,
} from '@atproto/lex-data'
import {
  InferMethodError,
  LexValidationError,
  Procedure,
  Query,
  ResultFailure,
  lexErrorDataSchema,
} from '@atproto/lex-schema'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Agent } from './agent.js'
import { XrpcUnknownResponsePayload } from './types.js'
import {
  WWWAuthenticate,
  parseWWWAuthenticateHeader,
} from './www-authenticate.js'

/**
 * Mapping that allows generating an XRPC error code from an HTTP status code
 * when the response does not contain a valid XRPC error payload. This is used
 * to convert non-XRPC error responses from upstream servers into a standardized
 * XRPC error for downstream clients.
 */
const StatusErrorCodes = new Map<number, LexErrorCode>([
  [400, 'InvalidRequest'],
  [401, 'AuthenticationRequired'],
  [403, 'Forbidden'],
  [404, 'XRPCNotSupported'],
  [406, 'NotAcceptable'],
  [413, 'PayloadTooLarge'],
  [415, 'UnsupportedMediaType'],
  [429, 'RateLimitExceeded'],
  [500, 'InternalServerError'],
  [501, 'MethodNotImplemented'],
  [502, 'UpstreamFailure'],
  [503, 'NotEnoughResources'],
  [504, 'UpstreamTimeout'],
])

export type { XrpcUnknownResponsePayload }

export type DownstreamError<N extends LexErrorCode = LexErrorCode> = {
  status: number
  headers?: Headers
  encoding?: 'application/json'
  body: LexErrorData<N>
}

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
  payload: XrpcUnknownResponsePayload | null | undefined,
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
 * @see {@link XrpcInvalidResponseError} - For invalid/unexpected responses
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

  abstract toDownstreamError(): DownstreamError

  matchesSchemaErrors(): this is XrpcError<M, InferMethodError<M>> {
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
 * Use {@link matchesSchemaErrors} to check if the error matches the method's declared
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
> extends XrpcError<M, LexErrorCode, XrpcResponseError<M>> {
  name = 'XrpcResponseError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload?: XrpcUnknownResponsePayload,
    options?: ErrorOptions,
  ) {
    const { error, message } = isXrpcErrorPayload(payload)
      ? payload.body
      : {
          error:
            StatusErrorCodes.get(response.status) ??
            (response.status >= 500 ? 'UpstreamFailure' : 'InvalidRequest'),
          message: buildResponseOverviewMessage(response),
        }
    super(method, error, message, options)
  }

  override get reason(): this {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  override toJSON(): LexErrorData {
    // Return the original error payload if it's a valid XRPC error, otherwise
    // convert to an XRPC error format.
    const { payload } = this
    if (isXrpcErrorPayload(payload)) {
      return payload.body
    }

    return super.toJSON()
  }

  override toDownstreamError(): DownstreamError {
    const { status, headers } = this.response
    // If the upstream server returned a 500 error, we want to return a 502 Bad
    // Gateway to downstream clients, as the issue is with the upstream server,
    // not us. We still return the original error code and message in the body
    // for transparency, but we do not want to expose internal server errors
    // from the upstream server as-is to downstream clients.
    return {
      status: status === 500 ? 502 : status,
      headers: stripHopByHopHeaders(headers),
      body: this.toJSON(),
    }
  }

  get status(): number {
    return this.response.status
  }

  get headers(): Headers {
    return this.response.headers
  }

  get body(): undefined | Uint8Array | LexValue {
    return this.payload?.body
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
> extends XrpcResponseError<M> {
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
 * The error code is always 'InvalidResponse' and maps to HTTP 502 Bad Gateway
 * when converted to a response. This should allow downstream clients to
 * determine at which boundary the error occurred.
 *
 * @typeParam M - The XRPC method type
 */
export class XrpcInvalidResponseError<
  M extends Procedure | Query = Procedure | Query,
> extends XrpcError<M, 'InvalidResponse', XrpcInvalidResponseError<M>> {
  name = 'XrpcInvalidResponseError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload?: XrpcUnknownResponsePayload,
    message: string = buildResponseOverviewMessage(response),
    options?: ErrorOptions,
  ) {
    super(method, 'InvalidResponse', message, options)
  }

  override get reason(): this {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  override toDownstreamError(): DownstreamError {
    return { status: 502, body: this.toJSON() }
  }
}

/**
 * Error class for invalid XRPC responses that fail schema validation.
 *
 * This is a specific type of {@link XrpcInvalidResponseError} that indicates the
 * upstream server returned a response that was structurally valid but did not
 * conform to the expected schema for the method. This likely indicates a
 * mismatch between client and server versions or an issue with the server's
 * XRPC implementation.
 *
 * @typeParam M - The XRPC method type
 */
export class XrpcResponseValidationError<
  M extends Procedure | Query = Procedure | Query,
> extends XrpcInvalidResponseError<M> {
  name = 'XrpcResponseValidationError'

  constructor(
    method: M,
    response: Response,
    payload: XrpcUnknownResponsePayload,
    readonly cause: LexValidationError,
  ) {
    super(
      method,
      response,
      payload,
      `Invalid response payload: ${cause.message}`,
      { cause },
    )
  }
}

/**
 * Error class for unexpected internal/client-side errors during XRPC requests.
 *
 * The error code is always 'InternalServerError' and these errors not
 * considered retryable as they stem from unforeseen issues in the
 * implementation.
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

  override shouldRetry(): boolean {
    return false
  }

  override toJSON(): LexErrorData {
    // @NOTE Do not expose internal error details to downstream clients
    return { error: this.error, message: 'Internal Server Error' }
  }

  override toDownstreamError(): DownstreamError {
    return { status: 500, body: this.toJSON() }
  }
}

/**
 * Special case of XrpcInternalError that specifically represents errors thrown
 * by {@link Agent.fetchHandler} during the XRPC request. This includes:
 * - Network errors (connection refused, DNS failure)
 * - Request timeouts
 * - Request aborted via AbortSignal
 *
 * These errors are optimistically considered retryable, as many fetch errors
 * are transient and may succeed on retry.
 */
export class XrpcFetchError<
  M extends Procedure | Query = Procedure | Query,
> extends XrpcInternalError<M> {
  name = 'XrpcFetchError'

  constructor(method: M, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(method, `Unexpected fetchHandler() error: ${message}`, { cause })
  }

  override shouldRetry(): boolean {
    // Ideally, we would inspect the reason to determine if it's retryable (by
    // detecting network errors, timeouts, etc.). Since these cases are highly
    // platform-dependent, we optimistically assume all fetch errors are
    // transient and retryable.
    return true
  }

  override toJSON(): LexErrorData {
    // @NOTE Do not expose internal error details to downstream clients
    return { error: this.error, message: 'Failed to perform upstream request' }
  }

  override toDownstreamError(): DownstreamError {
    // While it might technically be a 500 error, we use 502 Bad Gateway here to
    // indicate that the error occurred while communicating with the upstream
    // server, allowing downstream clients to distinguish between errors in our
    // internal processing (500) and errors in the upstream server or network
    // (502).
    return { status: 502, body: this.toJSON() }
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
 *   // result is XrpcFailure (XrpcResponseError | XrpcInvalidResponseError | XrpcInternalError)
 *   console.error(result.error, result.message)
 * }
 * ```
 */
export type XrpcFailure<M extends Procedure | Query = Procedure | Query> =
  // The server returned a valid XRPC error response
  | XrpcResponseError<M>
  // The response was not a valid XRPC response, or it does not match the schema
  | XrpcInvalidResponseError<M>
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
    cause instanceof XrpcInvalidResponseError ||
    cause instanceof XrpcInternalError
  ) {
    if (cause.method === method) return cause
  }

  return new XrpcInternalError(method, undefined, { cause })
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function stripHopByHopHeaders(headers: Headers): Headers {
  const result = new Headers(headers)

  // Remove statically known hop-by-hop headers
  for (const name of HOP_BY_HOP_HEADERS) {
    result.delete(name)
  }

  // Remove headers listed in the "Connection" header
  const connection = headers.get('connection')
  if (connection) {
    for (const name of connection.split(',')) {
      result.delete(name.trim())
    }
  }

  // These are not actually hop-by-hop headers, but we remove them because the
  // upstream payload gets parsed and re-serialized, so content length and
  // encoding may no longer be accurate.
  result.delete('content-length')
  result.delete('content-encoding')

  return result
}

function buildResponseOverviewMessage(response: Response): string {
  if (response.status < 400) {
    return `Upstream server responded with an invalid status code (${response.status})`
  }

  return `Upstream server responded with a ${response.status} error`
}
