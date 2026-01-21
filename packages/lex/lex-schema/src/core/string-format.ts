import { isLanguageString, validateCidString } from '@atproto/lex-data'
import {
  AtIdentifierString,
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
  NsidString,
  RecordKeyString,
  TidString,
  isValidAtIdentifier,
  isValidAtUri,
  isValidDatetime,
  isValidDid,
  isValidHandle,
  isValidNsid,
  isValidRecordKey,
  isValidTid,
} from '@atproto/syntax'
import { CheckFn } from '../util/assertion-util.js'

// Format utilities missing from @atproto/syntax
export type CidString = string
export type LanguageString = string
export type UriString = `${string}:${string}`

/*@__NO_SIDE_EFFECTS__*/
export function isUriString<T extends string>(
  input: T,
): input is T & UriString {
  return /^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)
}

// Re-export utility typed as assertion functions so that TypeScript can
// infer the narrowed type after calling them.

export type {
  AtIdentifierString,
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
  NsidString,
  RecordKeyString,
  TidString,
} from '@atproto/syntax'

// Export utilities for formats missing from @atproto/syntax

export { isLanguageString }
export const isAtIdentifierString: CheckFn<AtIdentifierString> =
  isValidAtIdentifier
export const isAtUriString: CheckFn<AtUriString> = isValidAtUri
export const isCidString: CheckFn<CidString> = <I extends string>(
  input: I,
): input is I & CidString => validateCidString(input)
export const isDatetimeString: CheckFn<DatetimeString> = isValidDatetime
export const isDidString: CheckFn<DidString> = isValidDid
export const isHandleString: CheckFn<HandleString> = isValidHandle
export const isNsidString: CheckFn<NsidString> = isValidNsid
export const isRecordKeyString: CheckFn<RecordKeyString> = isValidRecordKey
export const isTidString: CheckFn<TidString> = isValidTid

// String formatting types and utilities

export const STRING_FORMATS = Object.freeze([
  'datetime',
  'uri',
  'at-uri',
  'did',
  'handle',
  'at-identifier',
  'nsid',
  'cid',
  'language',
  'tid',
  'record-key',
] as const)

export type StringFormat = (typeof STRING_FORMATS)[number]

export type InferStringFormat<F> =
  //
  F extends 'datetime'
    ? DatetimeString
    : F extends 'uri'
      ? UriString
      : F extends 'at-uri'
        ? AtUriString
        : F extends 'did'
          ? DidString
          : F extends 'handle'
            ? HandleString
            : F extends 'at-identifier'
              ? AtIdentifierString
              : F extends 'nsid'
                ? NsidString
                : // LanguageString | CidString | TidString | RecordKeyString
                  string

const checkers = /*#__PURE__*/ Object.freeze<
  Record<StringFormat, (str: string) => boolean>
>({
  // @ts-expect-error
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

/*@__NO_SIDE_EFFECTS__*/
export function checkStringFormat<I extends string, F extends StringFormat>(
  input: I,
  format: F,
): input is I & InferStringFormat<F> {
  const checkFn = checkers[format]
  // Fool-proof
  if (!checkFn) throw new TypeError(`Unknown string format: ${format}`)

  return checkFn(input)
}
