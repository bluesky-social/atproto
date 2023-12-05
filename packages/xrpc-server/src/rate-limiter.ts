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
  RateLimiterI,
  RateLimiterStatus,
  XRPCReqContext,
} from './types'

export type RateLimiterOpts = {
  keyPrefix: string
  durationMs: number
  points: number
  bypassSecret?: string
  bypassIps?: string[]
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
  failClosed?: boolean
}

export class RateLimiter implements RateLimiterI {
  public limiter: RateLimiterAbstract
  private bypassSecret?: string
  private bypassIps?: string[]
  private failClosed?: boolean
  public calcKey: CalcKeyFn
  public calcPoints: CalcPointsFn

  constructor(limiter: RateLimiterAbstract, opts: RateLimiterOpts) {
    this.limiter = limiter
    this.bypassSecret = opts.bypassSecret
    this.bypassIps = opts.bypassIps
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
    opts?: { calcKey?: CalcKeyFn; calcPoints?: CalcPointsFn },
  ): Promise<RateLimiterStatus | RateLimitExceededError | null> {
    if (
      this.bypassSecret &&
      ctx.req.header('x-ratelimit-bypass') === this.bypassSecret
    ) {
      return null
    }
    if (this.bypassIps && this.bypassIps.includes(ctx.req.ip)) {
      return null
    }
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

export const consumeMany = async (
  ctx: XRPCReqContext,
  fns: RateLimiterConsume[],
): Promise<RateLimiterStatus | RateLimitExceededError | null> => {
  if (fns.length === 0) return null
  const results = await Promise.all(fns.map((fn) => fn(ctx)))
  const tightestLimit = getTightestLimit(results)
  if (tightestLimit === null) {
    return null
  } else if (tightestLimit instanceof RateLimitExceededError) {
    setResHeaders(ctx, tightestLimit.status)
    return tightestLimit
  } else {
    setResHeaders(ctx, tightestLimit)
    return tightestLimit
  }
}

export const setResHeaders = (
  ctx: XRPCReqContext,
  status: RateLimiterStatus,
) => {
  ctx.res.setHeader('RateLimit-Limit', status.limit)
  ctx.res.setHeader('RateLimit-Remaining', status.remainingPoints)
  ctx.res.setHeader(
    'RateLimit-Reset',
    Math.floor((Date.now() + status.msBeforeNext) / 1000),
  )
  ctx.res.setHeader('RateLimit-Policy', `${status.limit};w=${status.duration}`)
}

export const getTightestLimit = (
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

// when using a proxy, ensure headers are getting forwarded correctly: `app.set('trust proxy', true)`
// https://expressjs.com/en/guide/behind-proxies.html
const defaultKey: CalcKeyFn = (ctx: XRPCReqContext) => ctx.req.ip
const defaultPoints: CalcPointsFn = () => 1
