import { DAY, HOUR } from '@atproto/common-web'
import type { CacheResult, DidCache, DidDocument } from '../types.js'

type CacheVal = {
  doc: DidDocument
  updatedAt: number
  size: number
}

/** Retention limits. Setting any limit to zero disables retention. */
export type MemoryCacheOptions = {
  /** Maximum number of cached documents. Defaults to 10,000. */
  maxEntries?: number
  /** Maximum UTF-8 bytes of serialized documents and DID keys. Defaults to 32 MiB. */
  maxBytes?: number
  /** Maximum UTF-8 bytes per serialized document. Defaults to 64 KiB. */
  maxDocBytes?: number
}

const encoder = new TextEncoder()

/**
 * A bounded LRU cache. Oversized documents can be resolved but are not retained.
 * Treat cached documents as immutable so their measured sizes remain accurate.
 */
export class MemoryCache implements DidCache {
  public staleTTL: number
  public maxTTL: number
  public readonly maxEntries: number
  public readonly maxBytes: number
  public readonly maxDocBytes: number
  private bytes = 0

  constructor(
    staleTTL?: number,
    maxTTL?: number,
    opts: MemoryCacheOptions = {},
  ) {
    this.staleTTL = staleTTL ?? HOUR
    this.maxTTL = maxTTL ?? DAY
    this.maxEntries = opts.maxEntries ?? 10_000
    this.maxBytes = opts.maxBytes ?? 32 * 1024 * 1024
    this.maxDocBytes = opts.maxDocBytes ?? 64 * 1024
    for (const limit of [this.maxEntries, this.maxBytes, this.maxDocBytes]) {
      if (!Number.isSafeInteger(limit) || limit < 0) {
        throw new RangeError('Cache limits must be non-negative safe integers')
      }
    }
  }

  /** Use the DidCache methods to mutate entries and maintain size accounting. */
  public cache: Map<string, CacheVal> = new Map()

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    // @NOTE Remove the previous version even if the replacement cannot be cached.
    this.remove(did)
    if (this.maxEntries === 0) return

    let docBytes: number
    try {
      const json = JSON.stringify(doc)
      if (json === undefined) return
      docBytes = encoder.encode(json).byteLength
    } catch {
      return
    }
    const size = docBytes + encoder.encode(did).byteLength
    if (docBytes > this.maxDocBytes || size > this.maxBytes) return

    while (
      this.cache.size >= this.maxEntries ||
      this.bytes + size > this.maxBytes
    ) {
      const oldest = this.cache.keys().next()
      if (oldest.done) break
      this.remove(oldest.value)
    }
    this.cache.set(did, { doc, updatedAt: Date.now(), size })
    this.bytes += size
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
    if (expired) {
      this.remove(did)
    } else {
      this.cache.delete(did)
      this.cache.set(did, val)
    }
    return {
      doc: val.doc,
      updatedAt: val.updatedAt,
      did,
      stale,
      expired,
    }
  }

  async clearEntry(did: string): Promise<void> {
    this.remove(did)
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.bytes = 0
  }

  private remove(did: string): void {
    const val = this.cache.get(did)
    if (!val) return
    this.cache.delete(did)
    this.bytes -= val.size
  }
}
