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
import { getReqIp } from './util'

export type RateLimiterOpts = {
  keyPrefix: string
  durationMs: number
  points: number
  bypassSecret?: string
  calcKey?: CalcKeyFn
  calcPoints?: CalcPointsFn
  failClosed?: boolean
}

export class RateLimiter implements RateLimiterI {
  public limiter: RateLimiterAbstract
  private byPassSecret?: string
  private failClosed?: boolean
  public calcKey: CalcKeyFn
  public calcPoints: CalcPointsFn

  constructor(limiter: RateLimiterAbstract, opts: RateLimiterOpts) {
    this.limiter = limiter
    this.byPassSecret = opts.bypassSecret
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
  ): Promise<RateLimiterStatus | null> {
    if (
      this.byPassSecret &&
      ctx.req.header('x-ratelimit-bypass') === this.byPassSecret
    ) {
      return null
    }
    const key = opts?.calcKey ? opts.calcKey(ctx) : this.calcKey(ctx)
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
        throw new RateLimitExceededError(status)
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
): Promise<void> => {
  if (fns.length === 0) return
  const results = await Promise.all(fns.map((fn) => fn(ctx)))
  const tightestLimit = getTightestLimit(results)
  if (tightestLimit !== null) {
    setResHeaders(ctx, tightestLimit)
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
  resps: (RateLimiterStatus | null)[],
): RateLimiterStatus | null => {
  let lowest: RateLimiterStatus | null = null
  for (const resp of resps) {
    if (resp === null) continue
    if (lowest === null || resp.remainingPoints < lowest.remainingPoints) {
      lowest = resp
    }
  }
  return lowest
}

const defaultKey: CalcKeyFn = (ctx: XRPCReqContext) => getReqIp(ctx.req)
const defaultPoints: CalcPointsFn = () => 1
