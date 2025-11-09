import { Json, Lex, jsonToLex, lexEquals, lexToJson } from '@atproto/lex-data'

/**
 * @note For historical reasons, this defined as `unknown`.
 * @deprecated Use {@link Json} from '@atproto/lex-data' instead.
 */
export type JsonValue = unknown

/**
 * @deprecated Use {@link Lex} from '@atproto/lex-data' instead.
 */
export type IpldValue = Lex

/**
 * Converts a JSON-compatible value to an IPLD-compatible value.
 * @deprecated Use {@link jsonToLex} from '@atproto/lex-data' instead.
 */
export const jsonToIpld = (val: JsonValue): IpldValue => {
  return jsonToLex(val as Json, { strict: false })
}

/**
 * Converts an IPLD-compatible value to a JSON-compatible value.
 * @deprecated Use {@link lexToJson} from '@atproto/lex-data' instead.
 */
export const ipldToJson = (val: IpldValue): JsonValue => {
  return lexToJson(val)
}

/**
 * Compares two IPLD-compatible values for deep equality.
 * @deprecated Use {@link lexEquals} from '@atproto/lex-data' instead.
 */
export const ipldEquals = (a: IpldValue, b: IpldValue): boolean => {
  // @NOTE The previous implementation used "===" which treats NaN as unequal to
  // NaN.
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return false
  }
  return lexEquals(a, b)
}
