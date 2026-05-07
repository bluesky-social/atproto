import { DidString, ensureValidDidRegex, isValidDid } from './did.js'
import {
  HandleString,
  InvalidHandleError,
  ensureValidHandleRegex,
  isValidHandle,
} from './handle.js'

/**
 * An "at-identifier" string - either a {@link DidString} or a {@link HandleString}
 *
 * @example `"did:plc:1234..."`, `"did:web:example.com"` or `"alice.bsky.social"`
 */
export type AtIdentifierString = DidString | HandleString

/**
 * Discriminates {@link HandleString} from a valid {@link AtIdentifierString}.
 *
 * @return `true` if the identifier is a handle, `false` otherwise
 */
export function isHandleIdentifier(id: AtIdentifierString): id is HandleString {
  return !isDidIdentifier(id)
}

/**
 * Discriminates {@link DidString} from a valid {@link AtIdentifierString}.
 *
 * @return `true` if the identifier is a DID, `false` otherwise
 */
export function isDidIdentifier(id: AtIdentifierString): id is DidString {
  return id.startsWith('did:')
}

/**
 * Validates that a string is a valid {@link AtIdentifierString} format string,
 * throwing an error if it is not.
 *
 * @throws InvalidHandleError if the input string does not meet the atproto 'datetime' format requirements.
 * @see {@link AtIdentifierString}
 */
export function assertAtIdentifierString<I>(
  input: I,
): asserts input is I & AtIdentifierString {
  try {
    if (!input || typeof input !== 'string') {
      throw new TypeError('Identifier must be a non-empty string')
    } else if (input.startsWith('did:')) {
      ensureValidDidRegex(input)
    } else {
      ensureValidHandleRegex(input)
    }
  } catch (cause) {
    throw new InvalidHandleError('Invalid DID or handle', { cause })
  }
}

/**
 * Casts a string to a {@link AtIdentifierString} if it is a valid at-identifier
 * string, throwing an error if it is not.
 *
 * @throws InvalidHandleError if the input string does not meet the atproto 'at-identifier' format requirements.
 * @see {@link AtIdentifierString}
 */
export function asAtIdentifierString<I>(input: I): I & AtIdentifierString {
  assertAtIdentifierString(input)
  return input
}

/**
 * Type guard that checks if a value is a valid AT identifier (DID or handle).
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid AT identifier
 * @see {@link AtIdentifierString}
 */
export function isAtIdentifierString<I>(
  input: I,
): input is I & AtIdentifierString {
  if (!input || typeof input !== 'string') {
    return false
  } else if (input.startsWith('did:')) {
    return isValidDid(input)
  } else {
    return isValidHandle(input)
  }
}

/**
 * Returns the input if it is a valid {@link AtIdentifierString} format string, or
 * `undefined` if it is not.
 *
 * @see {@link AtIdentifierString}
 */
export function ifAtIdentifierString<I>(
  input: I,
): undefined | (I & AtIdentifierString) {
  return isAtIdentifierString(input) ? input : undefined
}

// Legacy exports (should we deprecate these ?)
export {
  assertAtIdentifierString as ensureValidAtIdentifier,
  isAtIdentifierString as isValidAtIdentifier,
}
