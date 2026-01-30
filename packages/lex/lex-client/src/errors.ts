import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import {
  InferMethodError,
  Procedure,
  Query,
  ResultFailure,
  lexErrorDataSchema,
} from '@atproto/lex-schema'
import { XrpcPayload } from './util.js'
import {
  WWWAuthenticate,
  parseWWWAuthenticateHeader,
} from './www-authenticate.js'

export const RETRYABLE_HTTP_STATUS_CODES: ReadonlySet<number> = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

export { LexError }
export type { LexErrorCode, LexErrorData }

export type XrpcErrorPayload<N extends LexErrorCode = LexErrorCode> =
  XrpcPayload<LexErrorData<N>, 'application/json'>

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
  payload: XrpcPayload | null,
): payload is XrpcErrorPayload {
  return (
    payload !== null &&
    payload.encoding === 'application/json' &&
    lexErrorDataSchema.matches(payload.body)
  )
}

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
 * Class used to represent an HTTP request that resulted in an XRPC method
 * error. That is, a non-2xx response with a valid XRPC error payload.
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
export class XrpcAuthenticationError<
  M extends Procedure | Query = Procedure | Query,
  N extends LexErrorCode = LexErrorCode,
> extends XrpcResponseError<M, N> {
  name = 'XrpcAuthenticationError'

  override shouldRetry(): boolean {
    return false
  }

  #wwwAuthenticate?: WWWAuthenticate
  get wwwAuthenticate(): WWWAuthenticate {
    return (this.#wwwAuthenticate ??=
      parseWWWAuthenticateHeader(
        this.response.headers.get('www-authenticate'),
      ) ?? {})
  }
}

/**
 * This class represents invalid or unprocessable XRPC response from the
 * upstream server.
 */
export class XrpcUpstreamError<
  M extends Procedure | Query = Procedure | Query,
> extends XrpcError<M, 'UpstreamFailure', XrpcUpstreamError<M>> {
  name = 'XrpcUpstreamError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload: XrpcPayload | null,
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

export type XrpcFailure<M extends Procedure | Query = Procedure | Query> =
  // The server returned a valid XRPC error response
  | XrpcResponseError<M>
  // The response was not a valid XRPC response, or it does not match the schema
  | XrpcUpstreamError<M>
  // Something went wrong (network error, etc.)
  | XrpcInternalError<M>

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
