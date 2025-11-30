import { ensureValidCidString, isLanguage } from '@atproto/lex-data'
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

type AssertFn<T> = <I extends string>(input: I) => asserts input is I & T
type CastFn<T> = <I extends string>(input: I) => I & T

/*@__NO_SIDE_EFFECTS__*/
function createCastFunction<T>(assertFn: AssertFn<T>): CastFn<T> {
  return <I extends string>(input: I) => {
    assertFn(input)
    return input as I & T
  }
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
}

export const assertDid: AssertFn<DidString> = ensureValidDid
export const assertAtUri: AssertFn<AtUriString> = ensureValidAtUri
export const assertAtIdentifier: AssertFn<AtIdentifierString> =
  ensureValidAtIdentifier
export const assertNsid: AssertFn<NsidString> = ensureValidNsid
export const assertTid: AssertFn<TidString> = ensureValidTid
export const assertRecordKey: AssertFn<RecordKeyString> = ensureValidRecordKey
export const assertDatetime: AssertFn<DatetimeString> = ensureValidDatetime
export const assertCidString: AssertFn<string> = ensureValidCidString
export const assertHandle: AssertFn<HandleString> = ensureValidHandle

// Export utilities for formats missing from @atproto/syntax

export type CidString = string
export type UriString = `${string}:${string}`
export type LanguageString = string

/*@__NO_SIDE_EFFECTS__*/
export function assertUri(input: string): asserts input is UriString {
  if (!/^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)) {
    throw new Error('Invalid URI')
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function assertLanguage(input: string): asserts input is LanguageString {
  if (!isLanguage(input)) {
    throw new Error('Invalid BCP 47 string')
  }
}

export const asDid: CastFn<DidString> =
  /*#__PURE__*/ createCastFunction(ensureValidDid)
export const asAtUri: CastFn<AtUriString> =
  /*#__PURE__*/ createCastFunction(ensureValidAtUri)
export const asNsid: CastFn<NsidString> =
  /*#__PURE__*/ createCastFunction(ensureValidNsid)
export const asTid: CastFn<TidString> =
  /*#__PURE__*/ createCastFunction(ensureValidTid)
export const asRecordKey: CastFn<RecordKeyString> =
  /*#__PURE__*/ createCastFunction(ensureValidRecordKey)
export const asDatetime: CastFn<DatetimeString> =
  /*#__PURE__*/ createCastFunction(ensureValidDatetime)
export const asCidString: CastFn<string> =
  /*#__PURE__*/ createCastFunction(ensureValidCidString)
export const asHandle: CastFn<HandleString> =
  /*#__PURE__*/ createCastFunction(ensureValidHandle)
export const asUri: CastFn<UriString> =
  /*#__PURE__*/ createCastFunction(assertUri)
export const asLanguage: CastFn<LanguageString> =
  /*#__PURE__*/ createCastFunction(assertLanguage)
export const asAtIdentifier: CastFn<AtIdentifierString> =
  /*#__PURE__*/ createCastFunction(assertAtIdentifier)

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
  ['datetime', assertDatetime],
  ['uri', assertUri],
  ['at-uri', assertAtUri],
  ['did', assertDid],
  ['handle', assertHandle],
  ['at-identifier', assertAtIdentifier],
  ['nsid', assertNsid],
  ['cid', assertCidString],
  ['language', assertLanguage],
  ['tid', assertTid],
  ['record-key', assertRecordKey],
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
