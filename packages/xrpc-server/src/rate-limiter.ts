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

export interface RateLimiterContext {
  req: IncomingMessage
  res?: ServerResponse
}

export type CalcKeyFn<C extends RateLimiterContext = RateLimiterContext> = (
  ctx: C,
) => string | null
export type CalcPointsFn<C extends RateLimiterContext = RateLimiterContext> = (
  ctx: C,
) => number

export interface RateLimiterI<
  C extends RateLimiterContext = RateLimiterContext,
> {
  consume: RateLimiterConsume<C>
  reset: RateLimiterReset<C>
}

export type RateLimiterConsumeOptions<
  C extends RateLimiterContext = RateLimiterContext,
> = {
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

export type RateLimiterConsume<
  C extends RateLimiterContext = RateLimiterContext,
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
  C extends RateLimiterContext = RateLimiterContext,
> = {
  calcKey?: CalcKeyFn<C>
}

export type RateLimiterReset<
  C extends RateLimiterContext = RateLimiterContext,
> = (ctx: C, opts?: RateLimiterResetOptions<C>) => Promise<void>

export type RateLimiterOptions<
  C extends RateLimiterContext = RateLimiterContext,
> = {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey: CalcKeyFn<C>
  calcPoints: CalcPointsFn<C>
  failClosed?: boolean
}

export class RateLimiter<C extends RateLimiterContext = RateLimiterContext>
  implements RateLimiterI<C>
{
  private readonly failClosed?: boolean
  private readonly calcKey: CalcKeyFn<C>
  private readonly calcPoints: CalcPointsFn<C>

  constructor(
    public limiter: RateLimiterAbstract,
    options: RateLimiterOptions<C>,
  ) {
    this.limiter = limiter
    this.failClosed = options.failClosed ?? false
    this.calcKey = options.calcKey
    this.calcPoints = options.calcPoints
  }

  async consume(
    ctx: C,
    opts?: RateLimiterConsumeOptions<C>,
  ): Promise<RateLimiterStatus | RateLimitExceededError | null> {
    const calcKey = opts?.calcKey ?? this.calcKey
    const key = calcKey(ctx)
    if (key === null) {
      return null
    }
    const calcPoints = opts?.calcPoints ?? this.calcPoints
    const points = calcPoints(ctx)
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

export class MemoryRateLimiter<
  C extends RateLimiterContext = RateLimiterContext,
> extends RateLimiter<C> {
  constructor(options: RateLimiterOptions<C>) {
    const limiter = new RateLimiterMemory({
      keyPrefix: options.keyPrefix,
      duration: Math.floor(options.durationMs / 1000),
      points: options.points,
    })
    super(limiter, options)
  }
}

export class RedisRateLimiter<
  C extends RateLimiterContext = RateLimiterContext,
> extends RateLimiter<C> {
  constructor(storeClient: unknown, options: RateLimiterOptions<C>) {
    const limiter = new RateLimiterRedis({
      storeClient,
      keyPrefix: options.keyPrefix,
      duration: Math.floor(options.durationMs / 1000),
      points: options.points,
    })
    super(limiter, options)
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
  C extends RateLimiterContext = RateLimiterContext,
> = {
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

/**
 * Wraps a {@link RateLimiterI} instance with custom key and points calculation
 * functions.
 */
export class WrappedRateLimiter<
  C extends RateLimiterContext = RateLimiterContext,
> implements RateLimiterI<C>
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

  static from<C extends RateLimiterContext = RateLimiterContext>(
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
  C extends RateLimiterContext = RateLimiterContext,
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

  static from<C extends RateLimiterContext = RateLimiterContext>(
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
  C extends RateLimiterContext = RateLimiterContext,
> = {
  bypass?: (ctx: C) => boolean
}

/**
 * Wraps a {@link RateLimiterI} interface into a class that will apply the
 * appropriate headers to the response if a limit is exceeded.
 */
export class RouteRateLimiter<C extends RateLimiterContext = RateLimiterContext>
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

  static from<C extends RateLimiterContext = RateLimiterContext>(
    rateLimiters: readonly RateLimiterI<C>[],
    { bypass }: RouteRateLimiterOptions<C> = {},
  ): RouteRateLimiter<C> | undefined {
    const rateLimiter = CombinedRateLimiter.from(rateLimiters)
    if (!rateLimiter) return undefined

    return new RouteRateLimiter(rateLimiter, { bypass })
  }
}

function setStatusHeaders<C extends RateLimiterContext = RateLimiterContext>(
  ctx: C,
  status: RateLimiterStatus,
) {
  const resetAt = Math.floor((Date.now() + status.msBeforeNext) / 1e3)

  ctx.res?.setHeader('RateLimit-Limit', status.limit)
  ctx.res?.setHeader('RateLimit-Reset', resetAt)
  ctx.res?.setHeader('RateLimit-Remaining', status.remainingPoints)
  ctx.res?.setHeader('RateLimit-Policy', `${status.limit};w=${status.duration}`)
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
