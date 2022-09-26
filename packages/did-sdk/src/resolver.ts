import {
  Resolver,
  DIDResolver,
  DIDDocument,
  parse,
  DIDResolutionOptions,
  DIDResolutionResult,
} from 'did-resolver'
import * as web from './web/resolver'
import * as plc from './plc/resolver'
import * as atpDid from './atp-did'

export const resolver = new Resolver({
  plc: plc.resolve,
  web: web.resolve,
})

export const resolveDid = (
  did: string,
  options: DIDResolutionOptions = {},
): Promise<DIDResolutionResult> => {
  return resolver.resolve(did, options)
}

export const ensureResolveDid = async (
  did: string,
  options: DIDResolutionOptions = {},
): Promise<DIDDocument> => {
  const result = await resolveDid(did, options)
  if (result.didResolutionMetadata.error || result.didDocument === null) {
    // @TODO better error handling
    throw new Error('Could not resolve did')
  }
  return result.didDocument
}

export const resolveAtpDid = async (
  did: string,
): Promise<atpDid.DocumentData> => {
  const didDocument = await ensureResolveDid(did)
  return atpDid.ensureAtpDocument(didDocument)
}
