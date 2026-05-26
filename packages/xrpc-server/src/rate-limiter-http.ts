import { IncomingMessage, ServerResponse } from 'node:http'
import {
  CombinedRateLimiter,
  RateLimitExceededError,
  RateLimiterConsume,
  RateLimiterI,
  RateLimiterReset,
  RateLimiterStatus,
} from './rate-limiter.js'

export interface HttpRateLimiterContext {
  req: IncomingMessage
  res?: ServerResponse
}

export type HttpRateLimiterOptions<
  C extends HttpRateLimiterContext = HttpRateLimiterContext,
> = {
  bypass?: (ctx: C) => boolean
}

/**
 * Wraps a {@link RateLimiterI} class with an {@link RateLimiterI}
 * implementation that will apply the appropriate headers to the response if a
 * limit is exceeded.
 */
export class HttpRateLimiter<
  C extends HttpRateLimiterContext = HttpRateLimiterContext,
> implements RateLimiterI<C>
{
  constructor(
    private readonly rateLimiter: RateLimiterI<C>,
    private readonly options: Readonly<HttpRateLimiterOptions<C>> = {},
  ) {}

  async handle(ctx: C): Promise<void> {
    const { bypass } = this.options
    if (bypass && bypass(ctx)) return

    try {
      const result = await this.consume(ctx)
      if (result != null) {
        setStatusHeaders(ctx, result)
      }
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        setStatusHeaders(ctx, err.status)
      }

      throw err
    }
  }

  async consume(...args: Parameters<RateLimiterConsume<C>>) {
    return this.rateLimiter.consume(...args)
  }

  async reset(...args: Parameters<RateLimiterReset<C>>) {
    return this.rateLimiter.reset(...args)
  }

  static from<C extends HttpRateLimiterContext = HttpRateLimiterContext>(
    rateLimiters: readonly RateLimiterI<C>[],
    { bypass }: HttpRateLimiterOptions<C> = {},
  ): HttpRateLimiter<C> | undefined {
    const rateLimiter = CombinedRateLimiter.from(rateLimiters)
    if (!rateLimiter) return undefined

    return new HttpRateLimiter<C>(rateLimiter, { bypass })
  }
}

function setStatusHeaders<
  C extends HttpRateLimiterContext = HttpRateLimiterContext,
>(ctx: C, status: RateLimiterStatus) {
  const resetAt = Math.floor((Date.now() + status.msBeforeNext) / 1e3)

  ctx.res?.setHeader('RateLimit-Limit', status.limit)
  ctx.res?.setHeader('RateLimit-Reset', resetAt)
  ctx.res?.setHeader('RateLimit-Remaining', status.remainingPoints)
  ctx.res?.setHeader('RateLimit-Policy', `${status.limit};w=${status.duration}`)
}
