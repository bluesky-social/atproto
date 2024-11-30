import { cacheLogger as log } from '../logger'
import { Redis } from '../redis'

export type CacheItem<T> = {
  val: T | null // null here is for negative caching
  updatedAt: number
}

export type CacheOptions<T> = {
  staleTTL: number
  maxTTL: number
  fetchMethod: (key: string) => Promise<T | null>
  fetchManyMethod?: (keys: string[]) => Promise<Record<string, T | null>>
}

export class ReadThroughCache<T> {
  constructor(
    public redis: Redis,
    public opts: CacheOptions<T>,
  ) {}

  private async _fetchMany(keys: string[]): Promise<Record<string, T | null>> {
    let result: Record<string, T | null> = {}
    if (this.opts.fetchManyMethod) {
      result = await this.opts.fetchManyMethod(keys)
    } else {
      const got = await Promise.all(keys.map((k) => this.opts.fetchMethod(k)))
      for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = got[i] ?? null
      }
    }
    // ensure caching negatives
    for (const key of keys) {
      result[key] ??= null
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

  async get(key: string, opts?: { revalidate?: boolean }): Promise<T | null> {
    if (opts?.revalidate) {
      return this.fetchAndCache(key)
    }
    let cached: CacheItem<T> | null
    try {
      const got = await this.redis.get(key)
      cached = got ? JSON.parse(got) : null
    } catch (err) {
      cached = null
      log.warn({ key, err }, 'failed to fetch value from cache')
    }
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
    opts?: { revalidate?: boolean },
  ): Promise<Record<string, T>> {
    if (opts?.revalidate) {
      return this.fetchAndCacheMany(keys)
    }
    let cached: Record<string, string>
    try {
      cached = await this.redis.getMulti(keys)
    } catch (err) {
      cached = {}
      log.warn({ keys, err }, 'failed to fetch values from cache')
    }

    const stale: string[] = []
    const toFetch: string[] = []
    const results: Record<string, T> = {}
    for (const key of keys) {
      const val = cached[key] ? (JSON.parse(cached[key]) as CacheItem<T>) : null
      if (!val || this.isExpired(val)) {
        toFetch.push(key)
        continue
      }
      if (this.isStale(val)) {
        stale.push(key)
      }
      if (val.val) {
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
    await this.setMany({ [key]: val })
  }

  async setMany(vals: Record<string, T | null>) {
    const items: Record<string, string> = {}
    for (const key of Object.keys(vals)) {
      items[key] = JSON.stringify({
        val: vals[key],
        updatedAt: Date.now(),
      })
    }
    await this.redis.setMulti(items, this.opts.maxTTL)
  }

  async clearEntry(key: string) {
    await this.redis.del(key)
  }

  isExpired(result: CacheItem<T>) {
    return Date.now() > result.updatedAt + this.opts.maxTTL
  }

  isStale(result: CacheItem<T>) {
    return Date.now() > result.updatedAt + this.opts.staleTTL
  }
}

const removeNulls = <T>(obj: Record<string, T | null>): Record<string, T> => {
  return Object.entries(obj).reduce(
    (acc, [key, val]) => {
      if (val !== null) {
        acc[key] = val
      }
      return acc
    },
    {} as Record<string, T>,
  )
}
