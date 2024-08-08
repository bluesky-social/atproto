import { InvalidDidError } from './did-error.js'
import { Did } from './did.js'
import {
  checkDidPlc,
  checkDidWeb,
  DID_PLC_PREFIX,
  DID_WEB_PREFIX,
  isDidPlc,
  isDidWeb,
} from './methods.js'

// This file contains atproto-specific DID validation utilities.

export type AtprotoIdentityDidMethods = 'plc' | 'web'
export type AtprotoDid = Did<AtprotoIdentityDidMethods>

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
  checkAtprotoDid(input)
  return input
}

export function checkAtprotoDid(input: unknown): asserts input is AtprotoDid {
  if (typeof input !== 'string') {
    throw new InvalidDidError(typeof input, `DID must be a string`)
  } else if (input.startsWith(DID_PLC_PREFIX)) {
    checkDidPlc(input)
  } else if (input.startsWith(DID_WEB_PREFIX)) {
    checkDidWeb(input)
  } else {
    throw new InvalidDidError(
      input,
      `Atproto only allows "plc" and "web" DID methods`,
    )
  }
}

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export function isAtprotoDidWeb(input: unknown): input is Did<'web'> {
  // Optimization: make cheap checks first
  if (typeof input !== 'string') {
    return false
  }

  // Path are not allowed
  if (input.includes(':', DID_WEB_PREFIX.length)) {
    return false
  }

  // Port numbers are not allowed, except for localhost
  if (
    input.includes('%3A', DID_WEB_PREFIX.length) &&
    !input.startsWith('did:web:localhost%3A')
  ) {
    return false
  }

  return isDidWeb(input)
}
