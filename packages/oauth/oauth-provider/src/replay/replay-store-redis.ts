import type { Redis } from 'ioredis'

import { CreateRedisOptions, createRedis } from '../lib/redis.js'
import type { ReplayStore } from './replay-store.js'

export type { CreateRedisOptions, Redis }

export type ReplayStoreRedisOptions = {
  redis: CreateRedisOptions
}

export class ReplayStoreRedis implements ReplayStore {
  private readonly redis: Redis

  constructor(options: ReplayStoreRedisOptions) {
    this.redis = createRedis(options.redis)
  }

  /**
   * Returns true if the nonce is unique within the given time frame.
   */
  async unique(
    namespace: string,
    nonce: string,
    timeFrame: number,
  ): Promise<boolean> {
    const key = `nonces:${namespace}:${nonce}`
    const prev = await this.redis.set(key, '1', 'PX', timeFrame, 'GET')
    return prev == null
  }
}
