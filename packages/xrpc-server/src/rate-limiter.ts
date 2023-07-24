import { RateLimiterAbstract, RateLimiterMemory } from 'rate-limiter-flexible'
import {
  CalcKeyFn,
  CalcPointsFn,
  RateLimitExceededError,
  RateLimiterI,
  XRPCReqContext,
} from './types'

export class RateLimiter implements RateLimiterI {
  public limiter: RateLimiterAbstract
  public calcKey: CalcKeyFn
  public calcPoints: CalcPointsFn

  constructor(opts: {
    keyPrefix: string
    duration: number
    points: number
    calcKey?: CalcKeyFn
    calcPoints?: CalcPointsFn
  }) {
    this.limiter = new RateLimiterMemory({
      keyPrefix: opts.keyPrefix,
      duration: opts.duration,
      points: opts.points,
    })
    this.calcKey = opts.calcKey ?? defaultKey
    this.calcPoints = opts.calcPoints ?? defaultPoints
  }

  async consume(
    ctx: XRPCReqContext,
    opts?: { calcKey?: CalcKeyFn; calcPoints?: CalcPointsFn },
  ) {
    const key = opts?.calcKey ? opts.calcKey(ctx) : this.calcKey(ctx)
    const points = opts?.calcPoints
      ? opts.calcPoints(ctx)
      : this.calcPoints(ctx)
    try {
      await this.limiter.consume(key, points)
    } catch (err) {
      // @TODO better error handling - fail open?
      throw new RateLimitExceededError()
    }
  }
}

const defaultKey: CalcKeyFn = (ctx: XRPCReqContext) => ctx.req.ip
const defaultPoints: CalcPointsFn = () => 1
