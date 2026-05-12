import { LexValue } from '@atproto/lex-data'
import { LexToJsonOptions, lexToJson } from './lex-to-json.js'

/**
 * Serialize a Lex value to a JSON string.
 *
 * This function serializes AT Protocol data model values to JSON, automatically
 * encoding special types:
 * - `Cid` instances are encoded as `{$link: string}`
 * - `Uint8Array` instances are encoded as `{$bytes: string}` (base64)
 *
 * It is equivalent to `JSON.stringify(lexToJson(input))` but with additional
 * handling for deep structures that may exceed `JSON.stringify`'s call stack
 * limits. If a `RangeError` is encountered during serialization, it falls back
 * to a custom iterative implementation (`jsonStringifyDeep`) to handle deeply
 * nested structures.
 */
export function lexStringify(
  input: LexValue,
  options?: LexToJsonOptions,
): string {
  const json = lexToJson(input, options)
  return JSON.stringify(json)
}
