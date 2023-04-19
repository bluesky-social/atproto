import * as crypto from '@atproto/crypto'
import { check } from '@atproto/common-web'
import { AtprotoData, DidDocument, didDocument } from './types'
import * as atprotoData from './atproto-data'
import { DidNotFoundError, PoorlyFormattedDidDocumentError } from './errors'
import { DidCache } from './did-cache'

export abstract class BaseResolver {
  constructor(public cache?: DidCache) {}

  abstract resolveDidNoCheck(did: string): Promise<unknown | null>

  async refreshCache(did: string): Promise<void> {
    if (!this.cache) return
    const got = await this.resolveDidNoCheck(did)
    if (check.is(got, didDocument)) {
      await this.cache.cacheDid(did, got)
    }
  }

  async resolveDid(did: string): Promise<DidDocument | null> {
    if (this.cache) {
      const fromCache = await this.cache.checkCache(did)
      if (fromCache?.expired) {
        this.refreshCache(did) // done in background
      }
      if (fromCache) {
        return fromCache.doc
      }
    }

    const got = await this.resolveDidNoCheck(did)
    if (got === null) return null
    if (!check.is(got, didDocument)) {
      throw new PoorlyFormattedDidDocumentError(did, got)
    }
    if (got.id !== did) {
      throw new PoorlyFormattedDidDocumentError(did, got)
    }
    this.cache?.cacheDid(did, got) // done in background
    return got
  }

  async ensureResolveDid(did: string): Promise<DidDocument> {
    const result = await this.resolveDid(did)
    if (result === null) {
      throw new DidNotFoundError(did)
    }
    return result
  }

  async resolveAtprotoData(did: string): Promise<AtprotoData> {
    const didDocument = await this.ensureResolveDid(did)
    return atprotoData.ensureAtpDocument(didDocument)
  }

  async resolveAtprotoKey(did: string): Promise<string> {
    if (did.startsWith('did:key:')) {
      return did
    } else {
      const data = await this.resolveAtprotoData(did)
      return data.signingKey
    }
  }

  async verifySignature(
    did: string,
    data: Uint8Array,
    sig: Uint8Array,
  ): Promise<boolean> {
    const signingKey = await this.resolveAtprotoKey(did)
    return crypto.verifySignature(signingKey, data, sig)
  }
}

export default BaseResolver
