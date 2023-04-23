import { CacheResult, DidDocument } from './types'

export abstract class DidCache {
  abstract cacheDid(did: string, doc: DidDocument): Promise<void>
  abstract checkCache(did: string): Promise<CacheResult | null>
  abstract refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void>
  abstract clearEntry(did: string): Promise<void>
  abstract clear(): Promise<void>
}
