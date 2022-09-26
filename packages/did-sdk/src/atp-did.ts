import { DIDDocument } from 'did-resolver'

export type AtpData = {
  did: string
  signingKey: string
  recoveryKey: string
  username: string
  atpPds: string
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

  // @TODO convert this to did:key
  return found.publicKeyMultibase
}

export const getUsername = (doc: DIDDocument): string | undefined => {
  const aka = doc.alsoKnownAs
  if (!aka) return undefined
  if (typeof aka === 'string') return aka
  if (Array.isArray(aka) && typeof aka[0] === 'string') {
    return aka[0]
  }
  return undefined
}

export const getAtpPds = (doc: DIDDocument): string | undefined => {
  let services = doc.service
  if (!services) return undefined
  if (typeof services !== 'object') return undefined
  if (!Array.isArray(services)) {
    services = [services]
  }
  const found = services.find(
    (service) => service.type === 'AtpPersonalDataServer',
  )
  if (!found) return undefined
  if (typeof found.serviceEndpoint === 'string') {
    return found.serviceEndpoint
  } else if (
    Array.isArray(found.serviceEndpoint) &&
    typeof found.serviceEndpoint[0] === 'string'
  ) {
    return found.serviceEndpoint[0]
  } else {
    return undefined
  }
}

export const parseToAtpDocument = (doc: DIDDocument): Partial<AtpData> => {
  const did = getDid(doc)
  return {
    did,
    signingKey: getKey(doc, '#signingKey'),
    recoveryKey: getKey(doc, '#recoveryKey'),
    username: getUsername(doc),
    atpPds: getAtpPds(doc),
  }
}

export const ensureAtpDocument = (doc: DIDDocument): AtpData => {
  const { did, signingKey, recoveryKey, username, atpPds } =
    parseToAtpDocument(doc)
  if (!did) {
    throw new Error(`Could not parse id from doc: ${doc}`)
  }
  if (!signingKey) {
    throw new Error(`Could not parse signingKey from doc: ${doc}`)
  }
  if (!recoveryKey) {
    throw new Error(`Could not parse recoveryKey from doc: ${doc}`)
  }
  if (!username) {
    throw new Error(`Could not parse username from doc: ${doc}`)
  }
  if (!atpPds) {
    throw new Error(`Could not parse atpPds from doc: ${doc}`)
  }
  return { did, signingKey, recoveryKey, username, atpPds }
}
