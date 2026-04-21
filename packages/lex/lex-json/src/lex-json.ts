import { LexValue, MAX_PAYLOAD_NESTED_LEVELS } from '@atproto/lex-data'
import { JsonTransformOptions, jsonTransform } from './json-transform.js'
import { JsonValue } from './json.js'
import {
  SpecialJsonObjectOptions,
  encodeSpecialJsonObject,
  parseSpecialJsonObject,
} from './special-objects.js'

/**
 * Allows to ensure that if new options are added to the input options type,
 * they will be explicitly handled in the function implementation. This is
 * useful to prevent accidentally forgetting to handle new options added to the
 */
type Explicit<T> = {
  // @NOTE The `& string` part is the trick that allows to loose the
  // "optionality" meta property of the keys
  [K in keyof T & string]: T[K]
}

/**
 * Options for {@link jsonToLex} function
 *
 * @see {@link JsonTransformOptions}
 * @see {@link SpecialJsonObjectOptions}
 */
export type JsonToLexOptions = JsonTransformOptions & SpecialJsonObjectOptions

/**
 * Converts a bare JSON representation of Lexicon value ({@link JsonValue}) into
 * a {@link LexValue}. This is done by decoding AT Protocol special types, and
 * enforcing AT protocol data model constraints:
 *
 * - `{$link: string}` objects are converted to `Cid` objects
 * - `{$bytes: string}` objects are converted to `Uint8Array` instances
 * - number should be safe integers (unless `allowNonSafeIntegers` option is
 *   enabled)
 * - nesting levels, container lengths, and object key lengths are limited to
 *   prevent excessively large structures (limits can be configured with
 *   options)
 *
 * Use this to convert bare JavaScript objects (e.g., from
 * {@link JSON.parse JSON.parse()}) into Lex data model values. For parsing JSON
 * strings directly, or JSON string in buffer form, use {@link lexParse} or
 * {@link lexParseJsonBytes} instead, which are using this function internally.
 *
 * @throws {TypeError} If the input contains invalid Lex values, or contains too
 * deeply nested structures
 *
 * @note This function is typically used at the boundary of JSON parsing, where
 * we need to convert user data (e.g `com.atproto.repo.createRecord` API calls)
 * into Lex values for processing. Because "write paths" are a common entry
 * point for untrusted data, these should explicitly enforce strict validation.
 * Because "read" path are most common, {@link JsonToLexOptions.strict} is
 * `false` by default.
 *
 * @note `JSON.parse` will typically allow any level of nesting. This can be
 * problematic when the parsed structures is re-serialized with
 * `JSON.stringify`, which has a call stack limit that can be exceeded with
 * deeply nested structures. To mitigate this, `jsonToLex` enforces a default
 * maximum nesting level (5,000) and will throw if this is exceeded. This,
 * combined with the custom {@link lexStringify} implementation that handles
 * deep nesting, allows to:
 *
 * 1) Throw an error during parsing of excessively nested structures, which can
 *    be a sign of malformed input or potential attack.
 * 2) Ensure that any data that did not cause an error during parsing can be
 *    safely re-serialized without hitting call stack limits (see
 *    {@link lexToJson}).
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
  {
    strict = false,
    allowNonSafeIntegers = !strict,
    maxNestedLevels = strict ? undefined : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? undefined : Infinity,
    maxObjectKeyLen = strict ? undefined : Infinity,
  }: JsonToLexOptions = {},
): LexValue {
  const options: Explicit<JsonToLexOptions> = {
    strict,
    allowNonSafeIntegers,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
  }
  return jsonTransform<LexValue>(
    input,
    (value) => parseSpecialJsonObject(value, options),
    options,
  )
}

/**
 * Options for {@link lexToJson} function.
 *
 * @see {@link JsonTransformOptions}
 * @see {@link SpecialJsonObjectOptions}
 */
export type LexToJsonOptions = JsonTransformOptions & SpecialJsonObjectOptions

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
 * @throws {TypeError} If the value contains unsupported types
 *
 * @note
 * Since lexToJson is often used as a step to re-serialize Lexicon data to
 * JSON/CBOR, we use "non-strict" defaults here. Strictness is expected to be
 * enforced at when the data is first parsed from JSON/CBOR (e.g. with
 * {@link lexParse}), so we can be more lenient in this transformation step.
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
export function lexToJson(
  input: LexValue,
  {
    strict = false,
    allowNonSafeIntegers = !strict,
    maxNestedLevels = strict ? undefined : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? undefined : Infinity,
    maxObjectKeyLen = strict ? undefined : Infinity,
  }: LexToJsonOptions = {},
): JsonValue {
  const options: Explicit<LexToJsonOptions> = {
    strict,
    allowNonSafeIntegers,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
  }
  return jsonTransform<JsonValue>(input, encodeSpecialJsonObject, options)
}
