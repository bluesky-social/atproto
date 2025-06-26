import { IncomingMessage, ServerResponse } from 'node:http'
import {
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from 'rate-limiter-flexible'
import { ResponseType, XRPCError } from './errors'
import { logger } from './logger'

// @NOTE Do not depend (directly or indirectly) on "./types" here, as it would
// create a circular dependency.

export interface RateLimierContext {
  req: IncomingMessage
  res?: ServerResponse
}

export type CalcKeyFn<C extends RateLimierContext = RateLimierContext> = (
  ctx: C,
) => string | null
export type CalcPointsFn<C extends RateLimierContext = RateLimierContext> = (
  ctx: C,
) => number

export interface RateLimiterI<C extends RateLimierContext = RateLimierContext> {
  consume: RateLimiterConsume<C>
  reset: RateLimiterReset<C>
}

export type RateLimiterConsumeOptions<
  C extends RateLimierContext = RateLimierContext,
> = {
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

export type RateLimiterConsume<
  C extends RateLimierContext = RateLimierContext,
> = (
  ctx: C,
  opts?: RateLimiterConsumeOptions<C>,
) => Promise<RateLimiterStatus | RateLimitExceededError | null>

export type RateLimiterStatus = {
  limit: number
  duration: number
  remainingPoints: number
  msBeforeNext: number
  consumedPoints: number
  isFirstInDuration: boolean
}

export type RateLimiterResetOptions<
  C extends RateLimierContext = RateLimierContext,
> = {
  calcKey?: CalcKeyFn<C>
}

export type RateLimiterReset<C extends RateLimierContext = RateLimierContext> =
  (ctx: C, opts?: RateLimiterResetOptions<C>) => Promise<void>

export type RateLimiterCreator<
  T extends RateLimierContext = RateLimierContext,
> = <C extends T = T>(opts: {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}) => RateLimiterI<C>

export type RateLimiterOpts<C extends RateLimierContext = RateLimierContext> = {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
  failClosed?: boolean
}

export class RateLimiter<C extends RateLimierContext = RateLimierContext>
  implements RateLimiterI<C>
{
  public limiter: RateLimiterAbstract

  private failClosed?: boolean
  public calcKey: CalcKeyFn<C>
  public calcPoints: CalcPointsFn<C>

  constructor(limiter: RateLimiterAbstract, opts: RateLimiterOpts<C>) {
    this.limiter = limiter
    this.calcKey = opts.calcKey ?? defaultKey
    this.calcPoints = opts.calcPoints ?? defaultPoints
  }

  static memory<C extends RateLimierContext = RateLimierContext>(
    opts: RateLimiterOpts<C>,
  ): RateLimiter<C> {
    const limiter = new RateLimiterMemory({
      keyPrefix: opts.keyPrefix,
      duration: Math.floor(opts.durationMs / 1000),
      points: opts.points,
    })
    return new RateLimiter<C>(limiter, opts)
  }

  static redis<C extends RateLimierContext = RateLimierContext>(
    storeClient: unknown,
    opts: RateLimiterOpts<C>,
  ): RateLimiter<C> {
    const limiter = new RateLimiterRedis({
      storeClient,
      keyPrefix: opts.keyPrefix,
      duration: Math.floor(opts.durationMs / 1000),
      points: opts.points,
    })
    return new RateLimiter<C>(limiter, opts)
  }

  async consume(
    ctx: C,
    opts?: RateLimiterConsumeOptions<C>,
  ): Promise<RateLimiterStatus | RateLimitExceededError | null> {
    const key = opts?.calcKey ? opts.calcKey(ctx) : this.calcKey(ctx)
    if (key === null) {
      return null
    }
    const points = opts?.calcPoints
      ? opts.calcPoints(ctx)
      : this.calcPoints(ctx)
    if (points < 1) {
      return null
    }
    try {
      const res = await this.limiter.consume(key, points)
      return formatLimiterStatus(this.limiter, res)
    } catch (err) {
      // yes this library rejects with a res not an error
      if (err instanceof RateLimiterRes) {
        const status = formatLimiterStatus(this.limiter, err)
        return new RateLimitExceededError(status)
      } else {
        if (this.failClosed) {
          throw err
        }
        logger.error(
          {
            err,
            keyPrefix: this.limiter.keyPrefix,
            points: this.limiter.points,
            duration: this.limiter.duration,
          },
          'rate limiter failed to consume points',
        )
        return null
      }
    }
  }

  async reset(ctx: C, opts?: RateLimiterResetOptions<C>): Promise<void> {
    const key = opts?.calcKey ? opts.calcKey(ctx) : this.calcKey(ctx)
    if (key === null) {
      return
    }

    try {
      await this.limiter.delete(key)
    } catch (cause) {
      throw new Error(`rate limiter failed to reset key: ${key}`, { cause })
    }
  }
}

export const formatLimiterStatus = (
  limiter: RateLimiterAbstract,
  res: RateLimiterRes,
): RateLimiterStatus => {
  return {
    limit: limiter.points,
    duration: limiter.duration,
    remainingPoints: res.remainingPoints,
    msBeforeNext: res.msBeforeNext,
    consumedPoints: res.consumedPoints,
    isFirstInDuration: res.isFirstInDuration,
  }
}

export type WrappedRateLimiterOptions<
  C extends RateLimierContext = RateLimierContext,
> = {
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

/**
 * Wraps a {@link RateLimiterI} instance with custom key and points calculation
 * functions.
 */
export class WrappedRateLimiter<C extends RateLimierContext = RateLimierContext>
  implements RateLimiterI<C>
{
  private constructor(
    private readonly rateLimiter: RateLimiterI<C>,
    private readonly options: Readonly<WrappedRateLimiterOptions<C>>,
  ) {}

  async consume(ctx: C, opts?: RateLimiterConsumeOptions<C>) {
    return this.rateLimiter.consume(ctx, {
      calcKey: opts?.calcKey ?? this.options.calcKey,
      calcPoints: opts?.calcPoints ?? this.options.calcPoints,
    })
  }

  async reset(ctx: C, opts?: RateLimiterResetOptions<C>) {
    return this.rateLimiter.reset(ctx, {
      calcKey: opts?.calcKey ?? this.options.calcKey,
    })
  }

  static from<C extends RateLimierContext = RateLimierContext>(
    rateLimiter: RateLimiterI<C>,
    { calcKey, calcPoints }: WrappedRateLimiterOptions<C> = {},
  ): RateLimiterI<C> {
    if (!calcKey && !calcPoints) return rateLimiter
    return new WrappedRateLimiter<C>(rateLimiter, { calcKey, calcPoints })
  }
}

/**
 * Combines multiple rate limiters into one.
 *
 * The combined rate limiter will return the tightest (most restrictive) of all
 * the provided rate limiters.
 */
export class CombinedRateLimiter<
  C extends RateLimierContext = RateLimierContext,
> implements RateLimiterI<C>
{
  private constructor(
    private readonly rateLimiters: readonly RateLimiterI<C>[],
  ) {}

  async consume(ctx: C, opts?: RateLimiterConsumeOptions<C>) {
    const promises: ReturnType<RateLimiterConsume>[] = []
    for (const rl of this.rateLimiters) promises.push(rl.consume(ctx, opts))
    return Promise.all(promises).then(getTightestLimit)
  }

  async reset(ctx: C, opts?: RateLimiterResetOptions<C>) {
    const promises: ReturnType<RateLimiterReset>[] = []
    for (const rl of this.rateLimiters) promises.push(rl.reset(ctx, opts))
    await Promise.all(promises)
  }

  static from<C extends RateLimierContext = RateLimierContext>(
    rateLimiters: readonly RateLimiterI<C>[],
  ): RateLimiterI<C> | undefined {
    if (rateLimiters.length === 0) return undefined
    if (rateLimiters.length === 1) return rateLimiters[0]
    return new CombinedRateLimiter(rateLimiters)
  }
}

const getTightestLimit = (
  resps: (RateLimiterStatus | RateLimitExceededError | null)[],
): RateLimiterStatus | RateLimitExceededError | null => {
  let lowest: RateLimiterStatus | null = null
  for (const resp of resps) {
    if (resp === null) continue
    if (resp instanceof RateLimitExceededError) return resp
    if (lowest === null || resp.remainingPoints < lowest.remainingPoints) {
      lowest = resp
    }
  }
  return lowest
}

export type RouteRateLimiterOptions<
  C extends RateLimierContext = RateLimierContext,
> = {
  bypass?: (ctx: C) => boolean
}

/**
 * Wraps a {@link RateLimiterI} interface into a class that will apply the
 * appropriate headers to the response if a limit is exceeded.
 */
export class RouteRateLimiter<C extends RateLimierContext = RateLimierContext>
  implements RateLimiterI<C>
{
  constructor(
    private readonly rateLimiter: RateLimiterI<C>,
    private readonly options: Readonly<RouteRateLimiterOptions<C>> = {},
  ) {}

  async handle(ctx: C): Promise<RateLimiterStatus | null> {
    const { bypass } = this.options
    if (bypass && bypass(ctx)) {
      return null
    }

    const result = await this.consume(ctx)
    if (result instanceof RateLimitExceededError) {
      setStatusHeaders(ctx, result.status)
      throw result
    } else if (result != null) {
      setStatusHeaders(ctx, result)
    }

    return result
  }

  async consume(...args: Parameters<RateLimiterConsume<C>>) {
    return this.rateLimiter.consume(...args)
  }

  async reset(...args: Parameters<RateLimiterReset<C>>) {
    return this.rateLimiter.reset(...args)
  }

  static from<C extends RateLimierContext = RateLimierContext>(
    rateLimiters: readonly RateLimiterI<C>[],
    { bypass }: RouteRateLimiterOptions<C> = {},
  ): RouteRateLimiter<C> | undefined {
    const rateLimiter = CombinedRateLimiter.from(rateLimiters)
    if (!rateLimiter) return undefined

    return new RouteRateLimiter(rateLimiter, { bypass })
  }
}

function setStatusHeaders<C extends RateLimierContext = RateLimierContext>(
  ctx: C,
  status: RateLimiterStatus,
) {
  const resetAt = Math.floor((Date.now() + status.msBeforeNext) / 1e3)

  ctx.res?.setHeader('RateLimit-Limit', status.limit)
  ctx.res?.setHeader('RateLimit-Reset', resetAt)
  ctx.res?.setHeader('RateLimit-Remaining', status.remainingPoints)
  ctx.res?.setHeader('RateLimit-Policy', `${status.limit};w=${status.duration}`)
}

/**
 * @note when using a proxy, ensure headers are getting forwarded correctly:
 * `app.set('trust proxy', true)`
 *
 * @see {@link https://expressjs.com/en/guide/behind-proxies.html}
 */
const defaultKey: CalcKeyFn = ({ req }) => {
  // Express compatibility
  if ('ip' in req && typeof req.ip === 'string') return req.ip

  const { remoteAddress } = req.socket
  if (remoteAddress) return remoteAddress

  // If we are not able to determine the IP address, we do not want to return
  // "null" as that would disable the rate limiting for this request. Instead,
  // we return a default key that will be shared by all requests that do not
  // have a specific key.
  return 'common'
}
const defaultPoints: CalcPointsFn = () => 1

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
