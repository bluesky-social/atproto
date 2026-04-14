import { isValidISODateString } from 'iso-datestring-validator'
import { validateCidString } from '@atproto/lex-data'
import {
  AtIdentifierString,
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
  NsidString,
  RecordKeyString,
  TidString,
  UriString,
  isAtIdentifierString,
  isDatetimeString,
  isValidAtUri,
  isValidDid,
  isValidHandle,
  isValidLanguage,
  isValidNsid,
  isValidRecordKey,
  isValidTid,
  isValidUri,
} from '@atproto/syntax'
import { CheckFn } from '../util/assertion-util.js'

// -----------------------------------------------------------------------------
// Individual string format types and type guards
// -----------------------------------------------------------------------------

// Re-exporting from @atproto/syntax without modification to preserve types and
// documentation for types and utilities that are already well-defined there.
// @TODO rework other string formats in @atproto/syntax to follow this pattern
// and re-export here, e.g. language tags, NSIDs, record keys, etc.

export {
  type AtIdentifierString,
  asAtIdentifierString,
  ifAtIdentifierString,
  isAtIdentifierString,
} from '@atproto/syntax'

// AtIdentifierString utilities
export { isDidIdentifier, isHandleIdentifier } from '@atproto/syntax'

export {
  type DatetimeString,
  asDatetimeString,
  ifDatetimeString,
  isDatetimeString,
} from '@atproto/syntax'

/**
 * Matches any ISO-ish datetime string. This is a more lenient check than
 * the strict {@link isDatetimeString} guard, which only allows datetimes that
 * fully conform to the AT Protocol specification (e.g. must include timezone).
 */
export function isDatetimeStringLoose<I>(
  input: I,
): input is I & DatetimeString {
  // @NOTE the returned type assertion is inaccurate wrt. the DatetimeString
  // type definition. A more accurate solution would be to use a branded type
  // instead of a template literal for the "datetime" format
  if (typeof input !== 'string') return false
  try {
    return isValidISODateString(input)
  } catch {
    // @NOTE isValidISODateString throws on some inputs
    return false
  }
}

// DatetimeString utilities
export { currentDatetimeString, toDatetimeString } from '@atproto/syntax'

/**
 * Type guard that checks if a value is a valid AT URI.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid AT URI
 */
export const isAtUriString: CheckFn<AtUriString> = isValidAtUri
export type {
  /**
   * An AT URI string pointing to a resource in the AT Protocol network.
   *
   * @example `"at://did:plc:1234.../app.bsky.feed.post/3k2..."`
   */
  AtUriString,
}

/**
 * Type guard that checks if a value is a valid CID string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid CID string
 */
export const isCidString = ((v) => validateCidString(v)) as CheckFn<CidString>
/**
 * A Content Identifier (CID) string.
 *
 * CIDs are self-describing content addresses used to identify data by its hash.
 *
 * @example `"bafyreig..."`
 */
export type CidString = string

/**
 * Type guard that checks if a value is a valid DID string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid DID string
 */
export const isDidString: CheckFn<DidString> = isValidDid
export type {
  /**
   * A Decentralized Identifier (DID) string.
   *
   * DIDs are globally unique identifiers that don't require a central authority.
   *
   * @example `"did:plc:1234abcd..."` or `"did:web:example.com"`
   */
  DidString,
}

/**
 * Type guard that checks if a value is a valid handle string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid handle string
 */
export const isHandleString: CheckFn<HandleString> = isValidHandle
export type {
  /**
   * A handle string - a human-readable identifier for users.
   *
   * @example `"alice.bsky.social"` or `"bob.example.com"`
   */
  HandleString,
}

/**
 * Type guard that checks if a value is a valid BCP-47 language tag.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid language string
 */
export const isLanguageString = isValidLanguage as CheckFn<LanguageString>
/**
 * A BCP-47 language tag string.
 *
 * @example `"en"`, `"en-US"`, `"zh-Hans"`
 */
export type LanguageString = string

/**
 * Type guard that checks if a value is a valid NSID string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid NSID string
 */
export const isNsidString: CheckFn<NsidString> = isValidNsid
export type {
  /**
   * A Namespaced Identifier (NSID) string identifying a lexicon.
   *
   * NSIDs use reverse-domain notation to identify schemas.
   *
   * @example `"app.bsky.feed.post"`, `"com.atproto.repo.createRecord"`
   */
  NsidString,
}

/**
 * Type guard that checks if a value is a valid record key string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid record key string
 */
export const isRecordKeyString: CheckFn<RecordKeyString> = isValidRecordKey
export type {
  /**
   * A record key string identifying a record within a collection.
   *
   * @example `"3k2..."` (TID format) or `"self"` (literal key)
   */
  RecordKeyString,
}

/**
 * Type guard that checks if a value is a valid TID string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid TID string
 */
export const isTidString: CheckFn<TidString> = isValidTid
export type {
  /**
   * A Timestamp Identifier (TID) string.
   *
   * TIDs are time-based identifiers used for record keys.
   *
   * @example `"3k2..."`
   */
  TidString,
}

/**
 * Type guard that checks if a value is a valid URI string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid URI string
 */
export const isUriString: CheckFn<UriString> = isValidUri
export type {
  /**
   * A standard URI string.
   *
   * @example `"https://example.com/path"`
   */
  UriString,
}

