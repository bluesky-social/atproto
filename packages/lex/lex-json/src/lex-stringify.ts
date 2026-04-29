import { LexValue } from '@atproto/lex-data'
import {
  JsonStringifyDeepOptions,
  jsonStringifyDeep,
} from './json-stringify-deep.js'
import { LexToJsonOptions, lexToJson } from './lex-to-json.js'

/**
 * @internal
 *
 * Historically, `stringifyLex` was implemented as a simple wrapper around
 * `JSON.stringify(lexToJson(input))`. However, this approach can lead to
 * `RangeError: Maximum call stack size exceeded` for deeply nested structures,
 * which can occur in some AT Protocol data. To address this, we now implement
 * `lexStringify` using a custom iterative approach (`jsonStringifyDeep`) that
 * can handle deep nesting without hitting call stack limits. The original
 * implementation is still available as a fallback for cases where the structure
 * is not deeply nested, as `JSON.stringify` is generally faster for typical use
 * cases.
 *
 */
const JSON_STRINGIFY_DEEP_OPTIONS: Required<JsonStringifyDeepOptions> = {
  allowNonSafeIntegers: true,
  maxContainerLength: Infinity,
  maxNestedLevels: Infinity,
  maxObjectKeyLen: Infinity,
}

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
  try {
    return JSON.stringify(json)
  } catch (err) {
    // If we hit a max call stack error, it means the structure is too deeply
    // nested for JSON.stringify. In this case, we can use our custom iterative
    // implementation to handle deep structures.
    if (err instanceof RangeError) {
      return jsonStringifyDeep(json, JSON_STRINGIFY_DEEP_OPTIONS)
    }

    throw err
  }
}
