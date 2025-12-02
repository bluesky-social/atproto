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

const rfc3986UriNormalized = z.string().refine((input) => {
  try {
    return input.includes(':') && new URL(input).href === input
  } catch {
    return false
  }
}, 'RFC3986 URI (normalized)')

const didUrl = z.string().refine((input): boolean => {
  try {
    // Same-document references are valid DID URLs
    if (
      input.startsWith('#') ||
      input.startsWith('?') ||
      input.startsWith('/')
    ) {
      new URL(input, 'http://example.com')
      return true
    } else {
      const url = new URL(input)
      return (
        url.protocol === 'did:' &&
        !url.hostname &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.pathname.startsWith('/') // URL parses the method-specific-id as pathname
      )
    }
  } catch {
    return false
  }
})

const verificationMethod = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyJwk: z.record(z.string(), z.unknown()).optional(),
  publicKeyMultibase: z.string().optional(),
})

const service = z.object({
  // @NOTE we don't enforce RFC3986 format on the "id" for legacy reasons
  id: z.string(),
  type: z.string(),
  /**
   * > The value of the serviceEndpoint property MUST be a string, a map, or a
   * > set composed of one or more strings and/or maps. All string values MUST
   * > be valid URIs conforming to [RFC3986] and normalized according to the
   * > Normalization and Comparison rules in RFC3986 and to any normalization
   * > rules in its applicable URI scheme specification.
   */
  serviceEndpoint: z.union([
    // @NOTE We don't enforce URI (or normalization) for string and maps here
    // for legacy reasons.
    z.string(),
    z.record(z.string(), z.string()),

    z
      .array(
        z.union([
          rfc3986UriNormalized,
          z.record(z.string(), rfc3986UriNormalized),
        ]),
      )
      .nonempty(),
  ]),
})

const verificationRelationship = z.union([verificationMethod, didUrl])
const verificationRelationships = z.array(verificationRelationship).optional()

export const didDocument = z.object({
  id: z.string(),
  alsoKnownAs: z.array(z.string()).optional(),
  verificationMethod: z.array(verificationMethod).optional(),
  service: z.array(service).optional(),
  authentication: verificationRelationships,
  assertionMethod: verificationRelationships,
  keyAgreement: verificationRelationships,
  capabilityInvocation: verificationRelationships,
  capabilityDelegation: verificationRelationships,
})

export type DidDocument = z.infer<typeof didDocument>
