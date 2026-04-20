import { LexValue, utf8FromBytes } from '@atproto/lex-data'
import { JsonToLexOptions, jsonToLex } from './lex-json.js'

/**
 * Parses a JSON string into Lex values.
 *
 * This function parses JSON and automatically decodes AT Protocol special types:
 * - `{$link: string}` objects are decoded to `Cid` instances
 * - `{$bytes: string}` objects are decoded to `Uint8Array` instances
 * - `{$type: 'blob'}` objects are validated
 * - Objects with `$type` properties are validated for known types (e.g., 'blob') and rejected if invalid
 * - Non-integer numbers are rejected as invalid Lex values
 * - Deeply nested structures, excessively long arrays/objects, and excessively long object keys are rejected based on the provided options (or defaults in strict mode).
 *
 * @see {@link jsonToLex} for details and options
 * @typeParam T - Type cast for the resulting Lex value. Use when you want to specify the expected structure of the parsed data.
 * @param input - The JSON string to parse
 * @param options - Parsing options (e.g., strict mode)
 * @returns The parsed Lex value
 * @throws {SyntaxError} If the input is not valid JSON
 * @throws {TypeError} If strict mode is enabled and invalid Lex values are found
 *
 * @example
 * ```typescript
 * import { lexParse } from '@atproto/lex'
 *
 * // Parse JSON with $link and $bytes decoding
 * const parsed = lexParse<{
 *   ref: Cid
 *   data: Uint8Array
 * }>(`{
 *   "ref": { "$link": "bafyrei..." },
 *   "data": { "$bytes": "SGVsbG8sIHdvcmxkIQ==" }
 * }`)
 *
 * // Parse a single CID
 * const someCid = lexParse<Cid>('{"$link": "bafyrei..."}')
 *
 * // Parse binary data
 * const someBytes = lexParse<Uint8Array>('{"$bytes": "SGVsbG8sIHdvcmxkIQ=="}')
 * ```
 */
export function lexParse<T extends LexValue = LexValue>(
  input: string,
  options?: JsonToLexOptions,
): T {
  // @NOTE see ./lex-parse.bench.ts for performance comparison of implementation
  // that uses a reviver function in JSON.parse vs. the current implementation.

  // @NOTE Unlike JSON.stringify, JSON.parse can handle very deeply nested
  // structures. jsonToLex will enforce nesting limits and throw if they are
  // exceeded. The nesting level should always be limited by the input JSON
  // string itself, so using "unlimited" nesting limits here should not pose a
  // risk of infinite loops or excessive resource usage.
  //
  // JSON.parse('['.repeat(1_000_000) + ']'.repeat(1_000_000))

  return jsonToLex(JSON.parse(input), options) as T
}

/**
 * A safe version of {@link lexParse} that returns `undefined` instead of
 * throwing on invalid input.
 *
 * @see {@link jsonToLex} for details and options.
 */
export function lexParseSafe<T extends LexValue = LexValue>(
  input: string,
  options?: JsonToLexOptions,
): T | undefined {
  try {
    return lexParse<T>(input, options)
  } catch (err) {
    return undefined
  }
}

/**
 * Parses a JSON string from a byte array into Lex values.
 *
 * @see {@link jsonToLex} for details and options.
 */
export function lexParseJsonBytes<T extends LexValue = LexValue>(
  bytes: Uint8Array,
  options?: JsonToLexOptions,
): T {
  // @NOTE We explored here the option of using a streaming JSON parser that
  // operates directly on bytes, allowing to avoid creating an intermediary JSON
  // string representation. This was slightly faster in some benchmarks, but it
  // also added a significant amount of complexity bundle size.
  return lexParse<T>(utf8FromBytes(bytes), options)
}
