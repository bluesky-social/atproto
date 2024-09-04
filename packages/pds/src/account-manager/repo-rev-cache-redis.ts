import { SimpleStore } from '@atproto-labs/simple-store'
import Redis from 'ioredis'

import { redisLogger } from '../logger'

const key = (did: string) => `latestRev:${did}`

export class RepoRevCacheRedis implements SimpleStore<string, string> {
  /**
   * @param redis - Redis client
   * @param maxAge - Maximum age of a cached revision in milliseconds
   */
  constructor(
    protected readonly redis: Redis,
    protected readonly px: number,
  ) {
    // Redis expects the expiration time in seconds
    if (!Number.isFinite(this.px) || this.px <= 0) {
      throw new TypeError('maxAge must be a positive number')
    }
  }

  async get(did: string): Promise<string | undefined> {
    try {
      const rev = await this.redis.get(key(did))
      return rev || undefined
    } catch (err) {
      redisLogger.error({ err, did }, 'error getting latestRev')
      return undefined
    }
  }

  async set(did: string, rev: string): Promise<void> {
    try {
      await this.redis.set(key(did), rev, 'PX', this.px)
    } catch (err) {
      redisLogger.error({ err, did, rev }, 'error setting latestRev')
    }
  }

  async del(did: string): Promise<void> {
    try {
      await this.redis.del(key(did))
    } catch (err) {
      redisLogger.error({ err, did }, 'error deleting latestRev')
    }
  }
}
