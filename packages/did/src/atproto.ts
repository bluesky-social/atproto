import { z } from 'zod'
import { InvalidDidError } from './did-error.js'
import { Did } from './did.js'
import {
  DID_PLC_PREFIX,
  DID_WEB_PREFIX,
  assertDidPlc,
  assertDidWeb,
  isDidPlc,
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

  if (input.includes(':', DID_WEB_PREFIX.length)) {
    throw new InvalidDidError(
      input,
      `Atproto does not allow path components in Web DIDs`,
    )
  }

  if (
    input.includes('%3A', DID_WEB_PREFIX.length) &&
    !input.startsWith('did:web:localhost%3A')
  ) {
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
  try {
    assertAtprotoDidWeb(input)
    return true
  } catch {
    return false
  }
}
