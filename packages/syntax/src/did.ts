/**
 * A DID identifier string as used in AT protocol
 *
 * DID identifiers must respect the following constraints (as prescribed by
 * DID-core, and the AT protocol specification):
 *
 * - entire value is ASCII: [a-zA-Z0-9._:%-]
 * - always starts "did:" (lower-case)
 * - method name is one or more lower-case letters, followed by ":"
 * - remaining identifier can have any of the above chars, but can not end in ":"
 * - it seems that a bunch of ":" can be included, and don't need spaces between
 * - "%" is used only for "percent encoding" and must be followed by two hex characters
 * - query ("?") and fragment ("#") stuff is defined for "DID URIs", but not as part of identifier itself
 * - hard length limit of 2048 chars (imposed by AT protocol)
 *
 * @note Current AT protocol specification only allows `did:plc` and `did:web`
 * methods. But this is not enforced at when checking Lexicon strings. This
 * implementation does *not* enforce method specific constraints, it only
 * ensures that the syntax is valid according to the AT protocol specification.
 *
 * @note This implementation allows lower case hex digits when they are strictly
 * disallowed by DID-core
 *
 * @example "did:plc:7iza6de2dwap2sbkpav7c6c6"
 * @example "did:onion:2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid"
 * @example "did:example:123456789abcdefghi"
 * @example "did:web:example.com"
 * @example "did:web:localhost%3A1234"
 * @example "did:key:zQ3shZc2QzApp2oymGvQbzP8eKheVshBHbU4ZYjeXqwSKEn6N"
 * @example "did:ethr:0xb9c5714089478a327f09197987f16f9e5d936e8a"
 *
 * @see {@link https://www.w3.org/TR/did-core/#did-syntax DID-core}
 * @see {@link https://atproto.com/specs/did#did-identifier-syntax AT protocol -- DID Identifier Syntax}
 */
export type DidString<M extends string = string> = `did:${M}:${string}`

// Regexp manually written based on the constraints above (note that the length,
// and ":" end char are not enforced by this regexp)
const DID_STRING_REGEX =
  /^did:[a-z]+(?::(?:%[a-fA-F0-9]{2}|[a-zA-Z0-9._-]+)*)+$/

/**
 * Checks if a string is a valid {@link DidString} format string.
 *
 * @see {@link DidString}
 */
export function isDidString<I>(input: I): input is I & DidString {
  // Hot path: regex based validation seems to be the most efficient way of
  // validating DidString on NodeJS 25
  return (
    typeof input === 'string' &&
    input.length <= 2048 &&
    input.charCodeAt(input.length - 1) !== 0x3a && // faster than .endsWith(':')
    DID_STRING_REGEX.test(input)
  )
}

/**
 * Casts a string to a {@link DidString} if it is a valid DID identifier format
 * string, throwing an error if it is not.
 *
 * @throws InvalidDidError if the input string does not meet the atproto 'did' format requirements.
 * @see {@link DidString}
 */
export function asDidString<I>(input: I): I & DidString {
  if (isDidString(input)) return input
  throw new InvalidDidError(`Invalid DID "${String(input)}`)
}

/**
 * Returns the input if it is a valid {@link DidString} format string, or
 * `undefined` if it is not.
 *
 * @see {@link DidString}
 */
export function ifDidString<I>(input: I): undefined | (I & DidString) {
  return isDidString(input) ? input : undefined
}

/**
 * Assert the validity of a {@link DidString}, throwing a detailed error if the
 * {@link input} if not a valid DID identifier.
 *
 * @throws InvalidDidError if the {@link input} is not a valid {@link DidString}
 */
export function assertDidString<I>(input: I): asserts input is I & DidString {
  // Optimistically use faster isDidString(), throwing a detailed error only in
  // case of failure.
  // This check, and the fact that the code after it always throws, also ensures
  // that isDidString() and assertDidString()'s behavior are always consistent.
  if (isDidString(input)) return

  if (typeof input !== 'string') {
    throw new InvalidDidError('DID must be a string')
  }

  if (!input.startsWith('did:')) {
    throw new InvalidDidError('DID requires "did:" prefix')
  }

  if (input.length > 2048) {
    throw new InvalidDidError('DID is too long (2048 chars max)')
  }

  if (input.endsWith(':')) {
    throw new InvalidDidError('DID can not end with ":"')
  }

  // check that all chars are boring ASCII
  if (!/^[a-zA-Z0-9._:%-]*$/.test(input)) {
    throw new InvalidDidError(
      'Disallowed characters in DID (ASCII letters, digits, and a couple other characters only)',
    )
  }

  const { length, 1: method } = input.split(':')
  if (length < 3) {
    throw new InvalidDidError(
      'DID requires prefix, method, and method-specific content',
    )
  }

  if (!/^[a-z]+$/.test(method)) {
    throw new InvalidDidError('DID method must be lower-case letters')
  }

  // Anything else is an invalid percent encoding error
  throw new InvalidDidError('DID must properly percent encode values')
}

// Legacy exports (should we deprecate these ?)
export {
  assertDidString as ensureValidDid,
  assertDidString as ensureValidDidRegex,
  isDidString as isValidDid,
}

export class InvalidDidError extends Error {}
