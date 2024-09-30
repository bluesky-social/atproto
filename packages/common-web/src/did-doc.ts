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
  if (aka) {
    for (let i = 0; i < aka.length; i++) {
      const alias = aka[i]
      if (alias.startsWith('at://')) {
        // strip off "at://" prefix
        return alias.slice(5)
      }
    }
  }
  return undefined
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
  // /!\ Hot path

  const key = findItemById(doc, 'verificationMethod', `#${keyId}`)
  if (!key) {
    return undefined
  }

  if (!key.publicKeyMultibase) {
    return undefined
  }

  return {
    type: key.type,
    publicKeyMultibase: key.publicKeyMultibase,
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

  const service = findItemById(doc, 'service', opts.id)
  if (!service) {
    return undefined
  }

  if (opts.type && service.type !== opts.type) {
    return undefined
  }

  if (typeof service.serviceEndpoint !== 'string') {
    return undefined
  }

  return validateUrl(service.serviceEndpoint)
}

function findItemById<
  D extends DidDocument,
  T extends 'verificationMethod' | 'service',
>(doc: D, type: T, id: string): NonNullable<D[T]>[number] | undefined
function findItemById(
  doc: DidDocument,
  type: 'verificationMethod' | 'service',
  id: string,
) {
  // /!\ Hot path

  const items = doc[type]
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const itemId = item.id

      if (
        itemId[0] === '#'
          ? itemId === id
          : // Optimized version of: itemId === `${doc.id}${id}`
            itemId.length === doc.id.length + id.length &&
            itemId[doc.id.length] === '#' &&
            itemId.endsWith(id) &&
            itemId.startsWith(doc.id) // <== We could probably skip this check
      ) {
        return item
      }
    }
  }
  return undefined
}

// Check protocol and hostname to prevent potential SSRF
const validateUrl = (urlStr: string): string | undefined => {
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    return undefined
  }

  if (!canParseUrl(urlStr)) {
    return undefined
  }

  return urlStr
}

const canParseUrl =
  URL.canParse ??
  // URL.canParse is not available in Node.js < 18.17.0
  ((urlStr: string): boolean => {
    try {
      new URL(urlStr)
      return true
    } catch {
      return false
    }
  })

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
