import {
  LexArray,
  LexMap,
  LexValue,
  MAX_CBOR_CONTAINER_LEN,
  MAX_CBOR_NESTED_LEVELS,
  MAX_CBOR_OBJECT_KEY_LEN,
  MAX_PAYLOAD_NESTED_LEVELS,
} from '@atproto/lex-data'
import {
  IterativeTransformOptions,
  iterativeTransform,
} from './iterative-transform.js'
import { JsonObject, JsonValue } from './json.js'
import { validateMaxUtf8Length } from './lib/validate-max-utf8-length.js'
import {
  SpecialJsonObjectOptions,
  encodeSpecialJsonObject,
} from './special-objects.js'

/**
 * Using a to low threshold (e.g. 10) can cause performance degradation due to
 * switching to iterative implementation too early, while using a too high
 * threshold (e.g. 10_000) can cause call stack overflow errors with deeply
 * nested structures. Empirical tests have shown that a threshold of around
 * 1,000 provides a good balance.
 *
 * @see lexToJson
 */
export const MAX_RECURSION_DEPTH_DEFAULT = 1000

/**
 * Options for {@link lexToJson} function.
 *
 * @see {@link IterativeTransformOptions}
 * @see {@link SpecialJsonObjectOptions}
 */
export type LexToJsonOptions = IterativeTransformOptions &
  SpecialJsonObjectOptions & {
    /**
     * Maximum recursion depth before switching to iterative implementation. Set
     * this only if you have either performances issues with the default value,
     * or your environment has a low call stack limit and you need to support
     * deeper nesting levels.
     *
     * Set to `0` or a negative value to disable recursion and use iterative
     * implementation for all levels of nesting. Set to `Infinity` to enable
     * recursion for all levels of nesting (might cause `RangeError: Maximum
     * call stack size exceeded` for deeply nested structures).
     *
     * This options is exposed so that servers can be tuned to allow deeper
     * nesting levels with better performances. For example, a Node.js server
     * could be started with `--stack-size=65500` to allow deeper recursion, and
     * then set `maxRecursionDepth` to a higher value (e.g. 10,000) to take
     * advantage of the better performance of the recursive implementation for
     * deeper nesting levels.
     *
     * @default MAX_RECURSION_DEPTH_DEFAULT
     */
    maxRecursionDepth?: number
  }

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
  {
    strict = false,
    allowNonSafeIntegers = !strict,
    maxNestedLevels = strict
      ? MAX_CBOR_NESTED_LEVELS
      : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? MAX_CBOR_CONTAINER_LEN : Infinity,
    maxObjectKeyLen = strict ? MAX_CBOR_OBJECT_KEY_LEN : Infinity,
    maxRecursionDepth = MAX_RECURSION_DEPTH_DEFAULT,
  }: LexToJsonOptions = {},
): JsonValue {
  // See ./lex-to-json.bench.ts for performance comparison of recursive vs.
  // iterative implementations of this function. The recursive implementation is
  // more performant but fails at deep nesting levels (e.g. > 1,000). We use a
  // hybrid approach where we start with the recursive implementation, but if we
  // detect that the nesting level is too deep, we switch to the iterative
  // implementation using iterativeTransform, which can handle arbitrary nesting
  // levels.

  if (maxRecursionDepth <= 0) {
    return iterativeTransform(input, encodeSpecialJsonObject, {
      strict,
      allowNonSafeIntegers,
      maxNestedLevels,
      maxContainerLength,
      maxObjectKeyLen,
    }) as JsonValue
  }

  return lexToJsonHybrid(input, {
    currentDepth: 1,
    maxRecursionDepth:
      // Optimization: we use Math.min when creating the context so that the
      // most common case (currentDepth < maxRecursionDepth && currentDepth <
      // maxNestedLevels) can be checked with a single condition when processing
      // nested structures (type "object")
      Math.min(maxRecursionDepth, maxNestedLevels),

    strict,
    allowNonSafeIntegers,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
  })
}

type RecursionContext = Required<LexToJsonOptions> & {
  currentDepth: number
  maxRecursionDepth: number
}

function lexToJsonHybrid(
  input: LexValue,
  context: RecursionContext,
): JsonValue {
  switch (typeof input) {
    case 'object': {
      if (input === null) {
        return input
      }

      if (context.currentDepth >= context.maxRecursionDepth) {
        if (context.currentDepth >= context.maxNestedLevels) {
          throw new TypeError(`Input is too deeply nested`)
        }

        // Switch to iterative implementation to handle deeper nesting levels
        // without hitting recursive call stack limits.
        return iterativeTransform(input, encodeSpecialJsonObject, {
          ...context,
          // We need to adjust maxNestedLevels to account for the current depth,
          // so that the iterative implementation can enforce the correct
          // nesting limit.
          maxNestedLevels: context.maxNestedLevels - context.currentDepth,
        }) as JsonValue
      }

      if (Array.isArray(input)) {
        return lexArrayToJsonHybrid(input, context)
      } else {
        return (
          encodeSpecialJsonObject(input) ??
          lexMapToJsonHybrid(input as LexMap, context)
        )
      }
    }
    case 'string':
    case 'boolean':
      return input
    case 'number':
      if (context.allowNonSafeIntegers) return input
      if (Number.isSafeInteger(input)) return input
      throw new TypeError(`Invalid non-safe integer: ${input}`)
    default:
      throw new TypeError(`Invalid Lex value: ${typeof input}`)
  }
}

function lexArrayToJsonHybrid(
  input: LexArray,
  context: RecursionContext,
): JsonValue[] {
  if (input.length > context.maxContainerLength) {
    throw new TypeError(`Array is too long (length ${input.length})`)
  }

  if (!input.length) {
    return input as JsonValue[]
  }

  context.currentDepth++

  // Lazily copy value
  let copy: LexArray | undefined

  for (let index = 0; index < input.length; index++) {
    const inputItem = input[index]
    const item = lexToJsonHybrid(inputItem, context)
    if (item !== inputItem) {
      copy ??= [...input]
      copy[index] = item
    }
  }

  context.currentDepth--

  return (copy ?? input) as JsonValue[]
}

function lexMapToJsonHybrid(
  input: LexMap,
  context: RecursionContext,
): JsonObject {
  const entries = Object.entries(input)

  if (entries.length > context.maxContainerLength) {
    throw new TypeError(
      `Object has too many entries (length ${entries.length})`,
    )
  }

  if (!entries.length) {
    return input as JsonObject
  }

  context.currentDepth++

  // Lazily copy value
  let copy: LexMap | undefined = undefined

  for (const [key, lexValue] of entries) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError(`Forbidden "__proto__" key`)
    }

    if (!validateMaxUtf8Length(key, context.maxObjectKeyLen)) {
      const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
      throw new TypeError(`Object key is too long (${keyStr})`)
    }

    // Ignore (strip) undefined values
    if (lexValue === undefined) {
      copy ??= { ...input }
      delete copy[key]
    } else {
      const jsonValue = lexToJsonHybrid(lexValue!, context)
      if (jsonValue !== lexValue) {
        copy ??= { ...input }
        copy[key] = jsonValue
      }
    }
  }

  context.currentDepth--

  return (copy ?? input) as JsonObject
}
