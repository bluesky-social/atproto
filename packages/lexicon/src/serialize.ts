import {
  cborDecode,
  cborEncode,
  check,
  cidForCbor,
  dataToCborBlock,
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

export type RepoRecord = Record<string, LexValue>

export const lexValueToIpld = (val: LexValue): IpldValue => {
  // convert blobs
  if (val instanceof BlobRef) {
    return val.original
  }
  // retain cids & bytes
  if (check.is(val, schema.cid) || check.is(val, schema.bytes)) {
    return val
  }
  // walk rest
  if (check.is(val, schema.array)) {
    return val.map((item) => lexValueToIpld(item))
  }
  if (check.is(val, schema.record)) {
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
  // convert blobs
  if (check.is(val, jsonBlobRef)) {
    return BlobRef.fromJsonRef(val)
  }
  // retain cids & bytes
  if (check.is(val, schema.cid) || check.is(val, schema.bytes)) {
    return val
  }
  // walk rest
  if (check.is(val, schema.array)) {
    return val.map((item) => ipldToLexValue(item))
  }
  if (check.is(val, schema.record)) {
    const toReturn = {}
    for (const key of Object.keys(val)) {
      toReturn[key] = ipldToLexValue(val[key])
    }
    return toReturn
  }
  {
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

export const lexToCborBlock = async (val: LexValue) => {
  return dataToCborBlock(lexValueToIpld(val))
}

export const cidForRecord = async (val: LexValue) => {
  return cidForCbor(lexValueToIpld(val))
}

export const cborToLexRecord = (val: Uint8Array): RepoRecord => {
  const parsed = cborToLex(val)
  if (!check.is(parsed, schema.record)) {
    throw new Error('lexicon records be a json object')
  }
  return parsed
}
