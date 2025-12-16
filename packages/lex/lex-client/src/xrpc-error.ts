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
    message: string = `An ${error} XRPC error occurred.`,
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
export type XrpcFailureResult<
  N extends XrpcErrorCode,
  E,
> = l.ResultFailure<E> & {
  readonly error: N
  shouldRetry(): boolean
}

/**
 * Class used to represent an HTTP request that resulted in an XRPC method error
 * That is, a non-2xx response with a valid XRPC error payload.
 */
export class XrpcResponseError<N extends XrpcErrorCode = XrpcErrorCode>
  extends XrpcError<N>
  implements XrpcFailureResult<N, XrpcResponseError<N>>
{
  name = 'XrpcResponseError'

  readonly success = false
  get reason(): this {
    return this
  }

  constructor(
    readonly status: number,
    readonly headers: Headers,
    readonly payload: XrpcErrorPayload<N>,
    options?: ErrorOptions,
  ) {
    const { error, message } = payload.body
    super(error, message, options)
  }

  get body(): XrpcErrorBody<N> {
    return this.payload.body
  }

  shouldRetry(): boolean {
    // Do not retry client errors
    return this.status >= 500
  }
}

/**
 * This class represents an invalid XRPC response from the server.
 */
export class XrpcInvalidResponseError extends XrpcError<'InvalidResponse'> {
  name = 'XrpcInvalidResponseError'

  // For debugging purposes, we keep the response details here
  readonly response: {
    status: number
    headers: Headers
    payload: Payload | null
  }

  constructor(
    message: string,
    response: { status: number; headers: Headers },
    payload: Payload | null,
    options?: ErrorOptions,
  ) {
    super('InvalidResponse', message, { cause: options?.cause })
    this.response = {
      status: response.status,
      headers: response.headers,
      payload,
    }
  }
}

export class XrpcUnexpectedError
  extends XrpcError<'Unexpected'>
  implements XrpcFailureResult<'Unexpected', unknown>
{
  name = 'XrpcUnexpectedError'

  readonly success = false
  get reason() {
    return this.cause
  }

  protected constructor(message: string, options: Required<ErrorOptions>) {
    super('Unexpected', message, options)
  }

  shouldRetry(): boolean {
    const { reason } = this

    if (reason instanceof XrpcResponseError) {
      return reason.shouldRetry()
    }

    // There is no reason why retying would fix the server returning an invalid response
    if (reason instanceof XrpcInvalidResponseError) {
      return false
    }

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
