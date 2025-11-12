import {
  CID,
  Json,
  LexValue,
  jsonToLex,
  lexEquals,
  lexToJson,
} from '@atproto/lex-data'

/**
 * @deprecated Use {@link Json} from `@atproto/lex-cbor` instead.
 */
export type JsonValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | unknown // @NOTE this makes the whole type "unknown"
  | Array<JsonValue>
  | { [key: string]: JsonValue }

/**
 * @deprecated Use {@link LexValue} from `@atproto/lex-cbor` instead.
 */
export type IpldValue =
  | JsonValue
  | CID
  | Uint8Array
  | Array<IpldValue>
  | { [key: string]: IpldValue }

/**
 * Converts a JSON-compatible value to an IPLD-compatible value.
 * @deprecated Use {@link jsonToLex} from `@atproto/lex-cbor` instead.
 */
export const jsonToIpld = (val: JsonValue): IpldValue => {
  return jsonToLex(val as Json, { strict: false })
}

/**
 * Converts an IPLD-compatible value to a JSON-compatible value.
 * @deprecated Use {@link lexToJson} from `@atproto/lex-cbor` instead.
 */
export const ipldToJson = (val: IpldValue): JsonValue => {
  // Legacy behavior
  if (val === undefined) return undefined
  return lexToJson(val as LexValue)
}

/**
 * Compares two IPLD-compatible values for deep equality.
 * @deprecated Use {@link lexEquals} from `@atproto/lex-cbor` instead.
 */
export const ipldEquals = (a: IpldValue, b: IpldValue): boolean => {
  if (!lexEquals(a as LexValue, b as LexValue)) return false

  // @NOTE The previous implementation used "===" which treats NaN as unequal to
  // NaN.
  if (Number.isNaN(a)) return false

  return true
}
