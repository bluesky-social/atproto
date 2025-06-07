import {
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from 'rate-limiter-flexible'
import { logger } from './logger'
import {
  CalcKeyFn,
  CalcPointsFn,
  RateLimitExceededError,
  RateLimiterConsume,
  RateLimiterConsumeOptions,
  RateLimiterI,
  RateLimiterReset,
  RateLimiterResetOptions,
  RateLimiterStatus,
  XRPCReqContext,
} from './types'
import { setHeaders } from './util'

export type RateLimiterOpts = {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
  failClosed?: boolean
}

export class RateLimiter implements RateLimiterI {
  public limiter: RateLimiterAbstract

  private failClosed?: boolean
  public calcKey: CalcKeyFn
  public calcPoints: CalcPointsFn

  constructor(limiter: RateLimiterAbstract, opts: RateLimiterOpts) {
    this.limiter = limiter
    this.calcKey = opts.calcKey ?? defaultKey
    this.calcPoints = opts.calcPoints ?? defaultPoints
  }

  static memory(opts: RateLimiterOpts): RateLimiter {
    const limiter = new RateLimiterMemory({
      keyPrefix: opts.keyPrefix,
      duration: Math.floor(opts.durationMs / 1000),
      points: opts.points,
    })
    return new RateLimiter(limiter, opts)
  }

  static redis(storeClient: unknown, opts: RateLimiterOpts): RateLimiter {
    const limiter = new RateLimiterRedis({
      storeClient,
      keyPrefix: opts.keyPrefix,
      duration: Math.floor(opts.durationMs / 1000),
      points: opts.points,
    })
    return new RateLimiter(limiter, opts)
  }

  async consume(
    ctx: XRPCReqContext,
    opts?: RateLimiterConsumeOptions,
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

  async reset(
    ctx: XRPCReqContext,
    opts?: RateLimiterResetOptions,
  ): Promise<void> {
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

export type WrappedRateLimiterOptions = {
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
}

/**
 * Wraps a {@link RateLimiterI} instance with custom key and points calculation
 * functions.
 */
export class WrappedRateLimiter implements RateLimiterI {
  private constructor(
    private readonly rateLimiter: RateLimiterI,
    private readonly options: Readonly<WrappedRateLimiterOptions>,
  ) {}

  async consume(ctx: XRPCReqContext, opts?: RateLimiterConsumeOptions) {
    return this.rateLimiter.consume(ctx, {
      calcKey: opts?.calcKey ?? this.options.calcKey,
      calcPoints: opts?.calcPoints ?? this.options.calcPoints,
    })
  }

  async reset(ctx: XRPCReqContext, opts?: RateLimiterResetOptions) {
    return this.rateLimiter.reset(ctx, {
      calcKey: opts?.calcKey ?? this.options.calcKey,
    })
  }

  static from(
    rateLimiter: RateLimiterI,
    { calcKey, calcPoints }: WrappedRateLimiterOptions = {},
  ): RateLimiterI {
    if (!calcKey && !calcPoints) return rateLimiter
    return new WrappedRateLimiter(rateLimiter, { calcKey, calcPoints })
  }
}

/**
 * Combines multiple rate limiters into one.
 *
 * The combined rate limiter will return the tightest (most restrictive) of all
 * the provided rate limiters.
 */
export class CombinedRateLimiter implements RateLimiterI {
  private constructor(private readonly rateLimiters: readonly RateLimiterI[]) {}

  async consume(ctx: XRPCReqContext, opts?: RateLimiterConsumeOptions) {
    const promises: ReturnType<RateLimiterConsume>[] = []
    for (const rl of this.rateLimiters) promises.push(rl.consume(ctx, opts))
    return Promise.all(promises).then(getTightestLimit)
  }

  async reset(ctx: XRPCReqContext, opts?: RateLimiterResetOptions) {
    const promises: ReturnType<RateLimiterReset>[] = []
    for (const rl of this.rateLimiters) promises.push(rl.reset(ctx, opts))
    await Promise.all(promises)
  }

  static from(rateLimiters: readonly RateLimiterI[]): RateLimiterI | undefined {
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

export type RouteRateLimiterOptions = {
  bypass?: (ctx: XRPCReqContext) => boolean
}

/**
 * Wraps a {@link RateLimiterI} interface into a class that will apply the
 * appropriate headers to the response if a limit is exceeded.
 */
export class RouteRateLimiter implements RateLimiterI {
  constructor(
    private readonly rateLimiter: RateLimiterI,
    private readonly options: Readonly<RouteRateLimiterOptions> = {},
  ) {}

  async handle(ctx: XRPCReqContext): Promise<RateLimiterStatus | null> {
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

  async consume(...args: Parameters<RateLimiterConsume>) {
    return this.rateLimiter.consume(...args)
  }

  async reset(...args: Parameters<RateLimiterReset>) {
    return this.rateLimiter.reset(...args)
  }

  static from(
    rateLimiters: readonly RateLimiterI[],
    { bypass }: RouteRateLimiterOptions = {},
  ): RouteRateLimiter | undefined {
    const rateLimiter = CombinedRateLimiter.from(rateLimiters)
    if (!rateLimiter) return undefined

    return new RouteRateLimiter(rateLimiter, { bypass })
  }
}

function setStatusHeaders(ctx: XRPCReqContext, status: RateLimiterStatus) {
  setHeaders(ctx.res, {
    'RateLimit-Limit': status.limit,
    'RateLimit-Reset': Math.floor((Date.now() + status.msBeforeNext) / 1000),
    'RateLimit-Remaining': status.remainingPoints,
    'RateLimit-Policy': `${status.limit};w=${status.duration}`,
  })
}

// when using a proxy, ensure headers are getting forwarded correctly: `app.set('trust proxy', true)`
// https://expressjs.com/en/guide/behind-proxies.html
const defaultKey: CalcKeyFn = (ctx: XRPCReqContext) => ctx.req.ip
const defaultPoints: CalcPointsFn = () => 1
