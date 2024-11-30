import * as crypto from '@atproto/crypto'
import { check } from '@atproto/common-web'
import {
  DidCache,
  AtprotoData,
  DidDocument,
  didDocument,
  CacheResult,
} from '../types'
import * as atprotoData from './atproto-data'
import { DidNotFoundError, PoorlyFormattedDidDocumentError } from '../errors'

export abstract class BaseResolver {
  constructor(public cache?: DidCache) {}

  abstract resolveNoCheck(did: string): Promise<unknown | null>

  validateDidDoc(did: string, val: unknown): DidDocument {
    if (!check.is(val, didDocument)) {
      throw new PoorlyFormattedDidDocumentError(did, val)
    }
    if (val.id !== did) {
      throw new PoorlyFormattedDidDocumentError(did, val)
    }
    return val
  }

  async resolveNoCache(did: string): Promise<DidDocument | null> {
    const got = await this.resolveNoCheck(did)
    if (got === null) return null
    return this.validateDidDoc(did, got)
  }

  async refreshCache(did: string, prevResult?: CacheResult): Promise<void> {
    await this.cache?.refreshCache(
      did,
      () => this.resolveNoCache(did),
      prevResult,
    )
  }

  async resolve(
    did: string,
    forceRefresh = false,
  ): Promise<DidDocument | null> {
    let fromCache: CacheResult | null = null
    if (this.cache && !forceRefresh) {
      fromCache = await this.cache.checkCache(did)
      if (fromCache && !fromCache.expired) {
        if (fromCache?.stale) {
          await this.refreshCache(did, fromCache)
        }
        return fromCache.doc
      }
    }

    const got = await this.resolveNoCache(did)
    if (got === null) {
      await this.cache?.clearEntry(did)
      return null
    }
    await this.cache?.cacheDid(did, got, fromCache ?? undefined)
    return got
  }

  async ensureResolve(did: string, forceRefresh = false): Promise<DidDocument> {
    const result = await this.resolve(did, forceRefresh)
    if (result === null) {
      throw new DidNotFoundError(did)
    }
    return result
  }

  async resolveAtprotoData(
    did: string,
    forceRefresh = false,
  ): Promise<AtprotoData> {
    const didDocument = await this.ensureResolve(did, forceRefresh)
    return atprotoData.ensureAtpDocument(didDocument)
  }

  async resolveAtprotoKey(did: string, forceRefresh = false): Promise<string> {
    if (did.startsWith('did:key:')) {
      return did
    } else {
      const didDocument = await this.ensureResolve(did, forceRefresh)
      return atprotoData.ensureAtprotoKey(didDocument)
    }
  }

  async verifySignature(
    did: string,
    data: Uint8Array,
    sig: Uint8Array,
    forceRefresh = false,
  ): Promise<boolean> {
    const signingKey = await this.resolveAtprotoKey(did, forceRefresh)
    return crypto.verifySignature(signingKey, data, sig)
  }
}

export default BaseResolver
