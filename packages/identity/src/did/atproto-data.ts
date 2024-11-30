import * as crypto from '@atproto/crypto'
import { DidDocument, AtprotoData } from '../types'
import {
  getDid,
  getHandle,
  getPdsEndpoint,
  getFeedGenEndpoint,
  getNotifEndpoint,
  getSigningKey,
} from '@atproto/common-web'

export {
  getDid,
  getHandle,
  getPdsEndpoint as getPds,
  getFeedGenEndpoint as getFeedGen,
  getNotifEndpoint as getNotif,
}

export const getKey = (doc: DidDocument): string | undefined => {
  const key = getSigningKey(doc)
  if (!key) return undefined
  return getDidKeyFromMultibase(key)
}

export const getDidKeyFromMultibase = (key: {
  type: string
  publicKeyMultibase: string
}): string | undefined => {
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
    signingKey: getKey(doc),
    handle: getHandle(doc),
    pds: getPdsEndpoint(doc),
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

export const ensureAtprotoKey = (doc: DidDocument): string => {
  const { signingKey } = parseToAtprotoDocument(doc)
  if (!signingKey) {
    throw new Error(`Could not parse signingKey from doc: ${doc}`)
  }
  return signingKey
}
