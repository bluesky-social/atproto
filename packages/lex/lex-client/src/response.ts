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

export type LexRpcErrorName = KnownError | l.UnknownString
export const lexRpcErrorNameSchema: l.Validator<LexRpcErrorName> = l.string({
  minLength: 1,
  knownValues: Object.keys(KnownError) as LexRpcErrorName[],
})

export type LexRpcErrorBody<N extends LexRpcErrorName = LexRpcErrorName> = {
  error: N
  message?: string
}
export const lexRpcErrorBodySchema: l.Validator<LexRpcErrorBody> = l.object(
  {
    error: lexRpcErrorNameSchema,
    message: l.string(),
  },
  {
    required: ['error'],
  },
)

export type LexRpcResponseSuccess<S extends l.Procedure | l.Query = any> = {
  success: true
  status: number
  headers: Headers
  encoding: l.InferPayloadEncoding<S['output']>
  body: l.InferPayloadBody<S['output']>
}

export type LexRpcResponseFailure<S extends l.Procedure | l.Query = any> =
  S extends { errors: readonly (infer I extends string)[] }
    ? {
        success: false
        status: number
        headers: Headers
        encoding: 'application/json'
        body: l.Simplify<Omit<LexRpcErrorBody, 'error'> & { error: I }>
      }
    : never

export type LexRpcResponse<S extends l.Procedure | l.Query = any> =
  | LexRpcResponseSuccess<S>
  | LexRpcResponseFailure<S>
