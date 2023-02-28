import { DIDDocument } from 'did-resolver'
import * as crypto from '@atproto/crypto'

export type AtprotoData = {
  did: string
  signingKey: string
  recoveryKey: string
  handle: string
  pds: string
}

export const getDid = (doc: DIDDocument): string => {
  const id = doc.id
  if (typeof id !== 'string') {
    throw new Error('No `id` on document')
  }
  return id
}

export const getKey = (doc: DIDDocument, id: string): string | undefined => {
  let keys = doc.verificationMethod
  if (!keys) return undefined
  if (typeof keys !== 'object') return undefined
  if (!Array.isArray(keys)) {
    keys = [keys]
  }
  const found = keys.find((key) => key.id === id)
  if (!found) return undefined

  // @TODO support jwk
  // should we be surfacing errors here or returning undefined?
  if (!found.publicKeyMultibase) return undefined
  const keyBytes = crypto.multibaseToBytes(found.publicKeyMultibase)
  let didKey: string | undefined = undefined
  if (found.type === 'EcdsaSecp256r1VerificationKey2019') {
    didKey = crypto.formatDidKey(crypto.P256_JWT_ALG, keyBytes)
  } else if (found.type === 'EcdsaSecp256k1VerificationKey2019') {
    didKey = crypto.formatDidKey(crypto.SECP256K1_JWT_ALG, keyBytes)
  }
  return didKey
}

export const getHandle = (doc: DIDDocument): string | undefined => {
  const aka = doc.alsoKnownAs
  if (!aka) return undefined
  return aka.find((name) => name.startsWith('at://'))
}

export const getPds = (doc: DIDDocument): string | undefined => {
  let services = doc.service
  if (!services) return undefined
  if (typeof services !== 'object') return undefined
  if (!Array.isArray(services)) {
    services = [services]
  }
  const found = services.find((service) => service.id === '#atproto-pds')
  if (!found) return undefined
  if (found.type !== 'AtprotoPersonalDataServer') {
    return undefined
  }
  if (typeof found.serviceEndpoint === 'string') {
    return found.serviceEndpoint
  }
  return undefined
}

export const parseToAtprotoDocument = (
  doc: DIDDocument,
): Partial<AtprotoData> => {
  const did = getDid(doc)
  return {
    did,
    signingKey: getKey(doc, '#signingKey'),
    handle: getHandle(doc),
    pds: getPds(doc),
  }
}

export const ensureAtpDocument = (doc: DIDDocument): AtprotoData => {
  const { did, signingKey, recoveryKey, handle, pds } =
    parseToAtprotoDocument(doc)
  if (!did) {
    throw new Error(`Could not parse id from doc: ${doc}`)
  }
  if (!signingKey) {
    throw new Error(`Could not parse signingKey from doc: ${doc}`)
  }
  if (!recoveryKey) {
    throw new Error(`Could not parse recoveryKey from doc: ${doc}`)
  }
  if (!handle) {
    throw new Error(`Could not parse handle from doc: ${doc}`)
  }
  if (!pds) {
    throw new Error(`Could not parse atpPds from doc: ${doc}`)
  }
  return { did, signingKey, recoveryKey, handle, pds }
}
