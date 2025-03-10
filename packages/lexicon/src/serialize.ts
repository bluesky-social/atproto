import {
  IpldValue,
  JsonValue,
  check,
  ipldToJson,
  isCid,
  jsonToIpld,
} from '@atproto/common-web'
import { BlobRef, jsonBlobRef } from './blob-refs'

export type LexValue =
  | IpldValue
  | BlobRef
  | Array<LexValue>
  | { [key: string]: LexValue }

export type RepoRecord = Record<string, LexValue>

// @NOTE avoiding use of check.is() here only because it makes
// these implementations slow, and they often live in hot paths.

export const lexToIpld = (val: LexValue): IpldValue => {
  // walk arrays
  if (Array.isArray(val)) {
    return val.map(lexToIpld)
  }

  // objects
  if (val && typeof val === 'object') {
    // convert blobs, leaving the original encoding so that we don't change CIDs on re-encode
    if (val instanceof BlobRef) {
      return val.original
    }
    // retain cids & bytes
    if (isCid(val) || val instanceof Uint8Array) {
      return val
    }
    // walk plain objects
    const toReturn: Record<string, undefined | IpldValue> = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = lexToIpld(val[key])
    }
    return toReturn
  }
  // pass through
  return val
}

export const ipldToLex = (val: IpldValue): LexValue => {
  // map arrays
  if (Array.isArray(val)) {
    return val.map(ipldToLex)
  }

  // objects
  if (val && typeof val === 'object') {
    // retain cids, bytes
    if (isCid(val) || val instanceof Uint8Array) {
      return val
    }

    // convert blobs, using hints to avoid expensive is() check
    if (
      typeof val['mimeType'] === 'string' &&
      (val['$type'] === 'blob' || typeof val['cid'] === 'string') &&
      // Optimization: Only check against the "jsonBlobRef" schema if the object
      // has the right shape.
      check.is(val, jsonBlobRef)
    ) {
      return BlobRef.fromJsonRef(val)
    }

    // map plain objects
    const toReturn: Record<string, undefined | LexValue> = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldToLex(val[key])
    }
    return toReturn
  }
  // pass through
  return val
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
