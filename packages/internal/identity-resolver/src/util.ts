import {
  AtprotoIdentityDidMethods,
  DidDocument,
} from '@atproto-labs/did-resolver'

/**
 * Extract the raw, un-validated, Atproto handle from a DID document.
 */
export function extractAtprotoHandle(
  document: DidDocument<AtprotoIdentityDidMethods>,
): string | undefined {
  if (document.alsoKnownAs) {
    for (const h of document.alsoKnownAs) {
      if (h.startsWith('at://')) {
        // strip off "at://" prefix
        return h.slice(5)
      }
    }
  }
  return undefined
}

/**
 * Extracts a validated, normalized Atproto handle from a DID document.
 */
export function extractNormalizedHandle(
  document: DidDocument<AtprotoIdentityDidMethods>,
): string | undefined {
  const handle = extractAtprotoHandle(document)
  if (!handle) return undefined
  return asNormalizedHandle(handle)
}

export function asNormalizedHandle(input: string): string | undefined {
  const handle = normalizeHandle(input)
  return isValidHandle(handle) ? handle : undefined
}

export function normalizeHandle(handle: string): string {
  return handle.toLowerCase()
}

export function isValidHandle(handle: string): boolean {
  return (
    handle.length > 0 &&
    handle.length < 254 &&
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(
      handle,
    )
  )
}
