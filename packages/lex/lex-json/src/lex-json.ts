import {
  BlobRef,
  Cid,
  LexMap,
  LexValue,
  isCid,
  utf8FromBytes,
} from '@atproto/lex-data'
import { parseTypedBlobRef } from './blob.js'
import { encodeLexBytes, parseLexBytes } from './bytes.js'
import { JsonValue } from './json.js'
import { lexTransform } from './lex-transform.js'
import { encodeLexLink, parseLexLink } from './link.js'

/**
 * Serialize a Lex value to a JSON string.
 *
 * This function serializes AT Protocol data model values to JSON, automatically
 * encoding special types:
 * - `Cid` instances are encoded as `{$link: string}`
 * - `Uint8Array` instances are encoded as `{$bytes: string}` (base64)
 *
 * @param input - The Lex value to stringify
 * @returns A JSON string representation of the value
 *
 * @example
 * ```typescript
 * import { lexStringify } from '@atproto/lex'
 *
 * // Stringify with CID and bytes encoding
 * const json = lexStringify({
 *   ref: someCid,
 *   data: new Uint8Array([72, 101, 108, 108, 111])
 * })
 * // json is '{"ref":{"$link":"bafyrei..."},"data":{"$bytes":"SGVsbG8="}}'
 * ```
 */
export function lexStringify(input: LexValue): string {
  // @NOTE Because of the way the "replacer" works in JSON.stringify, it's
  // simpler to convert Lex to JSON first rather than trying to do it
  // on-the-fly.
  return JSON.stringify(lexToJson(input))
}

/**
 * Options for parsing JSON to Lex values.
 */
export type LexParseOptions = {
  /**
   * When enabled, forbids the presence of invalid Lex values such as:
   * - Non-integer numbers (only safe integers are valid in the Lex data model)
   * - Malformed `$link` objects
   * - Malformed `$bytes` objects
   * - Objects with invalid or empty `$type` properties
   * - Invalid {@link BlobRef} (`$type: 'blob'`) objects
   *
   * When disabled (default), invalid special objects are left as plain objects.
   *
   * @default false
   */
  strict?: boolean
}

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
  return lexTransform<LexValue>(
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
  return lexTransform<JsonValue>(input, encodeSpecialJsonObject)
}

/**
 * @internal
 */
export function encodeSpecialJsonObject(input: LexValue): JsonValue | void {
  if (isCid(input)) {
    return encodeLexLink(input)
  } else if (ArrayBuffer.isView(input)) {
    return encodeLexBytes(input)
  }
}

/**
 * @internal
 */
export function parseSpecialJsonObject(
  input: LexMap,
  options: LexParseOptions,
): Cid | Uint8Array | BlobRef | void {
  // Hot path: use hints to avoid parsing when possible

  if (input.$link !== undefined) {
    const cid = parseLexLink(input)
    if (cid) return cid
    if (options.strict) throw new TypeError(`Invalid $link object`)
  } else if (input.$bytes !== undefined) {
    const bytes = parseLexBytes(input)
    if (bytes) return bytes
    if (options.strict) throw new TypeError(`Invalid $bytes object`)
  } else if (input.$type !== undefined) {
    // @NOTE Since blobs are "just" regular lex objects with a special shape,
    // and because an object that does not conform to the blob shape would still
    // result in undefined being returned, we only attempt to parse blobs when
    // the strict option is enabled.
    if (options.strict) {
      if (input.$type === 'blob') {
        const blob = parseTypedBlobRef(input, options)
        if (blob) return blob
        throw new TypeError(`Invalid blob object`)
      } else if (typeof input.$type !== 'string') {
        throw new TypeError(`Invalid $type property (${typeof input.$type})`)
      } else if (input.$type.length === 0) {
        throw new TypeError(`Empty $type property`)
      }
    }
  }

  // @NOTE We ignore legacy blob representation here. They can be handled at the
  // application level if needed.

  return undefined
}
