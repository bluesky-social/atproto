import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import {
  Procedure,
  Query,
  ResultFailure,
  lexErrorData,
} from '@atproto/lex-schema'
import { XrpcPayload } from './util.js'

export const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, 425, 429, 500, 502, 503, 504, 522, 524,
])

export { LexError }
export type { LexErrorCode, LexErrorData }

export class XrpcError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'XrpcError'

  constructor(
    error: N,
    message: string = `${error} Lexicon RPC error`,
    options?: ErrorOptions,
  ) {
    super(error, message, options)
  }

  shouldRetry(): boolean {
    return false
  }
}

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

/**
 * Interface representing a failed XRPC request result.
 */
type LexRpcFailureResult<N extends LexErrorCode, E> = ResultFailure<E> & {
  readonly error: N
  matchesSchema(): boolean
}

/**
 * Class used to represent an HTTP request that resulted in an XRPC method error
 * That is, a non-2xx response with a valid XRPC error payload.
 */
export class XrpcResponseError<
    M extends Procedure | Query = Procedure | Query,
    N extends LexErrorCode = LexErrorCode,
  >
  extends XrpcError<N>
  implements LexRpcFailureResult<N, XrpcResponseError<M, N>>
{
  name = 'XrpcResponseError'

  constructor(
    readonly method: M,
    readonly status: number,
    readonly headers: Headers,
    readonly payload: XrpcErrorPayload<N>,
    options?: ErrorOptions,
  ) {
    const { error, message } = payload.body
    super(error, message, options)
  }

  readonly success = false

  get reason(): this {
    return this as this
  }

  get body(): LexErrorData {
    return this.payload.body
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.status)
  }

  matchesSchema(): this is M extends {
    errors: readonly (infer E extends string)[]
  }
    ? XrpcResponseError<M, E>
    : never {
    return this.method.errors?.includes(this.error) ?? false
  }

  toJSON() {
    return this.payload.body
  }

  toResponse(): Response {
    const { status, headers } = this
    return Response.json(this.toJSON(), { status, headers })
  }
}

/**
 * This class represents an invalid XRPC response from the server.
 */
export class XrpcUpstreamError<
    N extends 'InvalidResponse' | 'UpstreamFailure' =
      | 'InvalidResponse'
      | 'UpstreamFailure',
  >
  extends XrpcError<N>
  implements LexRpcFailureResult<N, XrpcUpstreamError<N>>
{
  name = 'XrpcUpstreamError' as const

  // For debugging purposes, we keep the response details here
  readonly response: {
    status: number
    headers: Headers
    payload: XrpcPayload | null
  }

  constructor(
    error: N,
    message: string,
    response: { status: number; headers: Headers },
    payload: XrpcPayload | null,
    options?: ErrorOptions,
  ) {
    super(error, message, { cause: options?.cause })
    this.response = {
      status: response.status,
      headers: response.headers,
      payload,
    }
  }

  readonly success = false as const

  get reason(): this {
    return this
  }

  override shouldRetry(): boolean {
    return RETRYABLE_HTTP_STATUS_CODES.has(this.response.status)
  }

  matchesSchema(): false {
    return false
  }

  toResponse(): Response {
    return Response.json(this.toJSON(), { status: 502 })
  }
}

export class XrpcUnexpectedError
  extends XrpcError<'InternalServerError'>
  implements LexRpcFailureResult<'InternalServerError', unknown>
{
  name = 'XrpcUnexpectedError' as const

  protected constructor(message: string, options: Required<ErrorOptions>) {
    super('InternalServerError', message, options)
  }

  readonly success = false

  get reason() {
    return this.cause
  }

  override shouldRetry(): boolean {
    return true
  }

  matchesSchema(): false {
    return false
  }

  toResponse(): Response {
    return Response.json(this.toJSON(), { status: 500 })
  }

  static from(
    cause: unknown,
    message: string = cause instanceof LexError
      ? cause.message
      : 'XRPC request failed',
  ): XrpcUnexpectedError {
    if (cause instanceof XrpcUnexpectedError) return cause
    return new XrpcUnexpectedError(message, { cause })
  }
}

export type XrpcFailure<M extends Procedure | Query> =
  // The server returned a valid XRPC error response
  | XrpcResponseError<M>
  // The response was not a valid XRPC response, or it does not match the schema
  | XrpcUpstreamError
  // Something went wrong (network error, etc.)
  | XrpcUnexpectedError

export function isXrpcFailure<M extends Procedure | Query = Procedure | Query>(
  result: unknown,
): result is XrpcFailure<M> {
  return (
    result instanceof XrpcResponseError ||
    result instanceof XrpcUpstreamError ||
    result instanceof XrpcUnexpectedError
  )
}

/**
 * Utility method to type cast the error thrown by {@link xrpc} to an
 * {@link XrpcFailure} matching the provided method. Only use this function
 * inside a catch block right after calling {@link xrpc}, and use the same
 * method type parameter as used in the {@link xrpc} call.
 */
export function asXrpcFailure<M extends Procedure | Query = Procedure | Query>(
  err: unknown,
): XrpcFailure<M> {
  if (err instanceof XrpcResponseError) return err
  if (err instanceof XrpcUpstreamError) return err
  return XrpcUnexpectedError.from(err)
}
