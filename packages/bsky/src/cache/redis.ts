import { Redis } from 'ioredis'
import { addressParts } from '../redis'
import { cacheLogger as log } from '../logger'

export type CacheItem<T> = {
  val: T | null
  updatedAt: number
}

export class RedisCache {
  public redis: Redis

  constructor(host: string, password?: string) {
    const redisAddr = addressParts(host)
    this.redis = new Redis({
      ...redisAddr,
      password,
    })
    this.redis.on('error', (err) => {
      log.error({ host, err }, 'redis error')
    })
  }

  async get<T>(key: string, namespace?: string): Promise<CacheItem<T> | null> {
    const got = await this.redis.get(ns(key, namespace))
    return got ? JSON.parse(got) : null
  }

  async getMany<T>(
    keys: string[],
    namespace?: string,
  ): Promise<Record<string, CacheItem<T>>> {
    const namespacedKeys = keys.map((k) => ns(k, namespace))
    const got = await this.redis.mget(...namespacedKeys)
    const results: Record<string, CacheItem<T>> = {}
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const val = got[i]
      if (val) {
        results[key] = JSON.parse(val)
      }
    }
    return results
  }

  async set<T>(key: string, val: T | null, namespace?: string, ttlMs?: number) {
    return this.setMany({ [key]: val }, namespace, ttlMs)
  }

  async setMany<T>(
    vals: Record<string, T | null>,
    namespace?: string,
    ttlMs?: number,
  ) {
    const toSet: string[] = []
    let builder = this.redis.multi({ pipeline: true })
    for (const key of Object.keys(vals)) {
      toSet.push(key)
      const val = JSON.stringify({
        val: vals[key],
        updatedAt: Date.now(),
      })
      builder = builder.set(ns(key, namespace), val)
      if (ttlMs !== undefined) {
        builder = builder.pexpire(key, ttlMs)
      }
    }
    await builder.exec()
  }

  async delete(key: string, namespace?: string) {
    await this.redis.del(ns(key, namespace))
  }

  async close() {
    await this.redis.quit()
  }
}

function ns(key: string, namespace?: string): string {
  if (!namespace) return key
  return `${namespace}-${key}`
}
