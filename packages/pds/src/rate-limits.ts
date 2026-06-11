import { DAY, HOUR, MINUTE } from '@atproto/common'
import type { Options } from '@atproto/xrpc-server'
import type { RateLimitsConfig } from './config/index.js'

type RateLimitDescriptions = Omit<
  NonNullable<Options['rateLimits']>,
  'creator'
>

const SYNC_GET_REPO_PATH = '/xrpc/com.atproto.sync.getRepo'

export const SYNC_GET_REPO_IP_RATE_LIMIT = 'sync-get-repo-ip'

export const buildRateLimitsConfig = (
  rateLimits: RateLimitsConfig,
): RateLimitDescriptions | undefined => {
  if (!rateLimits.enabled) return undefined

  return {
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
        name: SYNC_GET_REPO_IP_RATE_LIMIT,
        durationMs: 5 * MINUTE,
        points: 6000,
      },
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
