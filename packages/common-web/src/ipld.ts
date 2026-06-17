import { LexValue, lexEquals } from '@atproto/lex-data'
import { JsonValue, jsonToLex, lexToJson } from '@atproto/lex-json'

/**
 * @deprecated Use {@link JsonValue} from `@atproto/lex-cbor` instead.
 */
export type LegacyJsonValue = unknown

export type { LegacyJsonValue as JsonValue }

/**
 * @deprecated Use {@link LexValue} from `@atproto/lex-cbor` instead.
 */
export type IpldValue = unknown

/**
 * Converts a JSON-compatible value to an IPLD-compatible value.
 * @deprecated Use {@link jsonToLex} from `@atproto/lex-cbor` instead.
 */
export const jsonToIpld = (val: LegacyJsonValue): IpldValue => {
  return jsonToLex(val as JsonValue, { strict: false })
}

/**
 * Converts an IPLD-compatible value to a JSON-compatible value.
 * @deprecated Use {@link lexToJson} from `@atproto/lex-cbor` instead.
 */
export const ipldToJson = (val: IpldValue): LegacyJsonValue => {
  // Legacy behavior(s)
  if (val === undefined) return val
  if (Number.isNaN(val)) return val

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
