import * as z from 'zod'

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

export type DidDocument = z.infer<typeof didDocument>
