import * as crypto from '@atproto/crypto'
import { check } from '@atproto/common-web'
import { AtprotoData, DidDocument, didDocument } from './types'
import * as atprotoData from './atproto-data'
import { DidNotFoundError, PoorlyFormattedDidDocumentError } from './errors'
import { DidCache } from './did-cache'

export abstract class BaseResolver {
  constructor(public cache?: DidCache) {}

  abstract resolveDidNoCheck(did: string): Promise<unknown | null>

  validateDidDoc(did: string, val: unknown): DidDocument {
    if (!check.is(val, didDocument)) {
      throw new PoorlyFormattedDidDocumentError(did, val)
    }
    if (val.id !== did) {
      throw new PoorlyFormattedDidDocumentError(did, val)
    }
    return val
  }

  async resolveDidNoCache(did: string): Promise<DidDocument | null> {
    const got = await this.resolveDidNoCheck(did)
    if (got === null) return null
    return this.validateDidDoc(did, got)
  }

  async refreshCache(did: string): Promise<void> {
    await this.cache?.refreshCache(did, () => this.resolveDidNoCache(did))
  }

  async resolveDid(
    did: string,
    forceRefresh = false,
  ): Promise<DidDocument | null> {
    if (this.cache && !forceRefresh) {
      const fromCache = await this.cache.checkCache(did)
      if (fromCache?.stale) {
        await this.refreshCache(did)
      }
      if (fromCache) {
        return fromCache.doc
      }
    }

    const got = await this.resolveDidNoCache(did)
    if (got === null) {
      await this.cache?.clearEntry(did)
      return null
    }
    await this.cache?.cacheDid(did, got)
    return got
  }

  async ensureResolveDid(
    did: string,
    forceRefresh = false,
  ): Promise<DidDocument> {
    const result = await this.resolveDid(did, forceRefresh)
    if (result === null) {
      throw new DidNotFoundError(did)
    }
    return result
  }

  async resolveAtprotoData(
    did: string,
    forceRefresh = false,
  ): Promise<AtprotoData> {
    const didDocument = await this.ensureResolveDid(did, forceRefresh)
    return atprotoData.ensureAtpDocument(didDocument)
  }

  async resolveAtprotoKey(did: string, forceRefresh = false): Promise<string> {
    if (did.startsWith('did:key:')) {
      return did
    } else {
      const data = await this.resolveAtprotoData(did, forceRefresh)
      return data.signingKey
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
