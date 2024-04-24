import type { ReplayStore } from '@atproto/oauth-provider'
import { Redis, type RedisOptions } from 'ioredis'

export type { RedisOptions, Redis }

export type ReplayStoreRedisOptions = Redis | RedisOptions | string

export class ReplayStoreRedis implements ReplayStore {
  private readonly redis: Redis

  constructor(options: ReplayStoreRedisOptions) {
    if (options instanceof Redis) {
      this.redis = options
    } else if (typeof options === 'string') {
      const url = new URL(
        options.startsWith('redis://') ? options : `redis://${options}`,
      )

      this.redis = new Redis({
        host: url.hostname,
        port: parseInt(url.port, 10),
        password: url.password,
      })
    } else {
      this.redis = new Redis(options)
    }
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
