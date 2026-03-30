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
 * A URI string as used to point at resources in the AT Protocol
 *
 * The full, general structure of an AT URI is:
 *
 * ```bnf
 * AT-URI = "at://" AUTHORITY [ PATH ] [ "?" QUERY ] [ "#" FRAGMENT ]
 * ```
 *
 * The authority part of the URI can be either a handle or a DID, indicating the
 * identity associated with the repository. In current atproto Lexicon use, the
 * query and fragment parts are not yet supported, and only a fixed pattern of
 * paths are allowed:
 *
 * ```bnf
 * AT-URI     = "at://" AUTHORITY [ "/" COLLECTION [ "/" RKEY ] ]
 *
 * AUTHORITY  = HANDLE | DID
 * COLLECTION = NSID
 * RKEY       = RECORD-KEY
 * ```
 *
 * The authority section is required, and should be normalized.
 *
 * AT URI strings must respect the following syntax (as prescribed by the AT
 * protocol specification):
 *
 * - The overall URI is restricted to a subset of ASCII characters
 * - For reference below, the set of unreserved characters, as defined in [RFC-3986](https://www.rfc-editor.org/rfc/rfc3986), includes alphanumeric (`A-Za-z0-9`), period, hyphen, underscore, and tilde (`.-_~`)
 * - Maximum overall length is 8 kilobytes (which may be shortened in the future)
 * - Hex-encoding of characters is permitted (but in practice not necessary and should be avoided to keep the URI normalized and human-readable)
 * - The URI scheme is `at`, and an authority part preceded with double slashes is always required. AT URIs always start with `at://`.
 * - An authority section is required and must be non-empty. the authority can be either an atproto Handle, or a DID meeting the restrictions for use with atproto. The authority part can *not* be interpreted as a host:port pair, because of the use of colon characters (`:`) in DIDs. Colons and unreserved characters should not be escaped in DIDs, but other reserved characters (including `#`, `/`, `$`, `&`, `@`) must be escaped.
 *     - Note that none of the current "blessed" DID methods for atproto allow these characters in DID identifiers
 * - An optional path section may follow the authority. The path may contain multiple segments separated by a single slash (`/`). Generic URI path normalization rules may be used.
 * - An optional query part is allowed, following generic URI syntax restrictions
 * - An optional fragment part is allowed, using JSON Path syntax
 *
 * @example "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.actor.profile/self"
 *
 * @see {@link https://atproto.com/specs/at-uri-scheme AT protocol - AT URI Scheme}
 */
export type AtUriString =
  | AtUriStringBase
  | `${AtUriStringBase}${AtUriStringFragment}`

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

const INVALID_CHAR_REGEXP = /[^a-zA-Z0-9._~:@!$&'()*+,;=%/\\[\]#?-]/
const AT_URI_REGEXP =
  /^(?<uri>at:\/\/(?<authority>[^/?#\s]+)(?:\/(?<collection>[^/?#\s]+)(?:\/(?<rkey>[^/?#\s]+))?)?(?<trailingSlash>\/)?)(?:\?(?<query>[^#\s]*))?(?:#(?<hash>[^\s]*))?$/

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

      if (input.includes('//', 5)) {
        return failure('ATURI can not have empty path segments')
      }

      const pathStart = input.indexOf('/', 5) // after "at://"
      if (pathStart !== -1) {
        const fragmentIndex = input.indexOf('#')
        const pathEnd = fragmentIndex !== -1 ? fragmentIndex : input.length
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
  // this legacy behavior is beneficial: it ensures that normalized
  // (non-percent-encoded) values are always used, as prescribed by the spec.

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
