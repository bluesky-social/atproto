import { z } from 'zod'
import { ValidationError } from '@atproto/lexicon'

export type QueryParams = Record<string, any>
export type HeadersMap = Record<string, string>

export type {
  /** @deprecated not to be confused with the WHATWG Headers constructor */
  HeadersMap as Headers,
}

export type Gettable<T> = T | (() => T)

export interface CallOptions {
  encoding?: string
  signal?: AbortSignal
  headers?: HeadersMap
}

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
  NotAcceptable = 406,
  PayloadTooLarge = 413,
  UnsupportedMediaType = 415,
  RateLimitExceeded = 429,
  InternalServerError = 500,
  MethodNotImplemented = 501,
  UpstreamFailure = 502,
  NotEnoughResources = 503,
  UpstreamTimeout = 504,
}

export function httpResponseCodeToEnum(status: number): ResponseType {
  if (status in ResponseType) {
    return status
  } else if (status >= 100 && status < 200) {
    return ResponseType.XRPCNotSupported
  } else if (status >= 200 && status < 300) {
    return ResponseType.Success
  } else if (status >= 300 && status < 400) {
    return ResponseType.XRPCNotSupported
  } else if (status >= 400 && status < 500) {
    return ResponseType.InvalidRequest
  } else {
    return ResponseType.InternalServerError
  }
}

export const ResponseTypeNames = {
  [ResponseType.Unknown]: 'Unknown',
  [ResponseType.InvalidResponse]: 'InvalidResponse',
  [ResponseType.Success]: 'Success',
  [ResponseType.InvalidRequest]: 'InvalidRequest',
  [ResponseType.AuthRequired]: 'AuthenticationRequired',
  [ResponseType.Forbidden]: 'Forbidden',
  [ResponseType.XRPCNotSupported]: 'XRPCNotSupported',
  [ResponseType.PayloadTooLarge]: 'PayloadTooLarge',
  [ResponseType.UnsupportedMediaType]: 'UnsupportedMediaType',
  [ResponseType.RateLimitExceeded]: 'RateLimitExceeded',
  [ResponseType.InternalServerError]: 'InternalServerError',
  [ResponseType.MethodNotImplemented]: 'MethodNotImplemented',
  [ResponseType.UpstreamFailure]: 'UpstreamFailure',
  [ResponseType.NotEnoughResources]: 'NotEnoughResources',
  [ResponseType.UpstreamTimeout]: 'UpstreamTimeout',
}

export function httpResponseCodeToName(status: number): string {
  return ResponseTypeNames[httpResponseCodeToEnum(status)]
}

export const ResponseTypeStrings = {
  [ResponseType.Unknown]: 'Unknown',
  [ResponseType.InvalidResponse]: 'Invalid Response',
  [ResponseType.Success]: 'Success',
  [ResponseType.InvalidRequest]: 'Invalid Request',
  [ResponseType.AuthRequired]: 'Authentication Required',
  [ResponseType.Forbidden]: 'Forbidden',
  [ResponseType.XRPCNotSupported]: 'XRPC Not Supported',
  [ResponseType.PayloadTooLarge]: 'Payload Too Large',
  [ResponseType.UnsupportedMediaType]: 'Unsupported Media Type',
  [ResponseType.RateLimitExceeded]: 'Rate Limit Exceeded',
  [ResponseType.InternalServerError]: 'Internal Server Error',
  [ResponseType.MethodNotImplemented]: 'Method Not Implemented',
  [ResponseType.UpstreamFailure]: 'Upstream Failure',
  [ResponseType.NotEnoughResources]: 'Not Enough Resources',
  [ResponseType.UpstreamTimeout]: 'Upstream Timeout',
}

export function httpResponseCodeToString(status: number): string {
  return ResponseTypeStrings[httpResponseCodeToEnum(status)]
}

export class XRPCResponse {
  success = true

  constructor(
    public data: any,
    public headers: HeadersMap,
  ) {}
}

export class XRPCError extends Error {
  success = false

  public status: ResponseType

  constructor(
    statusCode: number,
    public error: string = httpResponseCodeToName(statusCode),
    message?: string,
    public headers?: HeadersMap,
    options?: ErrorOptions,
  ) {
    super(message || error || httpResponseCodeToString(statusCode), options)

    this.status = httpResponseCodeToEnum(statusCode)

    // Pre 2022 runtimes won't handle the "options" constructor argument
    const cause = options?.cause
    if (this.cause === undefined && cause !== undefined) {
      this.cause = cause
    }
  }

  static from(cause: unknown, fallbackStatus?: ResponseType): XRPCError {
    if (cause instanceof XRPCError) {
      return cause
    }

    // Type cast the cause to an Error if it is one
    const causeErr = cause instanceof Error ? cause : undefined

    // Try and find a Response object in the cause
    const causeResponse: Response | undefined =
      cause instanceof Response
        ? cause
        : cause?.['response'] instanceof Response
          ? cause['response']
          : undefined

    const statusCode: unknown =
      // Extract status code from "http-errors" like errors
      causeErr?.['statusCode'] ??
      causeErr?.['status'] ??
      // Use the status code from the response object as fallback
      causeResponse?.status

    // Convert the status code to a ResponseType
    const status: ResponseType =
      typeof statusCode === 'number'
        ? httpResponseCodeToEnum(statusCode)
        : fallbackStatus ?? ResponseType.Unknown

    const message = causeErr?.message ?? String(cause)

    const headers = causeResponse
      ? Object.fromEntries(causeResponse.headers.entries())
      : undefined

    return new XRPCError(status, undefined, message, headers, { cause })
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
      undefined,
      { cause: validationError },
    )
  }
}
