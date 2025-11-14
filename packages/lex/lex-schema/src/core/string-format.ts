import { ensureValidCidString } from '@atproto/lex-data'
import {
  ensureValidAtUri,
  ensureValidDatetime,
  ensureValidDid,
  ensureValidHandle,
  ensureValidNsid,
  ensureValidRecordKey,
  ensureValidTid,
} from '@atproto/syntax'

// @NOTE This was copied from @atproto/common-web to avoid loading a full extra
// dependency just for this regexp.

// Validates well-formed BCP 47 syntax: https://www.rfc-editor.org/rfc/rfc5646.html#section-2.1
export const bcp47Regexp =
  /^((?<grandfathered>(en-GB-oed|i-ami|i-bnn|i-default|i-enochian|i-hak|i-klingon|i-lux|i-mingo|i-navajo|i-pwn|i-tao|i-tay|i-tsu|sgn-BE-FR|sgn-BE-NL|sgn-CH-DE)|(art-lojban|cel-gaulish|no-bok|no-nyn|zh-guoyu|zh-hakka|zh-min|zh-min-nan|zh-xiang))|((?<language>([A-Za-z]{2,3}(-(?<extlang>[A-Za-z]{3}(-[A-Za-z]{3}){0,2}))?)|[A-Za-z]{4}|[A-Za-z]{5,8})(-(?<script>[A-Za-z]{4}))?(-(?<region>[A-Za-z]{2}|[0-9]{3}))?(-(?<variant>[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(-(?<extension>[0-9A-WY-Za-wy-z](-[A-Za-z0-9]{2,8})+))*(-(?<privateUseA>x(-[A-Za-z0-9]{1,8})+))?)|(?<privateUseB>x(-[A-Za-z0-9]{1,8})+))$/

// Allow (date as Date).toISOString() to be used where datetime format is expected
declare global {
  interface Date {
    toISOString(): `${string}T${string}Z`
  }
}

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

export type Did<M extends string = string> = `did:${M}:${string}`
export type Uri = `${string}:${string}`
export type Nsid = `${string}.${string}.${string}`
/** An ISO 8601 formatted datetime string (YYYY-MM-DDTHH:mm:ss.sssZ) */
export type Datetime = `${string}T${string}`
export type Handle = `${string}.${string}`
export type AtIdentifier = Did | Handle
export type AtUri = `at://${AtIdentifier}/${Nsid}/${string}`

export type InferStringFormat<F> =
  //
  F extends 'datetime'
    ? Datetime
    : F extends 'uri'
      ? Uri
      : F extends 'at-uri'
        ? AtUri
        : F extends 'did'
          ? Did
          : F extends 'handle'
            ? Handle
            : F extends 'at-identifier'
              ? AtIdentifier
              : F extends 'nsid'
                ? Nsid
                : string

type AssertFn<T> = <I extends string>(input: I) => asserts input is I & T

// Re-export utility typed as assertion functions so that TypeScript can
// infer the narrowed type after calling them.

export const assertDid: AssertFn<Did> = ensureValidDid
export const assertAtUri: AssertFn<AtUri> = ensureValidAtUri
export const assertNsid: AssertFn<Nsid> = ensureValidNsid
export const assertTid: AssertFn<string> = ensureValidTid
export const assertRecordKey: AssertFn<string> = ensureValidRecordKey
export const assertDatetime: AssertFn<Datetime> = ensureValidDatetime
export const assertCidString: AssertFn<string> = ensureValidCidString
export const assertHandle: AssertFn<Handle> = ensureValidHandle

// Export utilities for formats missing from @atproto/syntax

export const assertUri: AssertFn<Uri> = (input) => {
  if (!/^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)) {
    throw new Error('Invalid URI')
  }
}
export const assertLanguage: AssertFn<string> = (input) => {
  if (!bcp47Regexp.test(input)) {
    throw new Error('Invalid BCP 47 string')
  }
}
export const assertAtIdentifier: AssertFn<AtIdentifier> = (input) => {
  if (input.startsWith('did:web:') || input.startsWith('did:plc:')) {
    assertDid(input)
  } else if (input.startsWith('did:')) {
    throw new Error('Invalid DID method')
  } else {
    try {
      assertHandle(input)
    } catch (cause) {
      throw new Error('Invalid DID or handle', { cause })
    }
  }
}

const formatters = new Map<StringFormat, (input: string) => void>([
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

export function assertStringFormat<F extends StringFormat>(
  input: string,
  format: F,
): asserts input is InferStringFormat<F> {
  const assertFn = formatters.get(format)
  if (assertFn) assertFn(input)
  // Fool-proof
  else throw new Error(`Unknown string format: ${format}`)
}
