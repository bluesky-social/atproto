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
 * Options for {@link lexToJson} function.
 *
 * @see {@link IterativeTransformOptions}
 * @see {@link SpecialJsonObjectOptions}
 */
export type LexToJsonOptions = IterativeTransformOptions &
  SpecialJsonObjectOptions

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
    maxNestedLevels = strict
      ? MAX_CBOR_NESTED_LEVELS
      : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? MAX_CBOR_CONTAINER_LEN : Infinity,
    maxObjectKeyLen = strict ? MAX_CBOR_OBJECT_KEY_LEN : Infinity,
  }: LexToJsonOptions = {},
): JsonValue {
  // See ./lex-to-json.bench.ts for performance comparison of recursive vs.
  // iterative implementations of this function. The recursive implementation is
  // more performant but fails at deep nesting levels (e.g. > 1,000). We use a
  // hybrid approach where we start with the recursive implementation, but if we
  // detect that the nesting level is too deep, we switch to the iterative
  // implementation using iterativeTransform, which can handle arbitrary nesting
  // levels. This is equivalent to:

  // return iterativeTransform(input, encodeSpecialJsonObject, {
  //   strict,
  //   allowNonSafeIntegers,
  //   maxNestedLevels,
  //   maxContainerLength,
  //   maxObjectKeyLen,
  // }) as JsonValue

  return lexToJsonHybrid(input, {
    currentDepth: 1,
    strict,
    allowNonSafeIntegers,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
  })
}

type RecursionContext = Required<LexToJsonOptions> & {
  currentDepth: number
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

      if (context.currentDepth >= context.maxNestedLevels) {
        throw new TypeError(`Input is too deeply nested`)
      } else if (context.currentDepth > 500) {
        // If current recursion level is too deep, switch to a non-recursive
        // implementation to handle deeper nesting levels without hitting call
        // stack limits. The threshold of 500 is chosen based on empirical
        // testing, but can be adjusted as needed.
        return iterativeTransform(input, encodeSpecialJsonObject, {
          ...context,
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

  for (let i = 0; i < input.length; i++) {
    const inputItem = input[i]
    const item = lexToJsonHybrid(inputItem, context)
    if (item !== inputItem) {
      copy ??= [...input]
      copy[i] = item
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
      continue
    }

    const jsonValue = lexToJsonHybrid(lexValue!, context)
    if (jsonValue !== lexValue) {
      copy ??= { ...input }
      copy[key] = jsonValue
    }
  }

  context.currentDepth--

  return (copy ?? input) as JsonObject
}
