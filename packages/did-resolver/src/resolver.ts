import {
  Resolver,
  DIDDocument,
  DIDResolutionOptions,
  DIDResolutionResult,
} from 'did-resolver'
import * as crypto from '@atproto/crypto'
import * as web from './web-resolver'
import * as plc from './plc-resolver'
import * as atpDid from './atproto-data'
import log from './logger'

export type DidResolverOptions = {
  timeout: number
  plcUrl: string
}

export class DidResolver {
  resolver: Resolver
  constructor(opts: Partial<DidResolverOptions> = {}) {
    // @TODO change to production url
    const { timeout = 3000, plcUrl = 'http://localhost:2582' } = opts
    this.resolver = new Resolver({
      plc: plc.makeResolver({
        timeout,
        plcUrl,
      }),
      web: web.makeResolver({ timeout }),
    })
  }

  async resolveDid(
    did: string,
    options: DIDResolutionOptions = {},
  ): Promise<DIDResolutionResult> {
    log.info({ did }, 'resolving did')
    const res = await this.resolver.resolve(did, options)
    log.info({ did, res }, 'resolved did')
    return res
  }

  async ensureResolveDid(
    did: string,
    options: DIDResolutionOptions = {},
  ): Promise<DIDDocument> {
    const result = await this.resolveDid(did, options)
    if (result.didResolutionMetadata.error || result.didDocument === null) {
      const err = result.didResolutionMetadata.error || 'notFound'
      log.info({ err, did }, 'could not resolve did')
      throw new NoResolveDidError(`Could not resolve DID (${did}): ${err}`)
    }
    return result.didDocument
  }

  async resolveAtpData(did: string): Promise<atpDid.AtprotoData> {
    const didDocument = await this.ensureResolveDid(did)
    return atpDid.ensureAtpDocument(didDocument)
  }

  async resolveSigningKey(did: string): Promise<string> {
    if (did.startsWith('did:key:')) {
      return did
    } else {
      const data = await this.resolveAtpData(did)
      return data.signingKey
    }
  }

  async verifySignature(
    did: string,
    data: Uint8Array,
    sig: Uint8Array,
  ): Promise<boolean> {
    const signingKey = await this.resolveSigningKey(did)
    return crypto.verifySignature(signingKey, data, sig)
  }
}

export const resolver = new DidResolver()

export class NoResolveDidError extends Error {}
