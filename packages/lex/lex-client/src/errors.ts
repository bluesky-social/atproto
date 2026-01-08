import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import { Payload } from './util.js'

export { LexError }
export type { LexErrorCode, LexErrorData }

export type LexRpcErrorPayload<N extends LexErrorCode = LexErrorCode> = Payload<
  LexErrorData<N>,
  'application/json'
>

export class LexRpcError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'LexRpcError'

  constructor(
    error: N,
    message: string = `${error} Lexicon RPC error`,
    options?: ErrorOptions,
  ) {
    super(error, message, options)
  }
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
export function isLexRpcErrorPayload(
  payload: Payload | null,
): payload is LexRpcErrorPayload {
  return (
    payload !== null &&
    payload.encoding === 'application/json' &&
    l.lexErrorData.matches(payload.body)
  )
}

/**
 * Interface representing a failed XRPC request result.
 */
type LexRpcFailureResult<N extends LexErrorCode, E> = l.ResultFailure<E> & {
  readonly error: N
  shouldRetry(): boolean
  matchesSchema(): boolean
}

/**
 * Class used to represent an HTTP request that resulted in an XRPC method error
 * That is, a non-2xx response with a valid XRPC error payload.
 */
export class LexRpcResponseError<
    M extends l.Procedure | l.Query = l.Procedure | l.Query,
    N extends LexErrorCode = LexErrorCode,
  >
  extends LexRpcError<N>
  implements LexRpcFailureResult<N, LexRpcResponseError<M, N>>
{
  name = 'LexRpcResponseError'

  constructor(
    readonly method: M,
    readonly status: number,
    readonly headers: Headers,
    readonly payload: LexRpcErrorPayload<N>,
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

  matchesSchema(): this is M extends {
    errors: readonly (infer E extends string)[]
  }
    ? LexRpcResponseError<M, E>
    : never {
    return this.method.errors?.includes(this.error) ?? false
  }

  shouldRetry(): boolean {
    // Do not retry client errors
    if (this.status < 500) return false

    return true
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
export class LexRpcUpstreamError<
    N extends 'InvalidResponse' | 'UpstreamFailure' =
      | 'InvalidResponse'
      | 'UpstreamFailure',
  >
  extends LexRpcError<N>
  implements LexRpcFailureResult<N, LexRpcUpstreamError<N>>
{
  name = 'LexRpcUpstreamError' as const

  // For debugging purposes, we keep the response details here
  readonly response: {
    status: number
    headers: Headers
    payload: Payload | null
  }

  constructor(
    error: N,
    message: string,
    response: { status: number; headers: Headers },
    payload: Payload | null,
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

  matchesSchema(): false {
    return false
  }

  shouldRetry(): boolean {
    // Do not retry client errors
    return this.response.status >= 500
  }

  toResponse(): Response {
    return Response.json(this.toJSON(), { status: 502 })
  }
}

export class LexRpcUnexpectedError
  extends LexRpcError<'InternalServerError'>
  implements LexRpcFailureResult<'InternalServerError', unknown>
{
  name = 'LexRpcUnexpectedError' as const

  protected constructor(message: string, options: Required<ErrorOptions>) {
    super('InternalServerError', message, options)
  }

  readonly success = false

  get reason() {
    return this.cause
  }

  matchesSchema(): false {
    return false
  }

  shouldRetry(): boolean {
    return true
  }

  toResponse(): Response {
    return Response.json(this.toJSON(), { status: 500 })
  }

  static from(
    cause: unknown,
    message: string = cause instanceof LexError
      ? cause.message
      : 'XRPC request failed',
  ): LexRpcUnexpectedError {
    if (cause instanceof LexRpcUnexpectedError) return cause
    return new LexRpcUnexpectedError(message, { cause })
  }
}
