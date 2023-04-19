import * as crypto from '@atproto/crypto'
import { check } from '@atproto/common-web'
import { AtprotoData, DidDocument, didDocument } from './types'
import * as atprotoData from './atproto-data'
import { DidNotFoundError } from './errors'

export abstract class BaseResolver {
  abstract resolveDidNoCheck(did: string): Promise<unknown | null>

  async resolveDid(did: string): Promise<DidDocument | null> {
    const got = await this.resolveDidNoCheck(did)
    if (got === null) return got
    if (check.is(got, didDocument)) {
      return got
    } else {
      throw new Error()
    }
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
