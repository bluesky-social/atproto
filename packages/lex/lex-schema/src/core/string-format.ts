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
const bcp47Regexp =
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

export type Did = `did:${string}:${string}`
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

export function validateStringFormat<F extends StringFormat>(
  input: string,
  format: F,
): InferStringFormat<F> {
  switch (format) {
    case 'datetime': {
      ensureValidDatetime(input)
      break
    }
    case 'uri': {
      if (/^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)) break
      throw new Error('Invalid URI')
    }
    case 'at-uri': {
      ensureValidAtUri(input)
      break
    }
    case 'did': {
      ensureValidDid(input)
      break
    }
    case 'handle': {
      ensureValidHandle(input)
      break
    }
    case 'at-identifier':
      if (input.startsWith('did:web:') || input.startsWith('did:plc:')) {
        ensureValidDid(input)
        break
      } else if (input.startsWith('did:')) {
        throw new Error('Invalid DID method')
      }
      try {
        ensureValidHandle(input)
        break
      } catch {
        throw new Error('Invalid DID or handle')
      }
    case 'nsid': {
      ensureValidNsid(input)
      break
    }
    case 'cid': {
      ensureValidCidString(input)
      break
    }
    case 'language': {
      if (bcp47Regexp.test(input)) break
      throw new Error('Invalid BCP 47 string')
    }
    case 'tid': {
      ensureValidTid(input)
      break
    }
    case 'record-key': {
      ensureValidRecordKey(input)
      break
    }
    default: {
      throw new Error(`Unhandled string (${format})`)
    }
  }

  return input as InferStringFormat<F>
}
