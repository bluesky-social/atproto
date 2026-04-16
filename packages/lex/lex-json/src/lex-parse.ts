import { LexValue, utf8FromBytes } from '@atproto/lex-data'
import { jsonToLex } from './lex-json.js'
import { LexParseOptions } from './lex-parse-options.js'

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
  options: LexParseOptions = { strict: false },
): T {
  // @NOTE see ./lex-json.bench.ts for performance comparison of implementation
  // that uses a reviver function in JSON.parse vs. the current implementation.
  return jsonToLex(JSON.parse(input), options) as T
}

/**
 * Parses a JSON string from a byte array into Lex values.
 */
export function lexParseJsonBytes(
  bytes: Uint8Array,
  options?: LexParseOptions,
): LexValue {
  // @NOTE see ./json-bytes-decoder.bench.ts for performance comparison of
  // implementation that uses a decoder class that operates directly on bytes
  // vs. the current implementation that first decodes bytes to string and then
  // parses JSON. For more common cases, it seems that the trivial
  // implementation works better than the decoder based solution, while having a
  // small overhead for slower cases (~2% difference). Because of this, we keep
  // the trivial implementation:
  return lexParse(utf8FromBytes(bytes), options)
}
