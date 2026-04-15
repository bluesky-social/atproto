import { CID } from 'multiformats/cid'
import {
  IpldValue,
  JsonValue,
  check,
  ipldToJson,
  jsonToIpld,
} from '@atproto/common-web'
import { lexTransform } from '@atproto/lex-json'
import { BlobRef, typedJsonBlobRef, untypedJsonBlobRef } from './blob-refs'

/**
 * @note this is equivalent to `unknown` because of {@link IpldValue} being `unknown`.
 * @deprecated Use {@link LexValue} from `@atproto/lex-data` instead.
 */
export type LexValue = unknown

/**
 * @deprecated Use {@link TypedLexMap} from `@atproto/lex-data` instead.
 */
export type RepoRecord = Record<string, LexValue>

// @NOTE avoiding use of check.is() here only because it makes
// these implementations slow, and they often live in hot paths.

/**
 * @deprecated Use `LexValue` from `@atproto/lex-data` instead (which doesn't need conversion to IPLD).
 */
export const lexToIpld = (input: LexValue): IpldValue => {
  return lexTransform(input, lexObjectToIpld)
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
export const ipldToLex = (input: IpldValue): LexValue => {
  return lexTransform(input, ipldObjectToLex)
}

/**
 * @internal
 */
function ipldObjectToLex(value: object): LexValue | void {
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

export const lexToJson = (val: LexValue): JsonValue => {
  return ipldToJson(lexToIpld(val))
}

export const stringifyLex = (val: LexValue): string => {
  return JSON.stringify(lexToJson(val))
}

export const jsonToLex = (val: JsonValue): LexValue => {
  return ipldToLex(jsonToIpld(val))
}

export const jsonStringToLex = (val: string): LexValue => {
  return jsonToLex(JSON.parse(val))
}
