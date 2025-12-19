import { l } from '@atproto/lex-schema'
import { Payload } from './util.js'

export type XrpcErrorCode = string
export const xrpcErrorCodeSchema: l.Schema<XrpcErrorCode> = l.string({
  minLength: 1,
})

export class XrpcError<N extends XrpcErrorCode = XrpcErrorCode> extends Error {
  name = 'XrpcError'

  constructor(
    readonly error: N,
    message: string = `${error} XRPC error`,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export type XrpcErrorBody<N extends XrpcErrorCode = XrpcErrorCode> = {
  error: N
  message?: string
}
export type XrpcErrorPayload<N extends XrpcErrorCode = XrpcErrorCode> = {
  encoding: 'application/json'
  body: XrpcErrorBody<N>
}

const xrpcErrorBodySchema: l.Schema<XrpcErrorBody> = l.object({
  error: xrpcErrorCodeSchema,
  message: l.optional(l.string()),
})

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
  payload: Payload | null,
): payload is XrpcErrorPayload {
  return (
    payload !== null &&
    payload.encoding === 'application/json' &&
    xrpcErrorBodySchema.matches(payload.body)
  )
}

/**
 * Interface representing a failed XRPC request result.
 */
type XrpcFailureResult<N extends XrpcErrorCode, E> = l.ResultFailure<E> & {
  readonly error: N
  shouldRetry(): boolean
  matchesSchema(): boolean
}

/**
 * Class used to represent an HTTP request that resulted in an XRPC method error
 * That is, a non-2xx response with a valid XRPC error payload.
 */
export class XrpcResponseError<
    M extends l.Procedure | l.Query = l.Procedure | l.Query,
    N extends XrpcErrorCode = XrpcErrorCode,
  >
  extends XrpcError<N>
  implements XrpcFailureResult<N, XrpcResponseError<M, N>>
{
  name = 'XrpcResponseError' as const

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

  get body(): XrpcErrorBody {
    return this.payload.body
  }

  matchesSchema(): this is M extends {
    errors: readonly (infer E extends string)[]
  }
    ? XrpcResponseError<M, E>
    : never {
    return this.method.errors?.includes(this.error) ?? false
  }

  shouldRetry(): boolean {
    // Do not retry client errors
    if (this.status < 500) return false

    return true
  }
}

/**
 * This class represents an invalid XRPC response from the server.
 */
export class XrpcInvalidResponseError<
    N extends 'InvalidResponse' | 'UpstreamFailure' =
      | 'InvalidResponse'
      | 'UpstreamFailure',
  >
  extends XrpcError<N>
  implements XrpcFailureResult<N, XrpcInvalidResponseError<N>>
{
  name = 'XrpcInvalidResponseError' as const

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
}

export class XrpcUnexpectedError
  extends XrpcError<'InternalServerError'>
  implements XrpcFailureResult<'InternalServerError', unknown>
{
  name = 'XrpcUnexpectedError' as const

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

  static from(
    cause: unknown,
    message: string = cause instanceof XrpcError
      ? cause.message
      : 'XRPC request failed',
  ): XrpcUnexpectedError {
    if (cause instanceof XrpcUnexpectedError) return cause
    return new XrpcUnexpectedError(message, { cause })
  }
}
