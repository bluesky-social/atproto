import { Redis } from 'ioredis'
import PQueue from 'p-queue'
import { addressParts } from './redis'
import { cacheLogger as log } from './logger'

type CacheItem<T> = {
  val: T | null
  updatedAt: number
}

type CacheResult<T> = {
  val: T | null
  updatedAt: number
  stale: boolean
  expired: boolean
}

export type CacheOptions = {
  redisHost: string
  redisPassword?: string
  staleTTL: number
  maxTTL: number
}

export abstract class Cache<T> {
  public redis: Redis
  public staleTTL: number
  public maxTTL: number
  public pQueue: PQueue | null //null during teardown

  constructor(opts: CacheOptions) {
    const redisAddr = addressParts(opts.redisHost)
    this.redis = new Redis({
      ...redisAddr,
      password: opts.redisPassword,
    })
    this.redis.on('error', (err) => {
      log.error({ host: opts.redisHost, err }, 'redis error')
    })
    this.staleTTL = opts.staleTTL
    this.maxTTL = opts.maxTTL
    this.pQueue = new PQueue()
  }

  abstract fetchImpl(key: string): Promise<T | null>

  async fetchManyImpl(keys: string[]): Promise<Record<string, T | null>> {
    const got = await Promise.all(keys.map((k) => this.fetchImpl(k)))
    const result: Record<string, T | null> = {}
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = got[i]
    }
    return result
  }

  async fetch(key: string): Promise<T | null> {
    const fetched = await this.fetch(key)
    this.set(key, fetched).catch(() => {})
    return fetched
  }

  async fetchMany(keys: string[]): Promise<Record<string, T>> {
    const fetched = await this.fetchMany(keys)
    this.setMany(fetched).catch(() => {})
    return removeNulls(fetched)
  }

  async get(key: string, opts?: { skipCache?: boolean }): Promise<T | null> {
    if (opts?.skipCache) {
      return this.fetch(key)
    }
    const got = await this.redis.get(key)
    const cached = this.parseCacheResult(got)
    if (!cached || cached.expired) {
      return this.fetch(key)
    }
    if (cached.stale) {
      this.fetch(key).catch(() => {})
    }
    return cached.val
  }

  async getMany(
    keys: string[],
    opts?: { skipCache?: boolean },
  ): Promise<Record<string, T>> {
    if (opts?.skipCache) {
      return this.fetchMany(keys)
    }
    const got = await this.redis.mget(...keys)
    const cached = got.map((val) => this.parseCacheResult(val))
    const stale: string[] = []
    const toFetch: string[] = []
    const results: Record<string, T> = {}
    for (let i = 0; i < keys.length; i++) {
      const val = cached[i]
      if (!val || val.expired) {
        toFetch.push(keys[i])
      } else if (val.stale) {
        stale.push(keys[i])
      } else if (val.val) {
        results[keys[i]] = val.val
      }
    }
    const fetched = await this.fetchMany(toFetch)
    this.fetchMany(stale).catch(() => {})
    return {
      ...results,
      ...fetched,
    }
  }

  async set(key: string, val: T | null) {
    return this.setMany({ [key]: val })
  }

  async setMany(vals: Record<string, T | null>) {
    const toSet: string[] = []
    let builder = this.redis.multi({ pipeline: true })
    for (const key of Object.keys(vals)) {
      toSet.push(key)
      const val = JSON.stringify({
        val: vals[key],
        updatedAt: Date.now(),
      })
      builder = builder.set(key, val).pexpire(key, this.maxTTL)
    }
    await builder.exec()
  }

  async clearEntry(key: string) {
    await this.redis.del(key)
  }

  parseCacheResult(got: string | null): CacheResult<T> | null {
    if (!got) return null
    const { val, updatedAt } = JSON.parse(got) as CacheItem<T>
    const now = Date.now()
    const expired = now > updatedAt + this.maxTTL
    const stale = now > updatedAt + this.staleTTL
    return {
      val,
      updatedAt,
      expired,
      stale,
    }
  }

  async close() {
    const pQueue = this.pQueue
    this.pQueue = null
    pQueue?.pause()
    pQueue?.clear()
    await pQueue?.onIdle()
    await this.redis.quit()
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
