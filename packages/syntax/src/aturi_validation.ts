import { AtIdentifierString, isAtIdentifierString } from './at-identifier.js'
import { Result, failure, success } from './lib/result.js'
import { NsidString, isValidNsid } from './nsid.js'
import { isValidRecordKey } from './recordkey.js'

export type AtUriStringBase =
  | `at://${AtIdentifierString}`
  | `at://${AtIdentifierString}/${NsidString}`
  | `at://${AtIdentifierString}/${NsidString}/${string}`

export type AtUriStringFragment = `#/${string}`

/**
 * A URI string as used to point at resources in the AT protocol
 *
 * AT URI strings must respect the following syntax (as prescribed by the AT
 * protocol specification):
 *
 * - must start with "at://"
 * - the entire value is ASCII: [a-zA-Z0-9._~:@!$&'()*+,;=%/\\[\]#?-]
 * - hard length limit of 8192 chars (imposed by AT protocol)
 * - the authority part must be a valid DID or handle (validated by {@link isAtIdentifierString})
 * - optionally, the authority can be followed by a "/" and a valid NSID (validated by {@link isValidNsid})
 * - optionally, if an NSID is given, it can be followed by "/" and a record key (which can be any non-empty string of allowed chars)
 * - optionally, the URI can have a fragment, which must start with "#/" and then follow JSON pointer syntax (RFC-6901), but with the allowed chars above instead of full UTF-8
 * - query string ("?") is allowed, but not used
 * - percent-encoding is allowed an must be valid (e.g. "%FF" is not valid, but "%20" is)
 *
 * @example "at://did:plc:1234.../app.bsky.feed.post/3k2..."
 *
 * @see {@link https://atproto.com/specs/at-uri-scheme AT protocol -- AT URI Scheme}
 */
export type AtUriString =
  | AtUriStringBase
  | `${AtUriStringBase}${AtUriStringFragment}`

