import { LexValue } from '@atproto/lex-data'
import { jsonTransform } from './json-transform.js'
import { JsonValue } from './json.js'
import { LexParseOptions } from './lex-parse-options.js'
import {
  encodeSpecialJsonObject,
  parseSpecialJsonObject,
} from './special-objects.js'

/**
 * Converts a parsed JSON representation of Lexicon value to a {@link LexValue}.
 *
 * This function transforms already-parsed JSON objects into Lex values by
 * decoding AT Protocol special types:
 * - `{$link: string}` objects are converted to `Cid` instances
 * - `{$bytes: string}` objects are converted to `Uint8Array` instances
 *
 * Use this when you have a JavaScript object (e.g., from `JSON.parse()`) and
 * need to convert it to the Lex data model. For parsing JSON strings directly,
 * use {@link lexParse} instead.
 *
 * @param input - The JSON value to convert
 * @param options - Parsing options (e.g., strict mode)
 * @returns The converted Lex value
 * @throws {TypeError} If strict mode is enabled and invalid Lex values are found
 * @throws {TypeError} If the value contains unsupported types (e.g., undefined at top level)
 *
 * @example
 * ```typescript
 * import { jsonToLex } from '@atproto/lex'
 *
 * // Convert parsed JSON to Lex values
 * const lex = jsonToLex({
 *   ref: { $link: 'bafyrei...' },  // Converted to Cid
 *   data: { $bytes: 'SGVsbG8sIHdvcmxkIQ==' }  // Converted to Uint8Array
 * })
 * ```
 */
export function jsonToLex(
  input: JsonValue,
  options: LexParseOptions = { strict: false },
): LexValue {
  return jsonTransform<LexValue>(
    input,
    (value) => parseSpecialJsonObject(value, options),
    options.strict,
  )
}

/**
 * Converts a Lex value to a JSON-compatible value.
 *
 * This function transforms Lex data model values into plain JavaScript objects
 * suitable for JSON serialization:
 * - `Cid` instances are converted to `{$link: string}` objects
 * - `Uint8Array` instances are converted to `{$bytes: string}` objects (base64)
 *
 * Use this when you need to convert Lex values to plain objects (e.g., for
 * custom serialization or inspection). For direct JSON string output, use
 * {@link lexStringify} instead.
 *
 * @param input - The Lex value to convert
 * @returns The JSON-compatible value
 * @throws {TypeError} If the value contains unsupported types
 *
 * @example
 * ```typescript
 * import { lexToJson } from '@atproto/lex'
 *
 * // Convert Lex values to JSON-compatible objects
 * const obj = lexToJson({
 *   ref: someCid,      // Converted to { $link: string }
 *   data: someBytes    // Converted to { $bytes: string }
 * })
 * ```
 */
export function lexToJson(input: LexValue): JsonValue {
  return jsonTransform<JsonValue>(input, encodeSpecialJsonObject)
}
