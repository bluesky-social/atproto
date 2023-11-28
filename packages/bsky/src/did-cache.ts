import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { dbLogger } from './logger'
import { Redis } from 'ioredis'

type CacheItem = {
  val: DidDocument
  updatedAt: number
}

type CacheOptions = {
  redisHost: string
  redisPassword?: string
  staleTTL: number
  maxTTL: number
}

export class DidRedisCache implements DidCache {
  public redis: Redis
  public staleTTL: number
  public maxTTL: number
  public pQueue: PQueue | null //null during teardown

  constructor(opts: CacheOptions) {
    this.redis = new Redis({
      host: opts.redisHost,
      password: opts.redisPassword,
      keyPrefix: 'did-doc',
    })
    this.staleTTL = opts.staleTTL
    this.maxTTL = opts.maxTTL
    this.pQueue = new PQueue()
  }

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    const item = JSON.stringify({
      val: doc,
      updatedAt: Date.now(),
    })
    await this.redis.set(did, item)
  }

  async refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void> {
    this.pQueue?.add(async () => {
      try {
        const doc = await getDoc()
        if (doc) {
          await this.cacheDid(did, doc)
        } else {
          await this.clearEntry(did)
        }
      } catch (err) {
        dbLogger.error({ did, err }, 'refreshing did cache failed')
      }
    })
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    const got = await this.redis.get(did)
    if (!got) return null
    const { val, updatedAt } = JSON.parse(got) as CacheItem
    const now = Date.now()
    const expired = now > updatedAt + this.maxTTL
    const stale = now > updatedAt + this.staleTTL
    return {
      doc: val,
      updatedAt,
      did,
      stale,
      expired,
    }
  }

  async clearEntry(did: string): Promise<void> {
    await this.redis.del(did)
  }

  async clear(): Promise<void> {
    throw new Error('Not implemented for redis cache')
  }

  async processAll() {
    await this.pQueue?.onIdle()
  }

  async destroy() {
    const pQueue = this.pQueue
    this.pQueue = null
    pQueue?.pause()
    pQueue?.clear()
    await pQueue?.onIdle()
  }
}

export default DidRedisCache
