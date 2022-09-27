import {
  Resolver,
  DIDDocument,
  DIDResolutionOptions,
  DIDResolutionResult,
} from 'did-resolver'
import * as web from './web/resolver'
import * as plc from './plc/resolver'
import * as atpDid from './atp-did'

export type DidResolverOptions = {
  timeout: number
  plcUrl: string
}

export class DidResolver {
  resolver: Resolver
  constructor(opts: Partial<DidResolverOptions> = {}) {
    // @TODO change to production url
    const { timeout = 3000, plcUrl = 'localhost:2582' } = opts
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
    return this.resolver.resolve(did, options)
  }

  async ensureResolveDid(
    did: string,
    options: DIDResolutionOptions = {},
  ): Promise<DIDDocument> {
    const result = await this.resolveDid(did, options)
    if (result.didResolutionMetadata.error || result.didDocument === null) {
      let err = result.didResolutionMetadata.error || 'notFound'
      throw new Error(`Could not resolve DID (${did}): ${err}`)
    }
    return result.didDocument
  }

  async resolveAtpData(did: string): Promise<atpDid.AtpData> {
    const didDocument = await this.ensureResolveDid(did)
    return atpDid.ensureAtpDocument(didDocument)
  }
}

export const resolver = new DidResolver()
