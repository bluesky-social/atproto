import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import {
  InferMethodError,
  Procedure,
  Query,
  ResultFailure,
  lexErrorData,
} from '@atproto/lex-schema'
import { XrpcPayload } from './util.js'

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
    lexErrorData.matches(payload.body)
  )
}

export function isXrpcMethodErrorPayload<M extends Procedure | Query>(
  method: M,
  payload: XrpcPayload | null,
): payload is XrpcErrorPayload<InferMethodError<M>> {
  return (
    method.errors != null &&
    isXrpcErrorPayload(payload) &&
    method.errors.includes(payload.body.error)
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
> extends XrpcError<M, InferMethodError<M>, XrpcResponseError<M>> {
  name = 'XrpcResponseError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload: XrpcErrorPayload<InferMethodError<M>>,
    options?: ErrorOptions,
  ) {
    const { error, message } = payload.body
    super(method, error, message, options)
  }

  override get reason() {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  override matchesSchema(): this is XrpcResponseError<M> {
    return true
  }

  override toJSON() {
    return this.payload.body
  }

  override toResponse(): Response {
    const { status, headers } = this.response
    return Response.json(this.toJSON(), { status, headers })
  }

  get body(): LexErrorData {
    return this.payload.body
  }
}

/**
 * This class represents an invalid XRPC response from the server.
 */
export class XrpcUpstreamError<
  M extends Procedure | Query = Procedure | Query,
  N extends 'InvalidResponse' | 'UpstreamFailure' =
    | 'InvalidResponse'
    | 'UpstreamFailure',
> extends XrpcError<M, N, XrpcUpstreamError<M, N>> {
  name = 'XrpcUpstreamError'

  constructor(
    method: M,
    readonly response: Response,
    readonly payload: XrpcPayload | null,
    error: N,
    message: string = `${error} upstream XRPC error`,
    options?: ErrorOptions,
  ) {
    super(method, error, message, { cause: options?.cause })
  }

  override get reason() {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  override toResponse(): Response {
    return Response.json(this.toJSON(), { status: 502 })
  }
}

export class XrpcUnexpectedError<
  M extends Procedure | Query = Procedure | Query,
  TReason = unknown,
> extends XrpcError<M, 'InternalServerError', TReason> {
  name = 'XrpcUnexpectedError'

  constructor(
    method: M,
    override readonly reason: TReason,
    message: string = reason instanceof LexError
      ? reason.message
      : 'XRPC request failed',
    options?: Omit<ErrorOptions, 'cause'>,
  ) {
    super(method, 'InternalServerError', message, { ...options, cause: reason })
  }

  override shouldRetry(): true {
    return true
  }

  override toResponse(): Response {
    return Response.json(this.toJSON(), { status: 500 })
  }
}

export type XrpcFailure<M extends Procedure | Query = Procedure | Query> =
  // The server returned a valid XRPC error response
  | XrpcResponseError<M>
  // The response was not a valid XRPC response, or it does not match the schema
  | XrpcUpstreamError<M>
  // Something went wrong (network error, etc.)
  | XrpcUnexpectedError<M>

export function asXrpcFailure<M extends Procedure | Query>(
  method: M,
  value: unknown,
): XrpcFailure<M> {
  if (
    (value instanceof XrpcResponseError ||
      value instanceof XrpcUpstreamError ||
      value instanceof XrpcUnexpectedError) &&
    value.method === method
  ) {
    return value
  }

  return new XrpcUnexpectedError(method, value)
}
