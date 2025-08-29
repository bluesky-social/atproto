import { z } from 'zod'
import { InvalidDidError } from './did-error.js'
import { Did } from './did.js'
import { isFragment } from './lib/uri.js'
import {
  DID_PLC_PREFIX,
  DID_WEB_PREFIX,
  assertDidPlc,
  assertDidWeb,
  isDidPlc,
  isDidWeb,
} from './methods.js'

// This file contains atproto-specific DID validation utilities.

export type AtprotoIdentityDidMethods = 'plc' | 'web'
export type AtprotoDid = Did<AtprotoIdentityDidMethods>

export const atprotoDidSchema = z
  .string()
  .refine(isAtprotoDid, `Atproto only allows "plc" and "web" DID methods`)

export function isAtprotoDid(input: unknown): input is AtprotoDid {
  // Optimized equivalent of:
  // return isDidPlc(input) || isAtprotoDidWeb(input)

  if (typeof input !== 'string') {
    return false
  } else if (input.startsWith(DID_PLC_PREFIX)) {
    return isDidPlc(input)
  } else if (input.startsWith(DID_WEB_PREFIX)) {
    return isAtprotoDidWeb(input)
  } else {
    return false
  }
}

export function asAtprotoDid(input: unknown): AtprotoDid {
  assertAtprotoDid(input)
  return input
}

export function assertAtprotoDid(input: unknown): asserts input is AtprotoDid {
  if (typeof input !== 'string') {
    throw new InvalidDidError(typeof input, `DID must be a string`)
  } else if (input.startsWith(DID_PLC_PREFIX)) {
    assertDidPlc(input)
  } else if (input.startsWith(DID_WEB_PREFIX)) {
    assertAtprotoDidWeb(input)
  } else {
    throw new InvalidDidError(
      input,
      `Atproto only allows "plc" and "web" DID methods`,
    )
  }
}

export function assertAtprotoDidWeb(
  input: unknown,
): asserts input is Did<'web'> {
  assertDidWeb(input)

  if (isDidWebWithPath(input)) {
    throw new InvalidDidError(
      input,
      `Atproto does not allow path components in Web DIDs`,
    )
  }

  if (isDidWebWithHttpsPort(input)) {
    throw new InvalidDidError(
      input,
      `Atproto does not allow port numbers in Web DIDs, except for localhost`,
    )
  }
}

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export function isAtprotoDidWeb(input: unknown): input is Did<'web'> {
  if (!isDidWeb(input)) {
    return false
  }

  if (isDidWebWithPath(input)) {
    return false
  }

  if (isDidWebWithHttpsPort(input)) {
    return false
  }

  return true
}

function isDidWebWithPath(did: Did<'web'>): boolean {
  return did.includes(':', DID_WEB_PREFIX.length)
}

function isLocalhostDid(did: Did<'web'>): boolean {
  return (
    did === 'did:web:localhost' ||
    did.startsWith('did:web:localhost:') ||
    did.startsWith('did:web:localhost%3A')
  )
}

function isDidWebWithHttpsPort(did: Did<'web'>): boolean {
  if (isLocalhostDid(did)) return false

  const pathIdx = did.indexOf(':', DID_WEB_PREFIX.length)

  const hasPort =
    pathIdx === -1
      ? // No path component, check if there's a port separator anywhere after
        // the "did:web:" prefix
        did.includes('%3A', DID_WEB_PREFIX.length)
      : // There is a path component; if there is an encoded colon *before* it,
        // then there is a port number
        did.lastIndexOf('%3A', pathIdx) !== -1

  return hasPort
}

export type AtprotoAudience = `${AtprotoDid}#${string}`
export const isAtprotoAudience = (value: unknown): value is AtprotoAudience => {
  if (typeof value !== 'string') return false
  const hashIndex = value.indexOf('#')
  if (hashIndex === -1) return false
  if (value.indexOf('#', hashIndex + 1) !== -1) return false
  return (
    isFragment(value, hashIndex + 1) && isAtprotoDid(value.slice(0, hashIndex))
  )
}