const INVALID_CHAR_REGEXP = /[^a-zA-Z0-9._~:@!$&'()*+,;=%/\\[\]#?-]/

// Regexp based on the constraints above (without the length constraint,
// authority and collection validation)
const AT_URI_REGEXP =
  /^(?<uri>at:\/\/(?<authority>[^/?#\s]+)(?:\/(?<collection>[^/?#\s]+)(?:\/(?<rkey>[^/?#\s]+))?)?(?<trailingSlash>\/)?)(?:\?(?<query>[^#\s]*))?(?:#(?<hash>[^\s]*))?$/

/**
 * Type guard that checks if a value is a valid {@link AtUriString}
 *
 * @see {@link AtUriString}
 */
export function isAtUriString<I>(
  input: I,
  options?: Omit<ParseUriStringOptions, 'detailed'>,
): input is I & AtUriString {
  return parseUriString(input, options).success
}

/**
 * Returns the input if it is a valid {@link AtUriString} format string, or
 * `undefined` if it is not.
 *
 * @see {@link AtUriString}
 */
export function ifAtUriString<I>(
  input: I,
  options?: Omit<ParseUriStringOptions, 'detailed'>,
): undefined | (I & AtUriString) {
  return isAtUriString(input, options) ? input : undefined
}

/**
 * Casts a string to an {@link AtUriString} if it is a valid AT URI format
 * string, throwing an error if it is not.
 *
 * @throws InvalidAtUriError if the input string does not meet the atproto AT URI format requirements.
 * @see {@link AtUriString}
 */
export function asAtUriString<I>(
  input: I,
  options?: ParseUriStringOptions,
): I & AtUriString {
  assertAtUriString(input, options)
  return input
}

/**
 * Assert the validity of an {@link AtUriString}, throwing an error if the
 * {@link input} is not a valid AT URI.
 *
 * @throws InvalidAtUriError if the {@link input} is not a valid {@link AtUriString}
 */
export function assertAtUriString<I>(
  input: I,
  options?: ParseUriStringOptions,
): asserts input is I & AtUriString {
  // Optimistically use faster isAtUriString(), throwing a detailed error only
  // in case of failure. This check, and the fact that the code after it always
  // throws, also ensures that isAtUriString() and assertAtUriString()'s
  // behavior are always consistent.
  const result = parseUriString(input, options)
  if (!result.success) {
    throw new InvalidAtUriError(result.message)
  }
}

/**
 * Assert the **non-strict** validity of an {@link AtUriString}, throwing a
 * detailed error if the {@link input} is not a valid AT URI.
 *
 * @throws InvalidAtUriError if the {@link input} is not a valid {@link AtUriString}
 * @deprecated use {@link assertAtUriString} with `{ strict: false }` option instead
 */
export function ensureValidAtUri<I>(
  input: I,
): asserts input is I & AtUriString {
  assertAtUriString(input, { strict: false, detailed: true })
}

/**
 * Assert the (non-strict!) validity of an {@link AtUriString}, throwing an
 * error if the {@link input} is not a valid AT URI.
 *
 * @throws InvalidAtUriError if the {@link input} is not a valid {@link AtUriString}
 * @deprecated use {@link assertAtUriString} with `{ strict: false }` option instead
 */
export function ensureValidAtUriRegex<I>(
  input: I,
): asserts input is I & AtUriString {
  assertAtUriString(input, { strict: false, detailed: false })
}

/**
 * Type guard that checks if a value is a valid {@link AtUriString} format
 * string, without enforcing strict record key validation. This is useful for
 * cases where you want to allow a wider range of valid ATURIs, such as when
 * validating user input or when the record key is not relevant.
 *
 * @deprecated use {@link isAtUriString} with `{ strict: false }` option instead
 */
export function isValidAtUri<I>(input: I): input is I & AtUriString {
  return isAtUriString(input, { strict: false })
}

export class InvalidAtUriError extends Error {}

export type ParseUriStringOptions = {
  /**
   * If true, the parser will enforce that the record key (rkey) part of the URI
   * is a valid record key (validated by {@link isValidRecordKey}). If false,
   * any non-empty string of allowed chars will be accepted as a record key.
   *
   * @default true
   */
  strict?: boolean

  /**
   * If true, the parser will return detailed error messages for why a string is
   * not a valid AT URI. This option has no effect on the behavior of
   * {@link isAtUriString}, which will always return false for invalid strings
   * regardless of this option.
   *
   * @default false
   */
  detailed?: boolean
}

export type AtUriParts = {
  authority: AtIdentifierString
  query?: string
  hash?: string
} & (
  | { collection?: NsidString; rkey?: undefined }
  | { collection: NsidString; rkey?: string }
)

/**
 * Parses a valid {@link AtUriString} into a {@link AtUriParts} object, or
 * returns a failure with a detailed error message if the string is not a valid
 * {@link AtUriString}.
 */
export function parseUriString(
  input: unknown,
  options?: ParseUriStringOptions,
): Result<AtUriParts> {
  if (typeof input !== 'string') {
    return failure('ATURI must be a string')
  }

  if (input.length > 8192) {
    return failure('ATURI exceeds maximum length')
  }

  const invalidChar = input.match(INVALID_CHAR_REGEXP)
  if (invalidChar) {
    return failure(
      `ATURI contains invalid character "${invalidChar[0]}" at position ${invalidChar.index}`,
    )
  }

  const match = input.match(AT_URI_REGEXP)
  const groups = match?.groups
  if (!groups) {
    // Regex validation failed, but we don't know exactly why. Provide more
    // detailed error messages if the "detailed" option is set, falling back to
    // a generic error.
    if (options?.detailed) {
      if (!input.startsWith('at://')) {
        return failure('ATURI must start with "at://"')
      }

      if (input.includes(' ')) {
        return failure('ATURI can not contain spaces')
      }

      const fragmentIndex = input.indexOf('#')
      const pathEnd = fragmentIndex !== -1 ? fragmentIndex : input.length
      if (input.charAt(pathEnd - 1) === '/') {
        return failure('ATURI can not have a trailing slash')
      }

      if (input.includes('//', 5)) {
        return failure('ATURI can not have empty path segments')
      }

      const pathStart = input.indexOf('/', 5) // after "at://"
      if (pathStart !== -1) {
        const secondSlash = input.indexOf('/', pathStart + 1)
        if (secondSlash !== -1 && secondSlash !== pathEnd - 1) {
          return failure('ATURI can not have more than two path segments')
        }
      }
    }

    return failure('ATURI does not match expected format')
  }

  // @NOTE Percent-encoding is allowed by the AT URI specification, but any
  // percent-encoded characters appearing in the collection NSID or record key
  // will effectively be rejected by the isValidNsid and isValidRecordKey
  // validators. Since these values are defined to be plain ASCII identifiers,
  // this legacy behavior is beneficial: it ensures that already-normalized,
  // non-percent-encoded values are always used.

  if (!isAtIdentifierString(groups.authority)) {
    return failure('ATURI has invalid authority')
  }

  if (groups.collection != null && !isValidNsid(groups.collection)) {
    return failure('ATURI has invalid collection')
  }

  if (groups.hash != null) {
    const result = parseJsonPointer(groups.hash, options)
    if (result.success) {
      groups.hash = result.value
    } else {
      return failure(`ATURI has invalid fragment (${result.message})`)
    }
  }

  if (options?.strict !== false) {
    if (groups.trailingSlash != null) {
      return failure('ATURI can not have a trailing slash')
    }

    if (groups.rkey != null && !isValidRecordKey(groups.rkey)) {
      return failure('ATURI has invalid record key')
    }
  }

  return success(groups as AtUriParts)
}

const BASIC_JSON_POINTER_REGEXP = /^\/[a-zA-Z0-9._~:@!$&')(*+,;=%[\]/-]*$/

/**
 * Checks if a string is a valid JSON pointer (RFC-6901) with the allowed chars
 * for ATURI fragments. This is a very loose validation that only checks the
 * basic syntax and charset.
 */
function parseJsonPointer(
  value: string,
  options?: { strict?: boolean },
): Result<string> {
  if (!BASIC_JSON_POINTER_REGEXP.test(value)) {
    return failure('Invalid JSON pointer')
  }

  const result = parsePercentEncoding(value)

  // In non-strict mode, we allow invalid percent-encoding in the fragment
  if (!result.success && options?.strict === false) {
    return success(value)
  }

  return result
}

function parsePercentEncoding(value: string): Result<string> {
  try {
    return success(decodeURIComponent(value))
  } catch {
    // decodeURIComponent throws if the percent-encoding is invalid (e.g. "%FF")
    return failure('Invalid percent-encoding')
  }
}
