import { DAY, HOUR } from '@atproto/common-web'
import { DidCache, CacheResult, DidDocument } from '../types'

type CacheVal = {
  doc: DidDocument
  updatedAt: number
}

export class MemoryCache implements DidCache {
  public staleTTL: number
  public maxTTL: number
  constructor(staleTTL?: number, maxTTL?: number) {
    this.staleTTL = staleTTL ?? HOUR
    this.maxTTL = maxTTL ?? DAY
  }

  public cache: Map<string, CacheVal> = new Map()

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    this.cache.set(did, { doc, updatedAt: Date.now() })
  }

  async refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void> {
    const doc = await getDoc()
    if (doc) {
      await this.cacheDid(did, doc)
    }
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    const val = this.cache.get(did)
    if (!val) return null
    const now = Date.now()
    const expired = now > val.updatedAt + this.maxTTL
    const stale = now > val.updatedAt + this.staleTTL
    return {
      ...val,
      did,
      stale,
      expired,
    }
  }

  async clearEntry(did: string): Promise<void> {
    this.cache.delete(did)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }
}
