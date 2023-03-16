import {
  cborBytesToRecord,
  cborDecode,
  cborEncode,
  check,
  IpldValue,
  ipldValueToJson,
  jsonToIpldValue,
  JsonValue,
  schema,
} from '@atproto/common'
import { BlobRef, jsonBlobRef } from './blob-refs'

export type LexValue =
  | IpldValue
  | BlobRef
  | Array<LexValue>
  | { [key: string]: LexValue }
  | { [key: number]: LexValue }

export const lexValueToIpld = (val: LexValue): IpldValue => {
  if (check.is(val, schema.array)) {
    return val.map((item) => lexValueToIpld(item))
  } else if (val instanceof BlobRef) {
    return val.ipld()
  } else if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = lexValueToIpld(val[key])
    }
    return toReturn
  } else {
    return val
  }
}

export const ipldToLexValue = (val: IpldValue): LexValue => {
  if (check.is(val, schema.array)) {
    return val.map((item) => ipldToLexValue(item))
  } else if (check.is(val, jsonBlobRef)) {
    return BlobRef.fromJsonRef(val)
  } else if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldToLexValue(val[key])
    }
    return toReturn
  } else {
    return val
  }
}

export const jsonToLexValue = (val: JsonValue): LexValue => {
  return ipldToLexValue(jsonToIpldValue(val))
}

export const lexValueToJson = (val: LexValue): JsonValue => {
  return ipldValueToJson(lexValueToIpld(val))
}

export const stringifyLex = (val: LexValue): string => {
  return JSON.stringify(lexValueToJson(val))
}

export const jsonStringToLex = (val: string): LexValue => {
  return jsonToLexValue(JSON.parse(val))
}

export const cborToLex = (val: Uint8Array): LexValue => {
  return ipldToLexValue(cborDecode(val))
}

export const lexToCbor = (val: LexValue): Uint8Array => {
  return cborEncode(lexValueToIpld(val))
}
