import { LexValue } from '@atproto/lex-data'
import { Procedure, Query, l } from '@atproto/lex-schema'

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

export type XrpcErrorName = l.Infer<typeof xrpcErrorNameSchema>
export const xrpcErrorNameSchema = l.string({
  minLength: 1,
  knownValues: Object.keys(KnownError) as KnownError[],
})

export type XrpcErrorBody<N extends XrpcErrorName = XrpcErrorName> = {
  error: N
  message?: string
}
export const xrpcErrorBodySchema = l.object(
  { error: xrpcErrorNameSchema, message: l.string() },
  { required: ['error'] },
) satisfies l.Validator<XrpcErrorBody>

export class XrpcError<N extends XrpcErrorName = XrpcErrorName> extends Error {
  readonly success = false

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

  static catcher(err: unknown): XrpcError {
    if (err instanceof XrpcError) return err
    throw err
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

  catcher(err: unknown): XrpcServiceError {
    if (err instanceof XrpcServiceError) return err
    throw err
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

  static fromResponse(
    status: number,
    headers: Headers,
    encoding: undefined | string,
    body: undefined | LexValue,
  ): XrpcResponseError | XrpcServiceError {
    // All unsuccessful responses should follow a standard error response
    // schema. The Content-Type should be application/json, and the payload
    // should be a JSON object with the following fields:
    // - error (string, required): type name of the error (generic ASCII
    //   constant, no whitespace)
    // - message (string, optional): description of the error, appropriate for
    //   display to humans
    if (
      body != null &&
      encoding === 'application/json' &&
      xrpcErrorBodySchema.check(body)
    ) {
      return new XrpcResponseError(status, headers, encoding, body)
    }

    return new XrpcServiceError(
      status >= 500
        ? KnownError.InternalServerError
        : KnownError.InvalidResponse,
      status,
      headers,
      body,
    )
  }

  static catcherFor<const M extends Procedure | Query>(ns: M | { main: M }) {
    const schema = 'main' in ns ? ns.main : ns
    return catcherFor.bind(schema) as (
      err: unknown,
    ) => M extends { errors: readonly (infer N extends string)[] }
      ? XrpcResponseError<N>
      : never
  }

  static catcher(err: unknown): XrpcResponseError {
    if (err instanceof XrpcResponseError) return err
    throw err
  }
}

function catcherFor(this: Procedure | Query, err: unknown): XrpcResponseError {
  if (
    this.errors?.length &&
    err instanceof XrpcResponseError &&
    this.errors.includes(err.name)
  ) {
    return err
  }
  throw err
}
