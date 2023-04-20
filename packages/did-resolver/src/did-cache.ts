import { CacheResult, DidDocument } from './types'

export abstract class DidCache {
  abstract cacheDid(did: string, doc: DidDocument): Promise<void>
  abstract checkCache(did: string): Promise<CacheResult | null>
  abstract clear(): Promise<void>
}
