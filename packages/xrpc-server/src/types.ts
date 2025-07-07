import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { ErrorResult, XRPCError } from './errors'
import { CalcKeyFn, CalcPointsFn, RateLimiterI } from './rate-limiter'

export type Awaitable<T> = T | Promise<T>

export type CatchallHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => unknown

export type Options = {
  validateResponse?: boolean
  catchall?: CatchallHandler
  payload?: RouteOptions
  rateLimits?: {
    creator: RateLimiterCreator<HandlerContext>
    global?: ServerRateLimitDescription<HandlerContext>[]
    shared?: ServerRateLimitDescription<HandlerContext>[]
    bypass?: (ctx: HandlerContext) => boolean
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

export type UndecodedParams = Request['query']

export type Primitive = string | number | boolean
export type Params = { [P in string]?: undefined | Primitive | Primitive[] }

export type HandlerInput = {
  encoding: string
  body: unknown
}

export type AuthResult = {
  credentials: unknown
  artifacts?: unknown
}

export const headersSchema = z.record(z.string())

export type Headers = z.infer<typeof headersSchema>

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

export type Auth = void | AuthResult
export type Input = void | HandlerInput
export type Output = void | HandlerSuccess | ErrorResult

export type AuthVerifier<C, A extends AuthResult = AuthResult> =
  | ((ctx: C) => Awaitable<A | ErrorResult>)
  | ((ctx: C) => Awaitable<A>)

export type MethodAuthContext<P extends Params = Params> = {
  params: P
  req: Request
  res: Response
}

export type MethodAuthVerifier<
  A extends AuthResult = AuthResult,
  P extends Params = Params,
> = AuthVerifier<MethodAuthContext<P>, A>

export type HandlerContext<
  A extends Auth = Auth,
  P extends Params = Params,
  I extends Input = Input,
> = MethodAuthContext<P> & {
  auth: A
  input: I
  resetRouteRateLimits: () => Promise<void>
}

export type MethodHandler<
  A extends Auth = Auth,
  P extends Params = Params,
  I extends Input = Input,
  O extends Output = Output,
> = (ctx: HandlerContext<A, P, I>) => Awaitable<O | HandlerPipeThrough>

export type RateLimiterCreator<T extends HandlerContext = HandlerContext> = <
  C extends T = T,
>(opts: {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey: CalcKeyFn<C>
  calcPoints: CalcPointsFn<C>
  failClosed?: boolean
}) => RateLimiterI<C>

export type ServerRateLimitDescription<
  C extends HandlerContext = HandlerContext,
> = {
  name: string
  durationMs: number
  points: number
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
  failClosed?: boolean
}

export type SharedRateLimitOpts<C extends HandlerContext = HandlerContext> = {
  name: string
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

export type RouteRateLimitOpts<C extends HandlerContext = HandlerContext> = {
  durationMs: number
  points: number
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

export type RateLimitOpts<C extends HandlerContext = HandlerContext> =
  | SharedRateLimitOpts<C>
  | RouteRateLimitOpts<C>

export function isSharedRateLimitOpts<
  C extends HandlerContext = HandlerContext,
>(opts: RateLimitOpts<C>): opts is SharedRateLimitOpts<C> {
  return typeof opts['name'] === 'string'
}

export type RouteOptions = {
  blobLimit?: number
  jsonLimit?: number
  textLimit?: number
}

export type MethodConfig<
  A extends Auth = Auth,
  P extends Params = Params,
  I extends Input = Input,
  O extends Output = Output,
> = {
  handler: MethodHandler<A, P, I, O>
  auth?: MethodAuthVerifier<Extract<A, AuthResult>, P>
  opts?: RouteOptions
  rateLimit?:
    | RateLimitOpts<HandlerContext<A, P, I>>
    | RateLimitOpts<HandlerContext<A, P, I>>[]
}

export type MethodConfigOrHandler<
  A extends Auth = Auth,
  P extends Params = Params,
  I extends Input = Input,
  O extends Output = Output,
> = MethodHandler<A, P, I, O> | MethodConfig<A, P, I, O>

export type StreamAuthContext<P extends Params = Params> = {
  params: P
  req: IncomingMessage
}

export type StreamAuthVerifier<
  A extends AuthResult = AuthResult,
  P extends Params = Params,
> = AuthVerifier<StreamAuthContext<P>, A>

export type StreamContext<
  A extends Auth = Auth,
  P extends Params = Params,
> = StreamAuthContext<P> & {
  auth: A
  signal: AbortSignal
}

export type StreamHandler<
  A extends Auth = Auth,
  P extends Params = Params,
  O = unknown,
> = (ctx: StreamContext<A, P>) => AsyncIterable<O>

export type StreamConfig<
  A extends Auth = Auth,
  P extends Params = Params,
  O = unknown,
> = {
  auth?: StreamAuthVerifier<Extract<A, AuthResult>, P>
  handler: StreamHandler<A, P, O>
}

export type StreamConfigOrHandler<
  A extends Auth = Auth,
  P extends Params = Params,
  O = unknown,
> = StreamHandler<A, P, O> | StreamConfig<A, P, O>

export function isHandlerPipeThroughBuffer(
  output: Output,
): output is HandlerPipeThroughBuffer {
  // We only need to discriminate between possible Output values
  return output != null && 'buffer' in output && output['buffer'] !== undefined
}

export function isHandlerPipeThroughStream(
  output: Output,
): output is HandlerPipeThroughStream {
  // We only need to discriminate between possible Output values
  return output != null && 'stream' in output && output['stream'] !== undefined
}
