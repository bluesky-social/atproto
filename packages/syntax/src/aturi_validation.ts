import { AtIdentifierString, ensureValidAtIdentifier } from './at-identifier.js'
import { ensureValidDidRegex } from './did.js'
import { ensureValidHandleRegex } from './handle.js'
import { NsidString, isValidNsid } from './nsid.js'

export type AtUriString =
  | `at://${AtIdentifierString}`
  | `at://${AtIdentifierString}/${NsidString}`
  | `at://${AtIdentifierString}/${NsidString}/${string}`

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

export function ensureValidAtUri(input: string): asserts input is AtUriString {
  const fragmentIndex = input.indexOf('#')
  if (fragmentIndex !== -1) {
    if (input.charCodeAt(fragmentIndex + 1) !== 47) {
      throw new Error('ATURI fragment must be non-empty and start with slash')
    }
    if (input.includes('#', fragmentIndex + 1)) {
      throw new Error('ATURI can have at most one "#", separating fragment out')
    }

    // NOTE: enforcing *some* checks here for sanity. Eg, at least no whitespace
    const fragment = input.slice(fragmentIndex + 1)
    if (!/^\/[a-zA-Z0-9._~:@!$&')(*+,;=%[\]/-]*$/.test(fragment)) {
      throw new Error('Disallowed characters in ATURI fragment (ASCII)')
    }
  }

  const uri = fragmentIndex === -1 ? input : input.slice(0, fragmentIndex)

  if (uri.length > 8 * 1024) {
    throw new Error('ATURI is far too long')
  }

  if (!uri.startsWith('at://')) {
    throw new Error('ATURI must start with "at://"')
  }

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9._~:@!$&')(*+,;=%/-]*$/.test(uri)) {
    throw new Error('Disallowed characters in ATURI (ASCII)')
  }

  const authorityEnd = uri.indexOf('/', 5)
  const authority =
    authorityEnd === -1 ? uri.slice(5) : uri.slice(5, authorityEnd)
  try {
    ensureValidAtIdentifier(authority)
  } catch (cause) {
    throw new Error('ATURI authority must be a valid handle or DID', { cause })
  }

  const collectionStart = authorityEnd === -1 ? -1 : authorityEnd + 1
  const collectionEnd =
    collectionStart === -1 ? -1 : uri.indexOf('/', collectionStart)

  if (collectionStart !== -1) {
    const collection =
      collectionEnd === -1
        ? uri.slice(collectionStart)
        : uri.slice(collectionStart, collectionEnd)

    if (collection.length === 0) {
      throw new Error(
        'ATURI can not have a slash after authority without a path segment',
      )
    }
    if (!isValidNsid(collection)) {
      throw new Error(
        'ATURI requires first path segment (if supplied) to be valid NSID',
      )
    }
  }

  const recordKeyStart = collectionEnd === -1 ? -1 : collectionEnd + 1
  const recordKeyEnd =
    recordKeyStart === -1 ? -1 : uri.indexOf('/', recordKeyStart)

  if (recordKeyStart !== -1) {
    if (recordKeyStart === uri.length) {
      throw new Error(
        'ATURI can not have a slash after collection, unless record key is provided',
      )
    }
    // would validate rkey here, but there are basically no constraints!
  }

  if (recordKeyEnd !== -1) {
    throw new Error(
      'ATURI path can have at most two parts, and no trailing slash',
    )
  }
}

export function ensureValidAtUriRegex(uri: string): asserts uri is AtUriString {
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

  if (groups.collection && !isValidNsid(groups.collection)) {
    throw new Error('ATURI collection path segment must be a valid NSID')
  }

  if (uri.length > 8 * 1024) {
    throw new Error('ATURI is far too long')
  }
}
