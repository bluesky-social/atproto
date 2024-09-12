import { z } from 'zod'

// Parsing atproto data
// --------

export const isValidDidDoc = (doc: unknown): doc is DidDocument => {
  return didDocument.safeParse(doc).success
}

export const getDid = (doc: DidDocument): string => {
  const id = doc.id
  if (typeof id !== 'string') {
    throw new Error('No `id` on document')
  }
  return id
}

export const getHandle = (doc: DidDocument): string | undefined => {
  const aka = doc.alsoKnownAs
  if (!aka) return undefined
  const found = aka.find((name) => name.startsWith('at://'))
  if (!found) return undefined
  // strip off at:// prefix
  return found.slice(5)
}

// @NOTE we parse to type/publicKeyMultibase to avoid the dependency on @atproto/crypto
export const getSigningKey = (
  doc: DidDocument,
): { type: string; publicKeyMultibase: string } | undefined => {
  return getVerificationMaterial(doc, 'atproto')
}

export const getVerificationMaterial = (
  doc: DidDocument,
  keyId: string,
): { type: string; publicKeyMultibase: string } | undefined => {
  const did = getDid(doc)
  let keys = doc.verificationMethod
  if (!keys) return undefined
  if (typeof keys !== 'object') return undefined
  if (!Array.isArray(keys)) {
    keys = [keys]
  }
  const found = keys.find(
    (key) => key.id === `#${keyId}` || key.id === `${did}#${keyId}`,
  )
  if (!found?.publicKeyMultibase) return undefined
  return {
    type: found.type,
    publicKeyMultibase: found.publicKeyMultibase,
  }
}

export const getSigningDidKey = (doc: DidDocument): string | undefined => {
  const parsed = getSigningKey(doc)
  if (!parsed) return
  return `did:key:${parsed.publicKeyMultibase}`
}

export const getPdsEndpoint = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#atproto_pds',
    type: 'AtprotoPersonalDataServer',
  })
}

export const getFeedGenEndpoint = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#bsky_fg',
    type: 'BskyFeedGenerator',
  })
}

export const getNotifEndpoint = (doc: DidDocument): string | undefined => {
  return getServiceEndpoint(doc, {
    id: '#bsky_notif',
    type: 'BskyNotificationService',
  })
}

export const getServiceEndpoint = (
  doc: DidDocument,
  opts: { id: string; type?: string },
) => {
  // /!\ Hot path

  // Throws if no id (hence this statement being first)
  const did = getDid(doc)

  const services = doc.service
  if (!services) return undefined

  // Using for loop instead of .find() as an optimization
  for (let i = 0; i < services.length; i++) {
    const service = services[i]
    if (
      service.id === opts.id ||
      // Optimized version of: service.id === `${did}${opts.id}`
      (service.id.length === did.length + opts.id.length &&
        service.id.startsWith(did) &&
        service.id.endsWith(opts.id))
    ) {
      if (opts.type && service.type !== opts.type) {
        return undefined
      }
      if (typeof service.serviceEndpoint !== 'string') {
        return undefined
      }
      return validateUrl(service.serviceEndpoint)
    }
  }

  return undefined
}

// Check protocol and hostname to prevent potential SSRF
const validateUrl = (urlStr: string): string | undefined => {
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    return undefined
  }

  try {
    const url = new URL(urlStr)

    if (!url.hostname) {
      return undefined
    }

    return urlStr
  } catch {
    return undefined
  }
}

// Types
// --------

const verificationMethod = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyMultibase: z.string().optional(),
})

const service = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.union([z.string(), z.record(z.unknown())]),
})

export const didDocument = z.object({
  id: z.string(),
  alsoKnownAs: z.array(z.string()).optional(),
  verificationMethod: z.array(verificationMethod).optional(),
  service: z.array(service).optional(),
})

export type DidDocument = z.infer<typeof didDocument>
