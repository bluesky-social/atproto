import * as crypto from '@atproto/crypto'
import { DidDocument, AtprotoData } from '../types'

export const getDid = (doc: DidDocument): string => {
  const id = doc.id
  if (typeof id !== 'string') {
    throw new Error('No `id` on document')
  }
  return id
}

export const getKey = (doc: DidDocument): string | undefined => {
  let keys = doc.verificationMethod
  if (!keys) return undefined
  if (typeof keys !== 'object') return undefined
  if (!Array.isArray(keys)) {
    keys = [keys]
  }
  const found = keys.find((key) => key.id === '#atproto')
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

export const getHandle = (doc: DidDocument): string | undefined => {
  const aka = doc.alsoKnownAs
  if (!aka) return undefined
  const found = aka.find((name) => name.startsWith('at://'))
  if (!found) return undefined
  // strip off at:// prefix
  return found.slice(5)
}

export const getPds = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#atproto_pds',
    type: 'AtprotoPersonalDataServer',
  })
}

export const getFeedGen = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#bsky_fg',
    type: 'BskyFeedGenerator',
  })
}

export const getNotif = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#bsky_notif',
    type: 'BskyNotificationService',
  })
}

export const parseToAtprotoDocument = (
  doc: DidDocument,
): Partial<AtprotoData> => {
  const did = getDid(doc)
  return {
    did,
    signingKey: getKey(doc),
    handle: getHandle(doc),
    pds: getPds(doc),
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

// Check protocol and hostname to prevent potential SSRF
const validateUrl = (url: string) => {
  const { hostname, protocol } = new URL(url)
  if (!['http:', 'https:'].includes(protocol)) {
    throw new Error('Invalid pds protocol')
  }
  if (!hostname) {
    throw new Error('Invalid pds hostname')
  }
}

const getServiceEndpoint = (
  doc: DidDocument,
  opts: { id: string; type: string },
) => {
  let services = doc.service
  if (!services) return undefined
  if (typeof services !== 'object') return undefined
  if (!Array.isArray(services)) {
    services = [services]
  }
  const found = services.find((service) => service.id === opts.id)
  if (!found) return undefined
  if (found.type !== opts.type) {
    return undefined
  }
  if (typeof found.serviceEndpoint !== 'string') {
    return undefined
  }
  validateUrl(found.serviceEndpoint)
  return found.serviceEndpoint
}
