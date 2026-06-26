import type { Redis } from 'ioredis'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import { MemoryRateLimiter, RedisRateLimiter } from '@atproto/xrpc-server'
import type { Options } from '@atproto/xrpc-server'
import type { RateLimitsConfig } from './config/index.js'

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
