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
  isValidAtIdentifier as isValidAtId,
  isValidAtUri,
  isValidDatetime,
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

/**
 * Type guard that checks if a value is a valid AT identifier (DID or handle).
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid AT identifier
 */
export const isAtIdentifierString: CheckFn<AtIdentifierString> = isValidAtId
export type {
  /**
   * An AT identifier string - either a DID or a handle.
   *
   * @example `"did:plc:1234..."` or `"alice.bsky.social"`
   */
  AtIdentifierString,
}

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
 * Type guard that checks if a value is a valid datetime string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid datetime string
 */
export const isDatetimeString: CheckFn<DatetimeString> = isValidDatetime
export type {
  /**
   * An ISO 8601 datetime string.
   *
   * @example `"2024-01-15T12:30:00.000Z"`
   */
  DatetimeString,
}

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
  readonly [K in StringFormat]: CheckFn<StringFormats[K]>
} = /*#__PURE__*/ Object.freeze({
  __proto__: null,

  'at-identifier': isAtIdentifierString,
  'at-uri': isAtUriString,
  cid: isCidString,
  datetime: isDatetimeString,
  did: isDidString,
  handle: isHandleString,
  language: isLanguageString,
  nsid: isNsidString,
  'record-key': isRecordKeyString,
  tid: isTidString,
  uri: isUriString,
})

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
): input is I & StringFormats[F] {
  const formatVerifier = stringFormatVerifiers[format]
  // Fool-proof
  if (!formatVerifier) throw new TypeError(`Unknown string format: ${format}`)

  return formatVerifier(input)
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
): asserts input is I & StringFormats[F] {
  if (!isStringFormat(input, format)) {
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
): I & StringFormats[F] {
  assertStringFormat(input, format)
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
): undefined | (I & StringFormats[F]) {
  return isStringFormat(input, format) ? input : undefined
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
