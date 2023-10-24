import { DidDocument } from '@atproto/common-web'

export { didDocument } from '@atproto/common-web'
export type { DidDocument } from '@atproto/common-web'

export type IdentityResolverOpts = {
  timeout?: number
  plcUrl?: string
  didCache?: DidCache
  backupNameservers?: string[]
}

export type HandleResolverOpts = {
  timeout?: number
  backupNameservers?: string[]
}

export type DidResolverOpts = {
  timeout?: number
  plcUrl?: string
  didCache?: DidCache
}

export type AtprotoData = {
  did: string
  signingKey: string
  handle: string
  pds: string
}

export type CacheResult = {
  did: string
  doc: DidDocument
  updatedAt: number
  stale: boolean
}

export interface DidCache {
  cacheDid(did: string, doc: DidDocument): Promise<void>
  checkCache(did: string): Promise<CacheResult | null>
  refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void>
  clearEntry(did: string): Promise<void>
  clear(): Promise<void>
}
