import { l } from '@atproto/lex-schema'
import { Payload } from './util.js'

export enum KnownError {
  Unknown = 'Unknown',
  AuthenticationRequired = 'AuthenticationRequired',
  Forbidden = 'Forbidden',
  InternalServerError = 'InternalServerError',
  InvalidRequest = 'InvalidRequest',
  InvalidResponse = 'InvalidResponse',
  MethodNotImplemented = 'MethodNotImplemented',
  NotAcceptable = 'NotAcceptable',
  NotEnoughResources = 'NotEnoughResources',
  PayloadTooLarge = 'PayloadTooLarge',
  RateLimitExceeded = 'RateLimitExceeded',
  UnsupportedMediaType = 'UnsupportedMediaType',
  UpstreamFailure = 'UpstreamFailure',
  UpstreamTimeout = 'UpstreamTimeout',
  XRPCNotSupported = 'XRPCNotSupported',
}

/**
 * This is basically an {@link l.ResultFailure} with an `error` string property
 * to identify the type of XRPC error encountered.
 */
export type XrpcFailure<N extends string, E> = l.ResultFailure<E> & {
  error: N
}

export type XrpcErrorName = l.UnknownString | KnownError
export const xrpcErrorNameSchema = l.string({
  minLength: 1,
})

export type XrpcErrorBody<N extends XrpcErrorName = XrpcErrorName> = {
  error: N
  message?: string
}
export const xrpcErrorBodySchema = l.object({
  error: xrpcErrorNameSchema,
  message: l.optional(l.string()),
})

/**
 * @implements {XrpcFailure<N, XrpcError<N>>} for convenience in result handling contexts.
 */
export class XrpcError<N extends XrpcErrorName = XrpcErrorName>
  extends Error
  implements XrpcFailure<N, XrpcError<N>>
{
  name = 'XrpcError'

  constructor(
    public readonly error: N,
    message: string = error === KnownError.InvalidResponse
      ? `XRPC service returned an invalid response`
      : error === KnownError.InternalServerError
        ? `XRPC service encountered an internal error`
        : error === KnownError.UpstreamFailure ||
            error === KnownError.UpstreamTimeout
          ? `XRPC service upstream error`
          : `XRPC ${error} error`,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  /** @see {@link l.ResultFailure.success} */
  readonly success = false as const

  /** @see {@link l.ResultFailure.reason} */
  get reason(): this {
    return this
  }

  isKnownErrorFor<T extends l.Procedure | l.Query>(
    ns: T | { main: T },
  ): this is T extends { errors: readonly (infer E extends string)[] }
    ? XrpcError<E>
    : never {
    const schema = 'main' in ns ? ns.main : ns
    if (!schema.errors?.length) return false
    return schema.errors.includes(this.error)
  }

  static isKnownErrorFor<T extends l.Procedure | l.Query>(
    error: unknown,
    ns: T | { main: T },
  ): error is T extends { errors: readonly (infer E extends string)[] }
    ? XrpcError<E>
    : never {
    const schema = 'main' in ns ? ns.main : ns
    if (!schema.errors?.length) return false
    if (!(error instanceof XrpcError)) return false
    return schema.errors.includes(error.error)
  }

  static from(cause: unknown, message?: string): XrpcError {
    if (cause instanceof XrpcError) {
      return cause
    }
    return new XrpcError(
      'Unknown',
      message ?? (cause instanceof Error ? cause.message : undefined),
      { cause },
    )
  }
}

export class XrpcServiceError<
  N extends XrpcErrorName = XrpcErrorName,
> extends XrpcError<N> {
  name = 'XrpcServiceError'

  constructor(
    name: N,
    public readonly status: number,
    public readonly headers: Headers,
    public readonly payload: null | Payload,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(name, message, options)
  }
}

export class XrpcResponseError<
  N extends XrpcErrorName = XrpcErrorName,
  B extends XrpcErrorBody<N> = XrpcErrorBody<N>,
> extends XrpcError<N> {
  name = 'XrpcResponseError'
  constructor(
    public readonly status: number,
    public readonly headers: Headers,
    public readonly body: B,
    options?: ErrorOptions,
  ) {
    super(body.error, body.message, options)
  }
}

export type XrpcRequestFailure<M extends l.Procedure | l.Query> =
  // The server responded with a declared error.
  | (M extends { errors: readonly (infer N extends string)[] }
      ? XrpcResponseError<N> // implements XrpcRequestFailure<N, XrpcResponseError<N>>
      : never)
  // The server responded with an error that is not declared in the method's
  // `errors` list.
  | XrpcFailure<'Unknown', XrpcResponseError>
  // An unexpected error occurred (e.g., network error, invalid response, etc.)
  | XrpcFailure<'UnexpectedError', unknown>

export function asXrpcRequestFailureFor<M extends l.Procedure | l.Query>(
  schema: M,
) {
  // Performance: Using .bind instead of arrow function to avoid creating a closure
  return asXrpcRequestFailure.bind(schema) as (
    error: unknown,
  ) => XrpcRequestFailure<M>
}

function asXrpcRequestFailure<M extends l.Procedure | l.Query>(
  this: M,
  reason: unknown,
): XrpcRequestFailure<M> {
  if (!(reason instanceof XrpcResponseError)) {
    return { success: false, reason, error: 'UnexpectedError' }
  }

  if (!this.errors?.includes(reason.error)) {
    return { success: false, reason, error: 'Unknown' }
  }

  return reason
}
