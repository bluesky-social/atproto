import * as crypto from '@atproto/crypto'
import { DidDocument, AtprotoData } from '../types'
import {
  getDid,
  getHandle,
  getPdsEndpoint,
  getSigningKey,
} from '@atproto/common-web'

export const parseKey = (doc: DidDocument): string | undefined => {
  const key = getSigningKey(doc)
  if (!key) return undefined

  const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
  let didKey: string | undefined = undefined
  if (key.type === 'EcdsaSecp256r1VerificationKey2019') {
    didKey = crypto.formatDidKey(crypto.P256_JWT_ALG, keyBytes)
  } else if (key.type === 'EcdsaSecp256k1VerificationKey2019') {
    didKey = crypto.formatDidKey(crypto.SECP256K1_JWT_ALG, keyBytes)
  } else if (key.type === 'Multikey') {
    const parsed = crypto.parseMultikey(key.publicKeyMultibase)
    didKey = crypto.formatDidKey(parsed.jwtAlg, parsed.keyBytes)
  }
  return didKey
}

export const parseToAtprotoDocument = (
  doc: DidDocument,
): Partial<AtprotoData> => {
  const did = getDid(doc)
  return {
    did,
    signingKey: parseKey(doc),
    handle: getHandle(doc),
    pds: getPdsEndpoint(doc)?.toString(),
  }
}

export const ensureAtpDocument = (doc: DidDocument): AtprotoData => {
  const { did, signingKey, handle, pds } = parseToAtprotoDocument(doc)
  if (!did) {
    throw new Error(`Could not parse id from doc: ${doc}`)
  }
  if (!signingKey) {
    throw new Error(`Could not parse signingKey from doc: ${doc}`)
  }
  if (!handle) {
    throw new Error(`Could not parse handle from doc: ${doc}`)
  }
  if (!pds) {
    throw new Error(`Could not parse pds from doc: ${doc}`)
  }
  return { did, signingKey, handle, pds }
}
