import { CID } from 'multiformats/cid'
import {
  IpldValue,
  LegacyJsonValue,
  check,
  ipldToJson,
} from '@atproto/common-web'
import { LexValue } from '@atproto/lex-data'
import {
  JsonValue,
  jsonToLex,
  jsonTransform,
  lexParse,
  lexStringify,
} from '@atproto/lex-json'
import { BlobRef, typedJsonBlobRef, untypedJsonBlobRef } from './blob-refs'

/**
 * @note this is equivalent to `unknown` because of {@link IpldValue}
 * historically being `unknown`.
 *
 * @deprecated Use {@link LexValue} from `@atproto/lex-data` instead.
 */
export type LegacyLexValue = IpldValue | BlobRef

export type { LegacyLexValue as LexValue }

/**
 * @deprecated Use {@link TypedLexMap} from `@atproto/lex-data` instead.
 */
export type RepoRecord = Record<string, LegacyLexValue>

// @NOTE avoiding use of check.is() here only because it makes
// these implementations slow, and they often live in hot paths.

/**
 * @deprecated Use `LexValue` from `@atproto/lex-data` instead (which doesn't need conversion to IPLD).
 */
export const lexToIpld = (input: LegacyLexValue): IpldValue => {
  return jsonTransform(input, lexObjectToIpld)
}

/**
 * @internal
 */
function lexObjectToIpld(value: object): IpldValue | void {
  // convert blobs, leaving the original encoding so that we don't change CIDs on re-encode
  if (value instanceof BlobRef) {
    return value.original
  }
}

/**
 * @deprecated Use `LexValue` from `@atproto/lex-data` instead instead (which doesn't need conversion to IPLD).
 */
export const ipldToLex = (input: IpldValue): LegacyLexValue => {
  return jsonTransform(input, ipldObjectToLex)
}

/**
 * @internal
 */
function ipldObjectToLex(value: object): LegacyLexValue | void {
  // convert blobs, using hints to avoid expensive is() check
  if ('$type' in value && value.$type !== undefined) {
    if (check.is(value, typedJsonBlobRef)) {
      return new BlobRef(value.ref, value.mimeType, value.size, value)
    }
  } else if ('cid' in value && 'mimeType' in value) {
    if (check.is(value, untypedJsonBlobRef)) {
      return new BlobRef(CID.parse(value.cid), value.mimeType, -1, value)
    }
  }
}

/**
 * @deprecated use {@link lexToJson} from `@atproto/lex-json` instead
 */
export const lexToJson = (val: LegacyLexValue): LegacyJsonValue => {
  return ipldToJson(lexToIpld(val))
}

/**
 * @deprecated use {@link lexStringify} from `@atproto/lex-json` instead
 */
export const stringifyLex = (val: LegacyLexValue): string => {
  return lexStringify(lexToIpld(val) as LexValue)
}

/**
 * @deprecated use {@link jsonToLex} from `@atproto/lex-json` instead
 */
export const jsonToLexLegacy = (val: LegacyJsonValue): LegacyLexValue => {
  return ipldToLex(jsonToLex(val as JsonValue, { strict: false }))
}

export { jsonToLexLegacy as jsonToLex }

/**
 * @deprecated use {@link lexParse} from `@atproto/lex-json` instead
 */
export const jsonStringToLex = (val: string): LegacyLexValue => {
  return ipldToLex(lexParse(val))
}
