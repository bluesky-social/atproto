import { ensureValidHandle, ensureValidHandleRegex } from './handle'
import { ensureValidDid, ensureValidDidRegex } from './did'
import { ensureValidNsid, ensureValidNsidRegex } from './nsid'

// Human-readable constraints on ATURI:
//   - following regular URLs, a 8KByte hard total length limit
//   - follows ATURI docs on website
//      - all ASCII characters, no whitespace. non-ASCII could be URL-encoded
//      - starts "at://"
//      - "authority" is a valid DID or a valid handle
//      - optionally, follow "authority" with "/" and valid NSID as start of path
//      - optionally, if NSID given, follow that with "/" and rkey
//      - rkey path component can include URL-encoded ("percent encoded"), or:
//          ALPHA / DIGIT / "-" / "." / "_" / "~" / ":" / "@" / "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
//          [a-zA-Z0-9._~:@!$&'\(\)*+,;=-]
//      - rkey must have at least one char
//      - regardless of path component, a fragment can follow  as "#" and then a JSON pointer (RFC-6901)
export const ensureValidAtUri = (uri: string) => {
  // JSON pointer is pretty different from rest of URI, so split that out first
  const uriParts = uri.split('#')
  if (uriParts.length > 2) {
    throw new Error('ATURI can have at most one "#", separating fragment out')
  }
  const fragmentPart = uriParts[1] || null
  uri = uriParts[0]

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9._~:@!$&')(*+,;=%/-]*$/.test(uri)) {
    throw new Error('Disallowed characters in ATURI (ASCII)')
  }

  const parts = uri.split('/')
  if (parts.length >= 3 && (parts[0] != 'at:' || parts[1].length != 0)) {
    throw new Error('ATURI must start with "at://"')
  }
  if (parts.length < 3) {
    throw new Error('ATURI requires at least method and authority sections')
  }

  try {
    if (parts[2].startsWith('did:')) {
      ensureValidDid(parts[2])
    } else {
      ensureValidHandle(parts[2])
    }
  } catch {
    throw new Error('ATURI authority must be a valid handle or DID')
  }

  if (parts.length >= 4) {
    if (parts[3].length == 0) {
      throw new Error(
        'ATURI can not have a slash after authority without a path segment',
      )
    }
    try {
      ensureValidNsid(parts[3])
    } catch {
      throw new Error(
        'ATURI requires first path segment (if supplied) to be valid NSID',
      )
    }
  }

  if (parts.length >= 5) {
    if (parts[4].length == 0) {
      throw new Error(
        'ATURI can not have a slash after collection, unless record key is provided',
      )
    }
    // would validate rkey here, but there are basically no constraints!
  }

  if (parts.length >= 6) {
    throw new Error(
      'ATURI path can have at most two parts, and no trailing slash',
    )
  }

  if (uriParts.length >= 2 && fragmentPart == null) {
    throw new Error('ATURI fragment must be non-empty and start with slash')
  }

  if (fragmentPart != null) {
    if (fragmentPart.length == 0 || fragmentPart[0] != '/') {
      throw new Error('ATURI fragment must be non-empty and start with slash')
    }
    // NOTE: enforcing *some* checks here for sanity. Eg, at least no whitespace
    if (!/^\/[a-zA-Z0-9._~:@!$&')(*+,;=%[\]/-]*$/.test(fragmentPart)) {
      throw new Error('Disallowed characters in ATURI fragment (ASCII)')
    }
  }

  if (uri.length > 8 * 1024) {
    throw new Error('ATURI is far too long')
  }
}

export const ensureValidAtUriRegex = (uri: string): void => {
  // simple regex to enforce most constraints via just regex and length.
  // hand wrote this regex based on above constraints. whew!
  const aturiRegex =
    /^at:\/\/(?<authority>[a-zA-Z0-9._:%-]+)(\/(?<collection>[a-zA-Z0-9-.]+)(\/(?<rkey>[a-zA-Z0-9._~:@!$&%')(*+,;=-]+))?)?(#(?<fragment>\/[a-zA-Z0-9._~:@!$&%')(*+,;=\-[\]/\\]*))?$/
  const rm = uri.match(aturiRegex)
  if (!rm || !rm.groups) {
    throw new Error("ATURI didn't validate via regex")
  }
  const groups = rm.groups

  try {
    ensureValidHandleRegex(groups.authority)
  } catch {
    try {
      ensureValidDidRegex(groups.authority)
    } catch {
      throw new Error('ATURI authority must be a valid handle or DID')
    }
  }

  if (groups.collection) {
    try {
      ensureValidNsidRegex(groups.collection)
    } catch {
      throw new Error('ATURI collection path segment must be a valid NSID')
    }
  }

  if (uri.length > 8 * 1024) {
    throw new Error('ATURI is far too long')
  }
}
