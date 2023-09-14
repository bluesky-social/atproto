import * as z from 'zod'

export type IdentityResolverOpts = {
  /** Resolution timeout in miliseconds */
  timeout?: number
  plcUrl?: string
  didCache?: DidCache
  backupNameservers?: string[]
}

export type HandleResolverOpts = {
  /** Resolution timeout in miliseconds */
  timeout?: number
  backupNameservers?: string[]
}

export type DidResolverOpts = {
  /** Resolution timeout in miliseconds */
  timeout?: number
  plcUrl?: string
  didCache?: DidCache
}

export type AtprotoData = {
  did: string
  /** Public key of repo signing key, as multibase (as included in the DID document) */
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
  /** Inserts a single entry to the cache */
  cacheDid(did: string, doc: DidDocument): Promise<void>
  checkCache(did: string): Promise<CacheResult | null>
  refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void>
  /** Removes a single entry from the cache */
  clearEntry(did: string): Promise<void>
  /** Removes all entries from the cache */
  clear(): Promise<void>
}

export const verificationMethod = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyMultibase: z.string().optional(),
})

export const service = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.union([z.string(), z.record(z.unknown())]),
})

export const didDocument = z.object({
  id: z.string(),
  alsoKnownAs: z.array(z.string()).optional(),
  verificationMethod: z.array(verificationMethod).optional(),
  service: z.array(service).optional(),
})

/**
 * Represents the subset of DID Document format used by atproto
 *
 * @link https://www.w3.org/TR/did-core/
 */
export type DidDocument = z.infer<typeof didDocument>
