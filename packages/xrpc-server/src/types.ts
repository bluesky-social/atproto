import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import express from 'express'
import { isHttpError } from 'http-errors'
import { z } from 'zod'
import {
  ResponseType,
  ResponseTypeStrings,
  XRPCError as XRPCClientError,
  httpResponseCodeToName,
  httpResponseCodeToString,
} from '@atproto/xrpc'

export type CatchallHandler = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) => unknown

export type Options = {
  validateResponse?: boolean
  catchall?: CatchallHandler
  payload?: {
    jsonLimit?: number
    blobLimit?: number
    textLimit?: number
  }
  rateLimits?: {
    creator: RateLimiterCreator
    global?: ServerRateLimitDescription[]
    shared?: ServerRateLimitDescription[]
  }
  /**
   * By default, errors are converted to {@link XRPCError} using
   * {@link XRPCError.fromError} before being rendered. If method handlers throw
   * error objects that are not properly rendered in the HTTP response, this
   * function can be used to properly convert them to {@link XRPCError}. The
   * provided function will typically fallback to the default error conversion
   * (`return XRPCError.fromError(err)`) if the error is not recognized.
   *
   * @note This function should not throw errors.
   */
  errorParser?: (err: unknown) => XRPCError
}

export type UndecodedParams = (typeof express.request)['query']

export type Primitive = string | number | boolean
export type Params = Record<string, Primitive | Primitive[] | undefined>

export const handlerInput = z.object({
  encoding: z.string(),
  body: z.any(),
})
export type HandlerInput = z.infer<typeof handlerInput>

export const handlerAuth = z.object({
  credentials: z.any(),
  artifacts: z.any(),
})
export type HandlerAuth = z.infer<typeof handlerAuth>

export const headersSchema = z.record(z.string())

export const handlerSuccess = z.object({
  encoding: z.string(),
  body: z.any(),
  headers: headersSchema.optional(),
})
export type HandlerSuccess = z.infer<typeof handlerSuccess>

export const handlerPipeThroughBuffer = z.object({
  encoding: z.string(),
  buffer: z.instanceof(Buffer),
  headers: headersSchema.optional(),
})

export type HandlerPipeThroughBuffer = z.infer<typeof handlerPipeThroughBuffer>

export const handlerPipeThroughStream = z.object({
  encoding: z.string(),
  stream: z.instanceof(Readable),
  headers: headersSchema.optional(),
})

export type HandlerPipeThroughStream = z.infer<typeof handlerPipeThroughStream>

export const handlerPipeThrough = z.union([
  handlerPipeThroughBuffer,
  handlerPipeThroughStream,
])

export type HandlerPipeThrough = z.infer<typeof handlerPipeThrough>

export const handlerError = z.object({
  status: z.number(),
  error: z.string().optional(),
  message: z.string().optional(),
})
export type HandlerError = z.infer<typeof handlerError>

export type HandlerOutput = HandlerSuccess | HandlerPipeThrough | HandlerError

export type XRPCReqContext = {
  auth: HandlerAuth | undefined
  params: Params
  input: HandlerInput | undefined
  req: express.Request
  res: express.Response
  resetRouteRateLimits: () => Promise<void>
}

export type XRPCHandler = (
  ctx: XRPCReqContext,
) => Promise<HandlerOutput> | HandlerOutput | undefined

export type XRPCStreamHandler = (ctx: {
  auth: HandlerAuth | undefined
  params: Params
  req: IncomingMessage
  signal: AbortSignal
}) => AsyncIterable<unknown>

export type AuthOutput = HandlerAuth | HandlerError

export interface AuthVerifierContext {
  req: express.Request
  res: express.Response
}

export type AuthVerifier = (
  ctx: AuthVerifierContext,
) => Promise<AuthOutput> | AuthOutput

export interface StreamAuthVerifierContext {
  req: IncomingMessage
}

export type StreamAuthVerifier = (
  ctx: StreamAuthVerifierContext,
) => Promise<AuthOutput> | AuthOutput

export type CalcKeyFn = (ctx: XRPCReqContext) => string | null
export type CalcPointsFn = (ctx: XRPCReqContext) => number

export interface RateLimiterI {
  consume: RateLimiterConsume
  reset: RateLimiterReset
}

export type RateLimiterConsume = (
  ctx: XRPCReqContext,
  opts?: { calcKey?: CalcKeyFn; calcPoints?: CalcPointsFn },
) => Promise<RateLimiterStatus | RateLimitExceededError | null>

export type RateLimiterReset = (
  ctx: XRPCReqContext,
  opts?: { calcKey?: CalcKeyFn },
) => Promise<void>

export type RateLimiterCreator = (opts: {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
}) => RateLimiterI

export type ServerRateLimitDescription = {
  name: string
  durationMs: number
  points: number
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
}

export type SharedRateLimitOpts = {
  name: string
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
}

export type RouteRateLimitOpts = {
  durationMs: number
  points: number
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
}

export type HandlerRateLimitOpts = SharedRateLimitOpts | RouteRateLimitOpts

export const isShared = (
  opts: HandlerRateLimitOpts,
): opts is SharedRateLimitOpts => {
  return typeof opts['name'] === 'string'
}