// -----------------------------------------------------------------------------
// String format registry
// -----------------------------------------------------------------------------

type StringFormats = {
  'at-identifier': AtIdentifierString
  'at-uri': AtUriString
  cid: CidString
  datetime: DatetimeString
  did: DidString
  handle: HandleString
  language: LanguageString
  nsid: NsidString
  'record-key': RecordKeyString
  tid: TidString
  uri: UriString
}

/**
 * Union type of all valid string format names.
 */
export type StringFormat = Extract<keyof StringFormats, string>

const stringFormatVerifiers: {
  readonly [K in StringFormat]: readonly [
    strict: CheckFn<StringFormats[K]>,
    loose?: CheckFn<StringFormats[K]>,
  ]
} = /*#__PURE__*/ Object.freeze({
  __proto__: null,

  'at-identifier': [isAtIdentifierString],
  'at-uri': [isAtUriString],
  cid: [isCidString],
  datetime: [isDatetimeString, isDatetimeStringLoose],
  did: [isDidString],
  handle: [isHandleString],
  language: [isLanguageString],
  nsid: [isNsidString],
  'record-key': [isRecordKeyString],
  tid: [isTidString],
  uri: [isUriString],
})

export type StringFormatValidationOptions = {
  /**
   * Allows to be more lenient in validation by using a "loose" verification
   * function, if available. The behavior of the loose verifier depends on the
   * specific format, but generally it may allow for a wider range of valid
   * inputs, including values that are not compliant with the AT Protocol
   * specification.
   *
   * @default true
   */
  strict?: boolean
}

/**
 * Infers the string type for a given format name.
 *
 * @typeParam F - The format name
 *
 * @example
 * ```typescript
 * type Did = InferStringFormat<'did'>
 * // Result: DidString
 * ```
 */
export type InferStringFormat<F extends StringFormat> = F extends StringFormat
  ? StringFormats[F]
  : never

/**
 * Type guard that checks if a string matches a specific format.
 *
 * @typeParam I - The input string type
 * @typeParam F - The format to check
 * @param input - The string to validate
 * @param format - The format name to validate against
 * @returns `true` if the string matches the format
 *
 * @example
 * ```typescript
 * const value: string = 'did:plc:1234...'
 * if (isStringFormat(value, 'did')) {
 *   // value is typed as DidString
 *   console.log('Valid DID:', value)
 * }
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function isStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
  options?: StringFormatValidationOptions,
): input is I & StringFormats[F] {
  const formatVerifier = stringFormatVerifiers[format]
  // Fool-proof
  if (!formatVerifier) throw new TypeError(`Unknown string format: ${format}`)

  const check: CheckFn<StringFormats[F]> =
    options?.strict === false
      ? formatVerifier[1] ?? formatVerifier[0]
      : formatVerifier[0]

  return check(input)
}

/**
 * Asserts that a string matches a specific format, throwing if invalid.
 *
 * @typeParam I - The input string type
 * @typeParam F - The format to check
 * @param input - The string to validate
 * @param format - The format name to validate against
 * @throws {TypeError} If the string doesn't match the format
 *
 * @example
 * ```typescript
 * assertStringFormat(value, 'handle')
 * // value is now typed as HandleString
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function assertStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
  options?: StringFormatValidationOptions,
): asserts input is I & StringFormats[F] {
  if (!isStringFormat(input, format, options)) {
    throw new TypeError(`Invalid string format (${format}): ${input}`)
  }
}

/**
 * Validates and returns a string as the specified format type, throwing if invalid.
 *
 * This is useful when you need to convert a string to a format type in an expression.
 *
 * @typeParam I - The input string type
 * @typeParam F - The format to validate against
 * @param input - The string to validate
 * @param format - The format name to validate against
 * @returns The input typed as the format type
 * @throws {TypeError} If the string doesn't match the format
 *
 * @example
 * ```typescript
 * const did = asStringFormat(userInput, 'did')
 * // did is typed as DidString
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function asStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
  options?: StringFormatValidationOptions,
): I & StringFormats[F] {
  assertStringFormat(input, format, options)
  return input
}

/**
 * Returns the string as the format type if valid, otherwise returns `undefined`.
 *
 * This is useful for optional validation where you want to handle invalid values
 * without throwing.
 *
 * @typeParam I - The input string type
 * @typeParam F - The format to validate against
 * @param input - The string to validate
 * @param format - The format name to validate against
 * @returns The typed string if valid, otherwise `undefined`
 *
 * @example
 * ```typescript
 * const did = ifStringFormat(maybeInvalid, 'did')
 * if (did) {
 *   // did is typed as DidString
 * }
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function ifStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
  options?: StringFormatValidationOptions,
): undefined | (I & StringFormats[F]) {
  return isStringFormat(input, format, options) ? input : undefined
}

/**
 * Array of all valid string format names.
 *
 * @example
 * ```typescript
 * for (const format of STRING_FORMATS) {
 *   console.log(format) // 'at-identifier', 'at-uri', 'cid', ...
 * }
 * ```
 */
export const STRING_FORMATS = /*#__PURE__*/ Object.freeze(
  /*#__PURE__*/ Object.keys(stringFormatVerifiers),
) as readonly StringFormat[]
