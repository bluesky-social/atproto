import { z } from 'zod'
import { ValidationError } from '@atproto/lexicon'

export type QueryParams = Record<string, any>
export type Headers = Record<string, string>

export interface CallOptions {
  encoding?: string
  headers?: Headers
}

export interface FetchHandlerResponse {
  status: number
  headers: Headers
  body: ArrayBuffer | undefined
}

export type FetchHandler = (
  httpUri: string,
  httpMethod: string,
  httpHeaders: Headers,
  httpReqBody: any,
) => Promise<FetchHandlerResponse>

export const errorResponseBody = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
})
export type ErrorResponseBody = z.infer<typeof errorResponseBody>

export enum ResponseType {
  Unknown = 1,
  InvalidResponse = 2,
  Success = 200,
  InvalidRequest = 400,
  AuthRequired = 401,
  Forbidden = 403,
  XRPCNotSupported = 404,
  PayloadTooLarge = 413,
  RateLimitExceeded = 429,
  InternalServerError = 500,
  MethodNotImplemented = 501,
  UpstreamFailure = 502,
  NotEnoughResources = 503,
  UpstreamTimeout = 504,
}

export const ResponseTypeNames = {
  [ResponseType.InvalidResponse]: 'InvalidResponse',
  [ResponseType.Success]: 'Success',
  [ResponseType.InvalidRequest]: 'InvalidRequest',
  [ResponseType.AuthRequired]: 'AuthenticationRequired',
  [ResponseType.Forbidden]: 'Forbidden',
  [ResponseType.XRPCNotSupported]: 'XRPCNotSupported',
  [ResponseType.PayloadTooLarge]: 'PayloadTooLarge',
  [ResponseType.RateLimitExceeded]: 'RateLimitExceeded',
  [ResponseType.InternalServerError]: 'InternalServerError',
  [ResponseType.MethodNotImplemented]: 'MethodNotImplemented',
  [ResponseType.UpstreamFailure]: 'UpstreamFailure',
  [ResponseType.NotEnoughResources]: 'NotEnoughResources',
  [ResponseType.UpstreamTimeout]: 'UpstreamTimeout',
}

export const ResponseTypeStrings = {
  [ResponseType.InvalidResponse]: 'Invalid Response',
  [ResponseType.Success]: 'Success',
  [ResponseType.InvalidRequest]: 'Invalid Request',
  [ResponseType.AuthRequired]: 'Authentication Required',
  [ResponseType.Forbidden]: 'Forbidden',
  [ResponseType.XRPCNotSupported]: 'XRPC Not Supported',
  [ResponseType.PayloadTooLarge]: 'Payload Too Large',
  [ResponseType.RateLimitExceeded]: 'Rate Limit Exceeded',
  [ResponseType.InternalServerError]: 'Internal Server Error',
  [ResponseType.MethodNotImplemented]: 'Method Not Implemented',
  [ResponseType.UpstreamFailure]: 'Upstream Failure',
  [ResponseType.NotEnoughResources]: 'Not Enough Resources',
  [ResponseType.UpstreamTimeout]: 'Upstream Timeout',
}

export class XRPCResponse {
  success = true

  constructor(public data: any, public headers: Headers) {}
}

export class XRPCError extends Error {
  success = false
  headers?: Headers

  constructor(
    public status: ResponseType,
    public error?: string,
    message?: string,
    headers?: Headers,
  ) {
    super(message || error || ResponseTypeStrings[status])
    if (!this.error) {
      this.error = ResponseTypeNames[status]
    }
    this.headers = headers
  }
}

export class XRPCInvalidResponseError extends XRPCError {
  constructor(
    public lexiconNsid: string,
    public validationError: ValidationError,
    public responseBody: unknown,
  ) {
    super(
      ResponseType.InvalidResponse,
      ResponseTypeStrings[ResponseType.InvalidResponse],
      `The server gave an invalid response and may be out of date.`,
    )
  }
}
