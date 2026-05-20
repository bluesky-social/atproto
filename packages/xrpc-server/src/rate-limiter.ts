import {
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from 'rate-limiter-flexible'
import { ResponseType, XRPCError } from './errors.js'

// @NOTE Do not depend (directly or indirectly) on "./types" here, as it would
// create a circular dependency.

export type { RateLimiterAbstract }

export type CalcKeyFn<C = unknown> = (ctx: C) => string | null
export type CalcPointsFn<C = unknown> = (ctx: C) => number

export interface RateLimiterI<C = unknown> {
  consume: RateLimiterConsume<C>
  reset: RateLimiterReset<C>
}

export type RateLimiterConsumeOptions<C = unknown> = {
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

export type RateLimiterConsume<C = unknown> = (
  ctx: C,
  opts?: RateLimiterConsumeOptions<C>,
) => Promise<RateLimiterStatus | null>

export type RateLimiterStatus = {
  limit: number
  duration: number
  remainingPoints: number
  msBeforeNext: number
  consumedPoints: number
  isFirstInDuration: boolean
}

export type RateLimiterResetOptions<C = unknown> = {
  calcKey?: CalcKeyFn<C>
}

export type RateLimiterReset<C = unknown> = (
  ctx: C,
  opts?: RateLimiterResetOptions<C>,
) => Promise<void>

export type RateLimiterErrorHandlerDetails = {
  key: string
  points: number
  limiter: {
    keyPrefix: string
    points: number
    duration: number
  }
}
export type RateLimiterErrorHandler<C = unknown> = (
  err: unknown,
  ctx: C,
  details: RateLimiterErrorHandlerDetails,
) => Promise<RateLimiterStatus | null>

export type RateLimiterOptions<C = unknown> = {
  keyPrefix: string
  durationMs: number
  points: number
  calcKey: CalcKeyFn<C>
  calcPoints: CalcPointsFn<C>
  onError?: RateLimiterErrorHandler<C>
}

export class RateLimiter<C = unknown> implements RateLimiterI<C> {
  private readonly onError?: RateLimiterErrorHandler<C>
  private readonly calcKey: CalcKeyFn<C>
  private readonly calcPoints: CalcPointsFn<C>

  constructor(
    public limiter: RateLimiterAbstract,
    options: RateLimiterOptions<C>,
  ) {
    this.limiter = limiter
    this.onError = options.onError
    this.calcKey = options.calcKey
    this.calcPoints = options.calcPoints
  }

  async consume(
    ctx: C,
    opts?: RateLimiterConsumeOptions<C>,
  ): Promise<RateLimiterStatus | null> {
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
    const { limiter } = this
    try {
      const res = await limiter.consume(key, points)
      return formatLimiterStatus(limiter, res)
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        // Wrap rate-limiter-flexible error into our own error type
        const status = formatLimiterStatus(limiter, err)
        throw new RateLimitExceededError(status)
      } else if (err instanceof RateLimitExceededError) {
        // Propagate RateLimitExceededError errors
        throw err
      } else {
        // Most likely a system error (failed to connect to Redis, etc). Allow
        // the caller to decide how to handle it (fail open by allowing the
        // request, fail closed by rejecting the request, etc).
        const { onError } = this
        if (onError) return onError(err, ctx, { key, points, limiter })

        throw err
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

export class MemoryRateLimiter<C = unknown> extends RateLimiter<C> {
  constructor(options: RateLimiterOptions<C>) {
    const limiter = new RateLimiterMemory({
      keyPrefix: options.keyPrefix,
      duration: Math.floor(options.durationMs / 1000),
      points: options.points,
    })
    super(limiter, options)
  }
}

export class RedisRateLimiter<C = unknown> extends RateLimiter<C> {
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

export type WrappedRateLimiterOptions<C = unknown> = {
  calcKey?: CalcKeyFn<C>
  calcPoints?: CalcPointsFn<C>
}

/**
 * Wraps a {@link RateLimiterI} instance with custom key and points calculation
 * functions.
 */
export class WrappedRateLimiter<C = unknown> implements RateLimiterI<C> {
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

  static from<C = unknown>(
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
export class CombinedRateLimiter<C = unknown> implements RateLimiterI<C> {
  private constructor(
    private readonly rateLimiters: readonly RateLimiterI<C>[],
  ) {}

  async consume(ctx: C, opts?: RateLimiterConsumeOptions<C>) {
    const promises: ReturnType<RateLimiterConsume>[] = []
    for (const rl of this.rateLimiters) promises.push(rl.consume(ctx, opts))
    const results = await Promise.all(promises)

    // Compute the tightest rate limit status (the one with the least remaining points)
    let lowest: RateLimiterStatus | null = null
    for (const resp of results) {
      if (resp === null) continue
      if (lowest === null || resp.remainingPoints < lowest.remainingPoints) {
        lowest = resp
      }
    }

    return lowest
  }

  async reset(ctx: C, opts?: RateLimiterResetOptions<C>) {
    const promises: ReturnType<RateLimiterReset>[] = []
    for (const rl of this.rateLimiters) promises.push(rl.reset(ctx, opts))
    await Promise.all(promises)
  }

  static from<C = unknown>(
    rateLimiters: readonly RateLimiterI<C>[],
  ): RateLimiterI<C> | undefined {
    if (rateLimiters.length === 0) return undefined
    if (rateLimiters.length === 1) return rateLimiters[0]
    return new CombinedRateLimiter(rateLimiters)
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
