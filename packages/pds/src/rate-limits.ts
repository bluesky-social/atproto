import type { Redis } from 'ioredis'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import type { RateLimiterFactory } from '@atproto/oauth-provider/provider'
import {
  MemoryRateLimiter,
  RateLimitExceededError,
  RedisRateLimiter,
} from '@atproto/xrpc-server'
import type { Options, RateLimiterStatus } from '@atproto/xrpc-server'
import type { RateLimitsConfig } from './config/index.js'
import { oauthLogger } from './logger.js'

type RateLimitDescriptions = NonNullable<Options['rateLimits']>

const SYNC_GET_REPO_PATH = '/xrpc/com.atproto.sync.getRepo'

export const buildRateLimitsConfig = (
  rateLimits: RateLimitsConfig,
  redisScratch?: Redis,
): RateLimitDescriptions | undefined => {
  if (!rateLimits.enabled) return undefined

  return {
    creator: redisScratch
      ? (opts) => new RedisRateLimiter(redisScratch, opts)
      : (opts) => new MemoryRateLimiter(opts),
    bypass: ({ req }) => {
      const { bypassKey, bypassIps } = rateLimits
      if (bypassKey && bypassKey === req.headers['x-ratelimit-bypass']) {
        return true
      }
      if (bypassIps && bypassIps.includes(req.ip)) {
        return true
      }
      return false
    },
    global: [
      {
        name: 'global-ip',
        durationMs: 5 * MINUTE,
        points: 3000,
        // getRepo can be a high-volume sync path, so it has its own endpoint
        // limit and should not consume the shared global read bucket.
        calcKey: ({ req }) => {
          if (req.path === SYNC_GET_REPO_PATH) {
            return null
          }
          return req.ip
        },
      },
    ],
    shared: [
      {
        name: 'repo-write-hour',
        durationMs: HOUR,
        points: 5000, // creates=3, puts=2, deletes=1
      },
      {
        name: 'repo-write-day',
        durationMs: DAY,
        points: 35000, // creates=3, puts=2, deletes=1
      },
    ],
  }
}

/**
 * Backs the OAuth provider's rate limits with the same storage as the XRPC
 * rate limits. Backend failures are logged and fail open.
 */
export function buildOAuthRateLimiterFactory(
  redisScratch?: Redis,
): RateLimiterFactory {
  return ({ name, points, durationMs }) => {
    const options = {
      keyPrefix: `rl-oauth-${name}`,
      durationMs,
      points,
      calcKey: (key: string) => key,
      calcPoints: () => 1,
    }

    const limiter = redisScratch
      ? new RedisRateLimiter<string>(redisScratch, options)
      : new MemoryRateLimiter<string>(options)

    // @NOTE keys are not logged as they may contain an email address
    const logFailure = (err: unknown) => {
      oauthLogger.error(
        { err, limiter: name },
        'OAuth rate limiter failure (failing open)',
      )
    }

    // @NOTE The limiter's own "remainingPoints" is clamped to 0, which would not
    // allow distinguishing the last allowed point from an exceeded limit.
    const toResult = ({ consumedPoints, msBeforeNext }: RateLimiterStatus) => ({
      remainingPoints: points - consumedPoints,
      msBeforeNext,
    })

    return {
      async consume(key, consumedPoints) {
        try {
          const status = await limiter.consume(key, {
            calcPoints: () => consumedPoints,
          })
          // `null` when no point was consumed
          if (!status) return { remainingPoints: points, msBeforeNext: 0 }
          return toResult(status)
        } catch (err) {
          if (err instanceof RateLimitExceededError) return toResult(err.status)
          logFailure(err)
          return { remainingPoints: points, msBeforeNext: 0 }
        }
      },
    }
  }
}
