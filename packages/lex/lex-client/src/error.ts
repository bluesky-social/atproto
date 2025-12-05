import { LexValue } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'

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

export type XrpcFailure<N extends string, E> = l.ResultFailure<E> & {
  name: N
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
  constructor(
    public readonly name: N,
    message: string = name === KnownError.InvalidResponse
      ? `XRPC service returned an invalid response`
      : name === KnownError.InternalServerError
        ? `XRPC service encountered an internal error`
        : name === KnownError.UpstreamFailure ||
            name === KnownError.UpstreamTimeout
          ? `XRPC service upstream error`
          : `XRPC ${name} error`,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  /** @see {@link l.ResultFailure.success} */
  readonly success = false as const

  /** @see {@link l.ResultFailure.error} */
  get error(): this {
    return this
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
  constructor(
    name: N,
    public readonly status: number,
    public readonly headers: Headers,
    public readonly body: undefined | LexValue,
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
  constructor(
    public readonly status: number,
    public readonly headers: Headers,
    public readonly encoding: undefined | string,
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
  | XrpcFailure<'Unknown', XrpcResponseError<string>>
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
  error: unknown,
): XrpcRequestFailure<M> {
  if (!(error instanceof XrpcResponseError)) {
    return { success: false, error, name: 'UnexpectedError' }
  }

  if (!this.errors.includes(error.name)) {
    return { success: false, error, name: 'Unknown' }
  }

  return error
}
