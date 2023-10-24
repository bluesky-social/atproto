import * as crypto from '@atproto/crypto'
import { check } from '@atproto/common-web'
import { DidCache, AtprotoData, DidDocument, didDocument } from '../types'
import * as atprotoData from './atproto-data'
import { DidNotFoundError, PoorlyFormattedDidDocumentError } from '../errors'

export abstract class BaseResolver {
  constructor(public cache?: DidCache) {}

  abstract resolveNoCheck(did: string): Promise<unknown | null>

  /** Throws if argument is not a valid DidDocument.
   *
   * Only checks type structure, does not parse internal fields.
   *
   * @param did - DID to verify against field in the document itself
   * @param val - object to verify structure as a DidDocument
   */
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

  async refreshCache(did: string): Promise<void> {
    await this.cache?.refreshCache(did, () => this.resolveNoCache(did))
  }

  /**
   * Resolves DID, possibly from cached. Stale entries are refreshed; never returns a stale entry.
   *
   * @param forceRefresh - force update of cache
   * @returns DID document if successful, null if successful not found (eg, HTTP 404), throws on resolution error
   */
  async resolve(
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

    const got = await this.resolveNoCache(did)
    if (got === null) {
      await this.cache?.clearEntry(did)
      return null
    }
    await this.cache?.cacheDid(did, got)
    return got
  }

  /** Variant of resolve() which throws if DID does not exist, instead of returning null */
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

  /** Helper to do DID resolution and extract repo public key */
  async resolveAtprotoKey(did: string, forceRefresh = false): Promise<string> {
    if (did.startsWith('did:key:')) {
      return did
    } else {
      const data = await this.resolveAtprotoData(did, forceRefresh)
      return data.signingKey
    }
  }

  /** Helper to do DID resolution, extract repo public key, and verify signature */
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
