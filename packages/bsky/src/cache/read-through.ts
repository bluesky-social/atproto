import { CacheItem, RedisCache } from './redis'
import { cacheLogger as log } from '../logger'

export type CacheOptions<T> = {
  staleTTL: number
  maxTTL: number
  namespace?: string
  fetchMethod: (key: string) => Promise<T | null>
  fetchManyMethod?: (keys: string[]) => Promise<Record<string, T | null>>
}

export class ReadThroughCache<T> {
  constructor(public redisCache: RedisCache, public opts: CacheOptions<T>) {}

  private async _fetchMany(keys: string[]): Promise<Record<string, T | null>> {
    if (this.opts.fetchManyMethod) {
      return this.opts.fetchManyMethod(keys)
    }
    const got = await Promise.all(keys.map((k) => this.opts.fetchMethod(k)))
    const result: Record<string, T | null> = {}
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = got[i] ?? null
    }
    return result
  }

  private async fetchAndCache(key: string): Promise<T | null> {
    const fetched = await this.opts.fetchMethod(key)
    this.set(key, fetched).catch((err) =>
      log.error({ err, key }, 'failed to set cache value'),
    )
    return fetched
  }

  private async fetchAndCacheMany(keys: string[]): Promise<Record<string, T>> {
    const fetched = await this._fetchMany(keys)
    this.setMany(fetched).catch((err) =>
      log.error({ err, keys }, 'failed to set cache values'),
    )
    return removeNulls(fetched)
  }

  async get(key: string, opts?: { skipCache?: boolean }): Promise<T | null> {
    if (opts?.skipCache) {
      return this.fetchAndCache(key)
    }
    const cached = await this.redisCache.get<T>(key, this.opts.namespace)
    if (!cached || this.isExpired(cached)) {
      return this.fetchAndCache(key)
    }
    if (this.isStale(cached)) {
      this.fetchAndCache(key).catch((err) =>
        log.warn({ key, err }, 'failed to refresh stale cache value'),
      )
    }
    return cached.val
  }

  async getMany(
    keys: string[],
    opts?: { skipCache?: boolean },
  ): Promise<Record<string, T>> {
    if (opts?.skipCache) {
      return this.fetchAndCacheMany(keys)
    }
    const cached = await this.redisCache.getMany<T>(keys, this.opts.namespace)
    const stale: string[] = []
    const toFetch: string[] = []
    const results: Record<string, T> = {}
    for (const key of keys) {
      const val = cached[key]
      if (!val || this.isExpired(val)) {
        toFetch.push(key)
      } else if (this.isStale(val)) {
        stale.push(key)
      } else if (val.val) {
        results[key] = val.val
      }
    }
    const fetched = await this.fetchAndCacheMany(toFetch)
    this.fetchAndCacheMany(stale).catch((err) =>
      log.warn({ keys, err }, 'failed to refresh stale cache values'),
    )
    return {
      ...results,
      ...fetched,
    }
  }

  async set(key: string, val: T | null) {
    await this.redisCache.set(key, val, this.opts.namespace, this.opts.maxTTL)
  }

  async setMany(vals: Record<string, T | null>) {
    await this.redisCache.setMany(vals, this.opts.namespace, this.opts.maxTTL)
  }

  async clearEntry(key: string) {
    await this.redisCache.delete(key, this.opts.namespace)
  }

  isExpired(result: CacheItem<T>) {
    return Date.now() > result.updatedAt + this.opts.maxTTL
  }

  isStale(result: CacheItem<T>) {
    return Date.now() > result.updatedAt + this.opts.staleTTL
  }
}

const removeNulls = <T>(obj: Record<string, T | null>): Record<string, T> => {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    if (val !== null) {
      acc[key] = val
    }
    return acc
  }, {} as Record<string, T>)
}
