import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { cacheLogger as log } from './logger'
import { Redis } from './redis'

type CacheOptions = {
  staleTTL: number
  maxTTL: number
}

export class DidRedisCache implements DidCache {
  public pQueue: PQueue | null // null during teardown

  constructor(public redis: Redis, public opts: CacheOptions) {
    this.pQueue = new PQueue()
  }

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    const item = JSON.stringify({
      doc,
      updatedAt: Date.now(),
    })
    await this.redis.set(did, item, this.opts.maxTTL)
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
    let got: string | null
    try {
      got = await this.redis.get(did)
    } catch (err) {
      got = null
      log.error({ did, err }, 'error fetching did from cache')
    }
    if (!got) return null
    const { doc, updatedAt } = JSON.parse(got) as CacheResult
    const now = Date.now()
    const expired = now > updatedAt + this.opts.maxTTL
    const stale = now > updatedAt + this.opts.staleTTL
    return {
      doc,
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
