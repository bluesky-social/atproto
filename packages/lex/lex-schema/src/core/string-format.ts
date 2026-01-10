import { ensureValidCidString, isLanguageString } from '@atproto/lex-data'
import {
  AtIdentifierString,
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
  NsidString,
  RecordKeyString,
  TidString,
  ensureValidAtIdentifier,
  ensureValidAtUri,
  ensureValidDatetime,
  ensureValidDid,
  ensureValidHandle,
  ensureValidNsid,
  ensureValidRecordKey,
  ensureValidTid,
} from '@atproto/syntax'
import {
  AssertFn,
  CastFn,
  CheckFn,
  createAssertFunction,
  createCastFunction,
  createCheckFunction,
} from '../util/assertion-util.js'

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

export const assertAtIdentifierString: AssertFn<AtIdentifierString> =
  ensureValidAtIdentifier
export const assertAtUriString: AssertFn<AtUriString> = ensureValidAtUri
export const assertCidString: AssertFn<CidString> = ensureValidCidString
export const assertDatetimeString: AssertFn<DatetimeString> =
  ensureValidDatetime
export const assertDidString: AssertFn<DidString> = ensureValidDid
export const assertHandleString: AssertFn<HandleString> = ensureValidHandle
export const assertLanguageString: AssertFn<LanguageString> =
  createAssertFunction<LanguageString>(
    isLanguageString,
    'Invalid BCP 47 string',
  )
export const assertNsidString: AssertFn<NsidString> = ensureValidNsid
export const assertRecordKeyString: AssertFn<RecordKeyString> =
  ensureValidRecordKey
export const assertTidString: AssertFn<TidString> = ensureValidTid
export const assertUriString: AssertFn<UriString> =
  createAssertFunction<UriString>(isUriString, 'Invalid URI')

export const asAtIdentifierString: CastFn<AtIdentifierString> =
  /*#__PURE__*/ createCastFunction(assertAtIdentifierString)
export const asAtUriString: CastFn<AtUriString> =
  /*#__PURE__*/ createCastFunction(ensureValidAtUri)
export const asCidString: CastFn<CidString> =
  /*#__PURE__*/ createCastFunction(ensureValidCidString)
export const asDatetimeString: CastFn<DatetimeString> =
  /*#__PURE__*/ createCastFunction(ensureValidDatetime)
export const asDidString: CastFn<DidString> =
  /*#__PURE__*/ createCastFunction(ensureValidDid)
export const asHandleString: CastFn<HandleString> =
  /*#__PURE__*/ createCastFunction(ensureValidHandle)
export const asLanguageString: CastFn<LanguageString> =
  /*#__PURE__*/ createCastFunction(assertLanguageString)
export const asNsidString: CastFn<NsidString> =
  /*#__PURE__*/ createCastFunction(ensureValidNsid)
export const asRecordKeyString: CastFn<RecordKeyString> =
  /*#__PURE__*/ createCastFunction(ensureValidRecordKey)
export const asTidString: CastFn<TidString> =
  /*#__PURE__*/ createCastFunction(ensureValidTid)
export const asUriString: CastFn<UriString> =
  /*#__PURE__*/ createCastFunction(assertUriString)

export { isLanguageString }
export const isAtIdentifierString: CheckFn<AtIdentifierString> =
  /*#__PURE__*/ createCheckFunction(assertAtIdentifierString)
export const isAtUriString: CheckFn<AtUriString> =
  /*#__PURE__*/ createCheckFunction(assertAtIdentifierString)
export const isCidString: CheckFn<CidString> =
  /*#__PURE__*/ createCheckFunction(assertCidString)
export const isDatetimeString: CheckFn<DatetimeString> =
  /*#__PURE__*/ createCheckFunction(assertDatetimeString)
export const isDidString: CheckFn<DidString> =
  /*#__PURE__*/ createCheckFunction(assertDidString)
export const isHandleString: CheckFn<HandleString> =
  /*#__PURE__*/ createCheckFunction(assertHandleString)
export const isNsidString: CheckFn<NsidString> =
  /*#__PURE__*/ createCheckFunction(assertNsidString)
export const isRecordKeyString: CheckFn<RecordKeyString> =
  /*#__PURE__*/ createCheckFunction(assertRecordKeyString)
export const isTidString: CheckFn<TidString> =
  /*#__PURE__*/ createCheckFunction(assertTidString)

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

const formatters = /*#__PURE__*/ new Map<StringFormat, (str: string) => void>([
  ['at-identifier', assertAtIdentifierString],
  ['at-uri', assertAtUriString],
  ['cid', assertCidString],
  ['datetime', assertDatetimeString],
  ['did', assertDidString],
  ['handle', assertHandleString],
  ['language', assertLanguageString],
  ['nsid', assertNsidString],
  ['record-key', assertRecordKeyString],
  ['tid', assertTidString],
  ['uri', assertUriString],
] as const)

/*@__NO_SIDE_EFFECTS__*/
export function assertStringFormat<F extends StringFormat>(
  input: string,
  format: F,
): asserts input is InferStringFormat<F> {
  const assertFn = formatters.get(format)
  if (assertFn) assertFn(input)
  // Fool-proof
  else throw new Error(`Unknown string format: ${format}`)
}
