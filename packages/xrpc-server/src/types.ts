import {
  ResponseType,
  ResponseTypeNames,
  ResponseTypeStrings,
  XRPCError as XRPCClientError,
} from '@atproto/xrpc'
import express from 'express'
import { IncomingMessage } from 'http'
import { isHttpError } from 'http-errors'
import { Readable } from 'stream'
import zod from 'zod'

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
}

export type UndecodedParams = (typeof express.request)['query']

export type Primitive = string | number | boolean
export type Params = Record<string, Primitive | Primitive[] | undefined>

export const handlerInput = zod.object({
  encoding: zod.string(),
  body: zod.any(),
})
export type HandlerInput = zod.infer<typeof handlerInput>

export const handlerAuth = zod.object({
  credentials: zod.any(),
  artifacts: zod.any(),
})
export type HandlerAuth = zod.infer<typeof handlerAuth>

export const headersSchema = zod.record(zod.string())

export const handlerSuccess = zod.object({
  encoding: zod.string(),
  body: zod.any(),
  headers: headersSchema.optional(),
})
export type HandlerSuccess = zod.infer<typeof handlerSuccess>

export const handlerPipeThroughBuffer = zod.object({
  encoding: zod.string(),
  buffer: zod.instanceof(Buffer),
  headers: headersSchema.optional(),
})

export type HandlerPipeThroughBuffer = zod.infer<
  typeof handlerPipeThroughBuffer
>

export const handlerPipeThroughStream = zod.object({
  encoding: zod.string(),
  stream: zod.instanceof(Readable),
  headers: headersSchema.optional(),
})

export type HandlerPipeThroughStream = zod.infer<
  typeof handlerPipeThroughStream
>

export const handlerPipeThrough = zod.union([
  handlerPipeThroughBuffer,
  handlerPipeThroughStream,
])

export type HandlerPipeThrough = zod.infer<typeof handlerPipeThrough>

export const handlerError = zod.object({
  status: zod.number(),
  error: zod.string().optional(),
  message: zod.string().optional(),
})
export type HandlerError = zod.infer<typeof handlerError>

export type HandlerOutput = HandlerSuccess | HandlerPipeThrough | HandlerError

export type XRPCReqContext = {
  auth: HandlerAuth | undefined
  params: Params
  input: HandlerInput | undefined
  req: express.Request
  res: express.Response
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
}

export type RateLimiterConsume = (
  ctx: XRPCReqContext,
  opts?: { calcKey?: CalcKeyFn; calcPoints?: CalcPointsFn },
) => Promise<RateLimiterStatus | RateLimitExceededError | null>

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

export class XRPCError extends Error {
  constructor(
    public type: ResponseType,
    public errorMessage?: string,
    public customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(errorMessage, options)
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
    return ResponseTypeNames[this.type]
  }

  get typeStr(): string | undefined {
    return ResponseTypeStrings[this.type]
  }

  static fromError(cause: unknown): XRPCError {
    if (cause instanceof XRPCError) {
      return cause
    }

    if (cause instanceof XRPCClientError) {
      return new XRPCError(cause.status, cause.message, cause.error, { cause })
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
    super(ResponseType.AuthRequired, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.AuthRequired
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
