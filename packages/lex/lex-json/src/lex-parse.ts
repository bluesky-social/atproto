import { LexValue, utf8FromBytes } from '@atproto/lex-data'
import { JsonToLexOptions, jsonToLex } from './lex-json.js'

/**
 * Parses a JSON string into Lex values.
 *
 * This function parses JSON and automatically decodes AT Protocol special types:
 * - `{$link: string}` objects are decoded to `Cid` instances
 * - `{$bytes: string}` objects are decoded to `Uint8Array` instances
 * - `{$type: 'blob'}` objects are validated
 *
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
  options: JsonToLexOptions = { strict: false },
): T {
  // @NOTE see ./lex-json.bench.ts for performance comparison of implementation
  // that uses a reviver function in JSON.parse vs. the current implementation.

  // @NOTE Unlike JSON.stringify, JSON.parse can handle very deeply nested
  // structures:
  //
  // JSON.parse('['.repeat(40000) + ']'.repeat(40000))
  return jsonToLex(JSON.parse(input), options) as T
}

/**
 * Parses a JSON string from a byte array into Lex values.
 */
export function lexParseJsonBytes(
  bytes: Uint8Array,
  options?: JsonToLexOptions,
): LexValue {
  // @NOTE We explored here the option of using a streaming JSON parser that
  // operates directly on bytes, allows to avoid creating an intermediary string
  // representation. This was not significantly faster than the current (naive)
  // implementation, and would add complexity and bundle size, so we decided
  // against it.
  return lexParse(utf8FromBytes(bytes), options)
}
