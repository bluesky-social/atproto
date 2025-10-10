import assert from 'node:assert'
import { DAY, HOUR } from '@atproto/common'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { dataplaneLogger } from '../../logger'
import { Redis } from '../../redis'

type StoredValue = { doc: DidDocument; updatedAt: number }

export class RedisDidCache implements DidCache {
  constructor(
    private redis: Redis,
    private expireMs: number = 7 * DAY,
    private staleMs: number = 6 * HOUR,
  ) {}

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    const value: StoredValue = { doc, updatedAt: Date.now() }
    await this.redis.set(did, JSON.stringify(value), this.expireMs)
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    const now = Date.now()
    const result = await this.redis.get(did)
    if (!result) return null
    const value = safeParse<StoredValue>(result)
    if (!value) {
      await this.clearEntry(did)
      return null
    }
    return {
      did,
      doc: value.doc,
      updatedAt: value.updatedAt,
      stale: now > value.updatedAt + this.staleMs,
      expired: now > value.updatedAt + this.expireMs,
    }
  }

  async refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void> {
    ;(async () => {
      try {
        const doc = await getDoc()
        if (doc) {
          await this.cacheDid(did, doc)
        } else {
          await this.clearEntry(did)
        }
      } catch (err) {
        dataplaneLogger.error({ did, err }, 'refreshing redis did cache failed')
      }
    })()
  }

  async clearEntry(did: string): Promise<void> {
    await this.redis.del(did)
  }

  clear(): Promise<void> {
    assert.fail('clear() not implemented')
  }
}

function safeParse<T>(val: string) {
  try {
    return JSON.parse(val) as T
  } catch {
    return
  }
}
