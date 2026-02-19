import {
  BlobRef,
  Cid,
  LexArray,
  LexMap,
  LexValue,
  isCid,
} from '@atproto/lex-data'
import { parseBlobRef } from './blob.js'
import { encodeLexBytes, parseLexBytes } from './bytes.js'
import { JsonObject, JsonValue } from './json.js'
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
  return JSON.parse(input, function (key: string, value: JsonValue): LexValue {
    switch (typeof value) {
      case 'object':
        if (value === null) return null
        if (Array.isArray(value)) return value
        return parseSpecialJsonObject(value, options) ?? value
      case 'number':
        if (Number.isSafeInteger(value)) return value
        if (options.strict) {
          throw new TypeError(`Invalid non-integer number: ${value}`)
        }
      // fallthrough
      default:
        return value
    }
  })
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
 * @param value - The JSON value to convert
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
  value: JsonValue,
  options: LexParseOptions = { strict: false },
): LexValue {
  switch (typeof value) {
    case 'object': {
      if (value === null) return null
      if (Array.isArray(value)) return jsonArrayToLex(value, options)
      return (
        parseSpecialJsonObject(value, options) ??
        jsonObjectToLexMap(value, options)
      )
    }
    case 'number':
      if (Number.isSafeInteger(value)) return value
      if (options.strict) {
        throw new TypeError(`Invalid non-integer number: ${value}`)
      }
    // fallthrough
    case 'boolean':
    case 'string':
      return value
    default:
      throw new TypeError(`Invalid JSON value: ${typeof value}`)
  }
}

function jsonArrayToLex(
  input: JsonValue[],
  options: LexParseOptions,
): LexValue[] {
  // Lazily copy value
  let copy: LexValue[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = jsonToLex(inputItem, options)
    if (item !== inputItem) {
      copy ??= Array.from(input)
      copy[i] = item
    }
  }
  return copy ?? input
}

function jsonObjectToLexMap(
  input: JsonObject,
  options: LexParseOptions,
): LexMap {
  // Lazily copy value
  let copy: LexMap | undefined = undefined
  for (const [key, jsonValue] of Object.entries(input)) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    // Ignore (strip) undefined values
    if (jsonValue === undefined) {
      copy ??= { ...input }
      delete copy[key]
      continue
    }

    const value = jsonToLex(jsonValue!, options)
    if (value !== jsonValue) {
      copy ??= { ...input }
      copy[key] = value
    }
  }
  return copy ?? input
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
 * @param value - The Lex value to convert
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
export function lexToJson(value: LexValue): JsonValue {
  switch (typeof value) {
    case 'object':
      if (value === null) {
        return value
      } else if (Array.isArray(value)) {
        return lexArrayToJson(value)
      } else if (isCid(value)) {
        return encodeLexLink(value)
      } else if (ArrayBuffer.isView(value)) {
        return encodeLexBytes(value)
      } else {
        return encodeLexMap(value)
      }
    case 'boolean':
    case 'string':
    case 'number':
      return value
    default:
      throw new TypeError(`Invalid Lex value: ${typeof value}`)
  }
}

function lexArrayToJson(input: LexArray): JsonValue[] {
  // Lazily copy value
  let copy: JsonValue[] | undefined
  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = lexToJson(inputItem)
    if (item !== inputItem) {
      copy ??= Array.from(input) as JsonValue[]
      copy[i] = item
    }
  }
  return copy ?? (input as JsonValue[])
}

function encodeLexMap(input: LexMap): JsonObject {
  // Lazily copy value
  let copy: JsonObject | undefined = undefined
  for (const [key, lexValue] of Object.entries(input)) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError('Invalid key: __proto__')
    }

    // Ignore (strip) undefined values
    if (lexValue === undefined) {
      copy ??= { ...input } as JsonObject
      delete copy[key]
      continue
    }

    const jsonValue = lexToJson(lexValue!)
    if (jsonValue !== lexValue) {
      copy ??= { ...input } as JsonObject
      copy[key] = jsonValue
    }
  }
  return copy ?? (input as JsonObject)
}

function parseSpecialJsonObject(
  input: LexMap,
  options: LexParseOptions,
): Cid | Uint8Array | BlobRef | undefined {
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
        const blob = parseBlobRef(input, options)
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
