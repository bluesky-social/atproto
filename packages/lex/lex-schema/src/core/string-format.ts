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

// Expose all individual string format types and type guards

export type { AtIdentifierString }
export const isAtIdentifierString: CheckFn<AtIdentifierString> = isValidAtId

export type { AtUriString }
export const isAtUriString: CheckFn<AtUriString> = isValidAtUri

export type CidString = string
export const isCidString = ((v) => validateCidString(v)) as CheckFn<CidString>

export type { DatetimeString }
export const isDatetimeString: CheckFn<DatetimeString> = isValidDatetime

export type { DidString }
export const isDidString: CheckFn<DidString> = isValidDid

export type { HandleString }
export const isHandleString: CheckFn<HandleString> = isValidHandle

export type LanguageString = string
export const isLanguageString = isValidLanguage as CheckFn<LanguageString>

export type { NsidString }
export const isNsidString: CheckFn<NsidString> = isValidNsid

export type { RecordKeyString }
export const isRecordKeyString: CheckFn<RecordKeyString> = isValidRecordKey

export type { TidString }
export const isTidString: CheckFn<TidString> = isValidTid

export type { UriString }
export const isUriString: CheckFn<UriString> = isValidUri

// String format registry (maps format names to their types and type guards)

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

export type InferStringFormat<F extends StringFormat> = F extends StringFormat
  ? StringFormats[F]
  : never

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

/*@__NO_SIDE_EFFECTS__*/
export function assertStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
): asserts input is I & StringFormats[F] {
  if (!isStringFormat(input, format)) {
    throw new TypeError(`Invalid string format (${format}): ${input}`)
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function asStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
): I & StringFormats[F] {
  assertStringFormat(input, format)
  return input
}

/*@__NO_SIDE_EFFECTS__*/
export function ifStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
): undefined | (I & StringFormats[F]) {
  return isStringFormat(input, format) ? input : undefined
}

export const STRING_FORMATS = /*#__PURE__*/ Object.freeze(
  /*#__PURE__*/ Object.keys(stringFormatVerifiers),
) as readonly StringFormat[]
