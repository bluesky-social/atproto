import type { DidDocument } from '@atproto/common-web'
import type { Fetch } from '@atproto-labs/fetch-node'

export { didDocument } from '@atproto/common-web'
export type { DidDocument } from '@atproto/common-web'
export type { Fetch }

export type IdentityResolverOpts = {
  timeout?: number
  plcUrl?: string
  didCache?: DidCache
  backupNameservers?: string[]
  /**
   * Used for all HTTP identity resolution: the handle well-known endpoint,
   * `did:plc` and `did:web`.
   *
   * Defaults to an SSRF-protected fetch. A supplied fetch is used **as-is** and
   * is never re-wrapped, so pass one only if it is already safe for
   * user-controlled URLs, or if you intend to opt out — a test suite or a
   * dev-mode branch resolving against localhost.
   */
  fetch?: Fetch
}

export type HandleResolverOpts = {
  timeout?: number
  backupNameservers?: string[]
  /** @see {@link IdentityResolverOpts.fetch} */
  fetch?: Fetch
}

export type DidResolverOpts = {
  timeout?: number
  plcUrl?: string
  didCache?: DidCache
  /** @see {@link IdentityResolverOpts.fetch} */
  fetch?: Fetch
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
  expired: boolean
}

export interface DidCache {
  cacheDid(
    did: string,
    doc: DidDocument,
    prevResult?: CacheResult,
  ): Promise<void>
  checkCache(did: string): Promise<CacheResult | null>
  refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
    prevResult?: CacheResult,
  ): Promise<void>
  clearEntry(did: string): Promise<void>
  clear(): Promise<void>
}
