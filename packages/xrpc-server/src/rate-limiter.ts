import { RateLimiterMemory } from 'rate-limiter-flexible'
import { RateLimitExceededError, XRPCReqContext } from './types'

export class SharedRateLimiter {
  public limiter: RateLimiterMemory
  public calcKey: (ctx: XRPCReqContext) => string
  public calcPoints: (ctx: XRPCReqContext) => number

  constructor(opts: {
    keyPrefix: string
    duration: number
    points: number
    calcKey?: (ctx: XRPCReqContext) => string
    calcPoints?: (ctx: XRPCReqContext) => number
  }) {
    this.limiter = new RateLimiterMemory({
      keyPrefix: opts.keyPrefix,
      duration: opts.duration,
      points: opts.points,
    })
    this.calcKey = opts.calcKey ?? defaultKey
    this.calcPoints = opts.calcPoints ?? defaultPoints
  }

  async consume(ctx: XRPCReqContext) {
    const key = this.calcKey(ctx)
    const points = this.calcPoints(ctx)
    try {
      await this.limiter.consume(key, points)
    } catch (err) {
      // @TODO better error handling - fail open?
      throw new RateLimitExceededError()
    }
  }
}

export class RateLimiter {
  public limiter: RateLimiterMemory
  public calcKey: (ctx: XRPCReqContext) => string
  public calcPoints: (ctx: XRPCReqContext) => number

  constructor(opts: {
    keyPrefix: string
    duration: number
    points: number
    calcKey?: (ctx: XRPCReqContext) => string
    calcPoints?: (ctx: XRPCReqContext) => number
  }) {
    this.limiter = new RateLimiterMemory({
      keyPrefix: opts.keyPrefix,
      duration: opts.duration,
      points: opts.points,
    })
    this.calcKey = opts.calcKey ?? defaultKey
    this.calcPoints = opts.calcPoints ?? defaultPoints
  }

  async consume(ctx: XRPCReqContext) {
    const key = this.calcKey(ctx)
    const points = this.calcPoints(ctx)
    try {
      await this.limiter.consume(key, points)
    } catch (err) {
      // @TODO better error handling - fail open?
      throw new RateLimitExceededError()
    }
  }
}

const defaultKey = (ctx: XRPCReqContext) => ctx.req.ip
const defaultPoints = () => 1