export type RateLimiterStatus = {
  limit: number
  duration: number
  remainingPoints: number
  msBeforeNext: number
  consumedPoints: number
  isFirstInDuration: boolean
}

export type RouteOpts = {
  blobLimit?: number
}

export type XRPCHandlerConfig = {
  opts?: RouteOpts
  rateLimit?: HandlerRateLimitOpts | HandlerRateLimitOpts[]
  auth?: AuthVerifier
  handler: XRPCHandler
}

export type XRPCStreamHandlerConfig = {
  auth?: StreamAuthVerifier
  handler: XRPCStreamHandler
}

export { ResponseType }

/**
 * Converts an upstream XRPC {@link ResponseType} into a downstream {@link ResponseType}.
 */
function mapFromClientError(error: XRPCClientError): {
  error: string
  message: string
  type: ResponseType
} {
  switch (error.status) {
    case ResponseType.InvalidResponse:
      // Upstream server returned an XRPC response that is not compatible with our internal lexicon definitions for that XRPC method.
      // @NOTE This could be reflected as both a 500 ("we" are at fault) and 502 ("they" are at fault). Let's be gents about it.
      return {
        error: httpResponseCodeToName(ResponseType.InternalServerError),
        message: httpResponseCodeToString(ResponseType.InternalServerError),
        type: ResponseType.InternalServerError,
      }
    case ResponseType.Unknown:
      // Typically a network error / unknown host
      return {
        error: httpResponseCodeToName(ResponseType.InternalServerError),
        message: httpResponseCodeToString(ResponseType.InternalServerError),
        type: ResponseType.InternalServerError,
      }
    default:
      return {
        error: error.error,
        message: error.message,
        type: error.status,
      }
  }
}

export class XRPCError extends Error {
  constructor(
    public type: ResponseType,
    public errorMessage?: string,
    public customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(errorMessage, options)
  }

  get statusCode(): number {
    const { type } = this

    // Fool-proofing. `new XRPCError(123.5 as number, '')` does not generate a TypeScript error.
    // Because of this, we can end-up with any numeric value instead of an actual `ResponseType`.
    // For legacy reasons, the `type` argument is not checked in the constructor, so we check it here.
    if (type < 400 || type >= 600 || !Number.isFinite(type)) {
      return 500
    }

    return type
  }

  get payload() {
    return {
      error: this.customErrorName ?? this.typeName,
      message:
        this.type === ResponseType.InternalServerError
          ? this.typeStr // Do not respond with error details for 500s
          : this.errorMessage || this.typeStr,
    }
  }

  get typeName(): string | undefined {
    return ResponseType[this.type]
  }

  get typeStr(): string | undefined {
    return ResponseTypeStrings[this.type]
  }

  static fromError(cause: unknown): XRPCError {
    if (cause instanceof XRPCError) {
      return cause
    }

    if (cause instanceof XRPCClientError) {
      const { error, message, type } = mapFromClientError(cause)
      return new XRPCError(type, message, error, { cause })
    }

    if (isHttpError(cause)) {
      return new XRPCError(cause.status, cause.message, cause.name, { cause })
    }

    if (isHandlerError(cause)) {
      return this.fromHandlerError(cause)
    }

    if (cause instanceof Error) {
      return new InternalServerError(cause.message, undefined, { cause })
    }

    return new InternalServerError(
      'Unexpected internal server error',
      undefined,
      { cause },
    )
  }

  static fromHandlerError(err: HandlerError): XRPCError {
    return new XRPCError(err.status, err.message, err.error, { cause: err })
  }
}

export function isHandlerError(v: unknown): v is HandlerError {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v['status'] === 'number' &&
    (v['error'] === undefined || typeof v['error'] === 'string') &&
    (v['message'] === undefined || typeof v['message'] === 'string')
  )
}

export function isHandlerPipeThroughBuffer(
  v: HandlerOutput,
): v is HandlerPipeThroughBuffer {
  // We only need to discriminate between possible HandlerOutput values
  return v['buffer'] !== undefined
}

export function isHandlerPipeThroughStream(
  v: HandlerOutput,
): v is HandlerPipeThroughStream {
  // We only need to discriminate between possible HandlerOutput values
  return v['stream'] !== undefined
}

export class InvalidRequestError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.InvalidRequest, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.InvalidRequest
    )
  }
}

export class AuthRequiredError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.AuthenticationRequired,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.AuthenticationRequired
    )
  }
}

export class ForbiddenError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.Forbidden, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError && instance.type === ResponseType.Forbidden
    )
  }
}

export class RateLimitExceededError extends XRPCError {
  constructor(
    public status: RateLimiterStatus,
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.RateLimitExceeded,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.RateLimitExceeded
    )
  }
}

export class InternalServerError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.InternalServerError,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.InternalServerError
    )
  }
}

export class UpstreamFailureError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.UpstreamFailure, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.UpstreamFailure
    )
  }
}

export class NotEnoughResourcesError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.NotEnoughResources,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.NotEnoughResources
    )
  }
}

export class UpstreamTimeoutError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.UpstreamTimeout, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.UpstreamTimeout
    )
  }
}

export class MethodNotImplementedError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.MethodNotImplemented,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.MethodNotImplemented
    )
  }
}
