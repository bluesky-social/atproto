import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { cacheLogger as log } from './logger'
import { RedisCache } from './cache/redis'

type CacheOptions = {
  staleTTL: number
  maxTTL: number
}

export class DidRedisCache implements DidCache {
  public pQueue: PQueue | null //null during teardown
  namespace = 'did-doc'

  constructor(public redisCache: RedisCache, public opts: CacheOptions) {
    this.pQueue = new PQueue()
  }

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    await this.redisCache.set(did, doc, this.namespace)
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
        log.error({ did, err }, 'refreshing did cache failed')
      }
    })
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    const got = await this.redisCache.get<DidDocument>(did, this.namespace)
    if (!got || !got.val) return null
    const { val, updatedAt } = got
    const now = Date.now()
    const expired = now > updatedAt + this.opts.maxTTL
    const stale = now > updatedAt + this.opts.staleTTL
    return {
      doc: val,
      updatedAt,
      did,
      stale,
      expired,
    }
  }

  async clearEntry(did: string): Promise<void> {
    await this.redisCache.delete(did, this.namespace)
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
