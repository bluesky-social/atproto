import { LexValue } from '@atproto/lex-data'
import { DeepTransformOptions, deepTransform } from './deep-transform.js'
import { JsonValue } from './json.js'
import { encodeSpecialJsonObject } from './special-objects.js'

/**
 * Options for {@link lexToJson} function.
 *
 * @see {@link DeepTransformOptions}
 */
export type LexToJsonOptions = DeepTransformOptions

/**
 * Converts a Lexicon value ({@link LexValue}) to a JSON-compatible value
 * ({@link JsonValue}) by transforming the input value and its nested
 * structures to their JSON equivalents:
 *
 * - `Cid` instances are converted to `{$link: string}` objects
 * - `Uint8Array` instances are converted to `{$bytes: string}` objects (base64)
 *
 * Use this when you need to convert Lex values to plain objects (e.g., for
 * custom serialization or inspection). For direct serialization into JSON, use
 * {@link lexStringify} instead.
 *
 * @throws {TypeError} If the value contains unsupported types
 *
 * @note
 * Since lexToJson is often used as a step to re-serialize internal Lexicon data
 * to JSON/CBOR, we use "non-strict" defaults here. Strictness is expected to be
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
  options?: LexToJsonOptions,
): JsonValue {
  // Run "pnpm exec vitest bench --run lex-to-json" for performance comparison
  // of recursive vs. iterative implementations of this function. deepTransform
  // uses a hybrid approach where it starts with a recursive implementation, but
  // if it detects that the nesting level is too deep, it switches to an
  // iterative implementation using a stack.

  return deepTransform(input, encodeSpecialJsonObject, options) as JsonValue
}
