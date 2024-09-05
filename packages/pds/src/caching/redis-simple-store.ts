import { SimpleStore } from '@atproto-labs/simple-store'
import Redis from 'ioredis'

import { redisLogger } from '../logger'

export class RedisSimpleStore implements SimpleStore<string, string> {
  /**
   * @param redis - Redis client
   * @param maxTTL - Maximum age of a cached revision in milliseconds
   */
  constructor(
    protected readonly redis: Redis,
    protected readonly maxTTL: number,
    protected readonly storeName: string,
  ) {
    // Redis expects the expiration time in milliseconds
    if (!Number.isFinite(this.maxTTL) || this.maxTTL <= 0) {
      throw new TypeError('maxAge must be a positive number')
    }
  }

  protected key(did: string): string {
    return `${this.storeName}:${did}`
  }

  async get(did: string): Promise<string | undefined> {
    try {
      const value = await this.redis.get(this.key(did))
      return value || undefined
    } catch (err) {
      redisLogger.error({ err, did }, `error getting ${this.storeName}`)
      return undefined
    }
  }

  async set(did: string, value: string): Promise<void> {
    try {
      await this.redis.set(this.key(did), value, 'PX', this.maxTTL)
    } catch (err) {
      redisLogger.error({ err, did, value }, `error setting ${this.storeName}`)
    }
  }

  async del(did: string): Promise<void> {
    try {
      await this.redis.del(this.key(did))
    } catch (err) {
      redisLogger.error({ err, did }, `error deleting ${this.storeName}`)
    }
  }
}
