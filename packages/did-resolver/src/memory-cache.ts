import { DAY } from '@atproto/common-web'
import { DidCache } from './did-cache'
import { CacheResult, DidDocument } from './types'

type CacheVal = {
  doc: DidDocument
  updatedAt: number
}

export class MemoryCache extends DidCache {
  public ttl: number
  constructor(ttl?: number) {
    super()
    this.ttl = ttl ?? DAY
  }

  public cache: Record<string, CacheVal> = {}

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    this.cache[did] = { doc, updatedAt: Date.now() }
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
    const val = this.cache[did]
    if (!val) return null
    const now = Date.now()
    const expired = now > val.updatedAt + this.ttl
    return {
      ...val,
      did,
      expired,
    }
  }

  async clear(): Promise<void> {
    this.cache = {}
  }
}
