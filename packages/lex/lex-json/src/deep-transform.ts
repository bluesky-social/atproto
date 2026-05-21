import {
  MAX_CBOR_CONTAINER_LEN,
  MAX_CBOR_NESTED_LEVELS,
  MAX_CBOR_OBJECT_KEY_LEN,
  MAX_PAYLOAD_NESTED_LEVELS,
} from '@atproto/lex-data'
import { MAX_RECURSION_DEPTH_DEFAULT } from './constants.js'
import { Stack, StackOptions, getCopy, isArrayFrame } from './lib/stack.js'
import { validateMaxUtf8Length } from './lib/validate-max-utf8-length.js'
import { SpecialJsonObjectOptions } from './special-objects.js'

const OMIT = Symbol('OMIT')
const NESTED = Symbol('NESTED')

export type DeepTransformOptions = StackOptions &
  SpecialJsonObjectOptions & {
    /**
     * Maximum recursion depth before switching to an iterative implementation.
     * Set this only if you have either performances issues with the default
     * value, or your environment has a low call stack limit and you need to
     * support deeper nesting levels.
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

    /**
     * @default !strict
     */
    allowNonSafeIntegers?: boolean
  }

/**
 * Recursively transforms a value by applying a replacer function to all nested
 * *objects*. If the replacer function returns a non-undefined value, that value
 * is used in place of the original (without further transformation of its
 * children). If the replacer function returns undefined, the original value is
 * used (after transforming its children).
 *
 * If any transformation was applied to a branch of the nested input structure,
 * the function returns a new object/array with the transformations applied
 * (i.e. it does not mutate the original input). If no transformations were
 * applied, the original input is returned.
 *
 * This function supports deeply nested structures that exceed the maximum call
 * stack size, by falling back to an iterative approach with an explicit stack
 * instead of recursion after a certain depth.
 *
 * The main purpose of this function if to transform data structures, without
 * hitting call stack limits, and without mutating the original input.
 *
 * **IMPORTANT NOTE** the replacer should ALWAYS return a custom value for
 * non-plain objects (e.g. Cids, Blobs, etc.) to avoid traversing into them,
 * which can cause issues (cyclic references, copy of custom classes into plain
 * objects, etc.).
 *
 * @internal
 */
export function deepTransform(
  input: unknown,
  replacer: (child: object, context: TransformationContext) => unknown,
  {
    strict = false,
    allowNonSafeIntegers = !strict,
    maxNestedLevels = strict
      ? MAX_CBOR_NESTED_LEVELS
      : MAX_PAYLOAD_NESTED_LEVELS,
    maxContainerLength = strict ? MAX_CBOR_CONTAINER_LEN : Infinity,
    maxObjectKeyLen = strict ? MAX_CBOR_OBJECT_KEY_LEN : Infinity,
    maxRecursionDepth = MAX_RECURSION_DEPTH_DEFAULT,
    initialNestedLevel = 0,
  }: DeepTransformOptions = {},
): unknown {
  return deepTransformRecursive(input, replacer, {
    strict,
    allowNonSafeIntegers,
    initialNestedLevel,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
    maxRecursionDepth,
  })
}

type TransformationContext = {
  strict: boolean
  /**
   * initialNestedLevel is used to track the current nesting level during the
   * transformation, and then used as option for the Stack when switching to the
   * iterative implementation (this allows avoiding to create a new option
   * object every time we switch to the iterative implementation)
   */
  initialNestedLevel: number
  allowNonSafeIntegers: boolean
  maxRecursionDepth: number
  maxContainerLength: number
  maxNestedLevels: number
  maxObjectKeyLen: number
}

function deepTransformRecursive(
  input: unknown,
  replacer: (child: object, context: TransformationContext) => unknown,
  context: TransformationContext,
): unknown {
  switch (typeof input) {
    case 'object':
      if (input === null) return input
      break
    case 'number':
      if (context.allowNonSafeIntegers) return input
      if (Number.isSafeInteger(input)) return input
      throw new TypeError(`Invalid number (got ${input})`)
    case 'boolean':
    case 'string':
      return input
    default:
      throw new TypeError(`Invalid ${typeof input} input`)
  }

  // "input" is an object (or array)

  // Keep a reference to the initial nested level at which we started processing
  // this input, so that we can restore it after processing this input and its
  // children. This is more efficient than "context.initialNestedLevel++" and
  // "context.initialNestedLevel--" around the recursive calls as it saves the
  // JS engine from having to read the value before updating it.
  const { initialNestedLevel } = context

  if (initialNestedLevel > context.maxNestedLevels) {
    throw new TypeError(`Input is too deeply nested`)
  } else if (initialNestedLevel >= context.maxRecursionDepth) {
    // Switch to iterative implementation to handle deeper nesting levels
    // without hitting recursive call stack limits.
    return deepTransformIterative(input, replacer, context)
  }

  // @NOTE In order to avoid un-necessary increasing the call stack depth, we
  // inline the logic for processing arrays and plain objects instead of
  // creating dedicated functions. This allows us to only increase the call
  // stack depth for actual nested structures, allowing us to handle deeper
  // nesting levels with the recursive implementation before switching to the
  // (slower) iterative one.

  if (Array.isArray(input)) {
    if (input.length > context.maxContainerLength) {
      throw new TypeError(`Array is too long (length ${input.length})`)
    }

    if (!input.length) {
      return input
    }

    context.initialNestedLevel = initialNestedLevel + 1

    // Lazily copy value
    let copy: unknown[] | undefined

    for (let index = 0; index < input.length; index++) {
      const value = input[index]

      const valueTransformed = deepTransformRecursive(value, replacer, context)
      if (valueTransformed !== value) {
        copy ??= [...input]
        copy[index] = valueTransformed
      }
    }

    context.initialNestedLevel = initialNestedLevel

    return copy ?? input
  } else {
    // Value is an object, apply replacer to it before traversing into it.
    const valueTransformed = replacer(input, context)
    if (valueTransformed !== undefined) {
      return valueTransformed
    }

    context.initialNestedLevel = initialNestedLevel + 1

    // Lazily copy value
    let copy: { [key: string]: unknown } | undefined = undefined
    let count = 0

    for (const key in input) {
      count++

      // Prevent prototype pollution
      if (key === '__proto__') {
        throw new TypeError(`Forbidden "__proto__" key`)
      }

      if (count > context.maxContainerLength) {
        throw new TypeError(`Object has too many entries`)
      }

      if (context.maxObjectKeyLen !== Infinity) {
        if (!validateMaxUtf8Length(key, context.maxObjectKeyLen)) {
          const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
          throw new TypeError(`Object key is too long (${keyStr})`)
        }
      }

      // Ignore (strip) undefined values
      const value = (input as { [key: string]: unknown })[key]
      if (value === undefined) {
        copy ??= { ...input }
        delete copy[key]
      } else {
        const valueTransformed = deepTransformRecursive(
          value,
          replacer,
          context,
        )
        if (valueTransformed !== value) {
          copy ??= { ...input }
          copy[key] = valueTransformed
        }
      }
    }

    context.initialNestedLevel = initialNestedLevel

    return copy ?? input
  }
}

function deepTransformIterative(
  input: object,
  replacer: (child: object, context: TransformationContext) => unknown,
  context: TransformationContext,
): unknown {
  const stack = new Stack(input, context)

  for (const frame of stack) {
    if (isArrayFrame(frame)) {
      const { input } = frame

      for (let index = 0; index < input.length; index++) {
        const value = input[index]

        const valueTransformed = transformValue(value, replacer, context)
        if (valueTransformed === NESTED) {
          stack.pushNested(value as object, { frame, index })
        } else if (valueTransformed === OMIT) {
          // Undefined values in arrays are not allowed by lex-data.
          throw new TypeError(`Invalid undefined value`)
        } else if (valueTransformed !== value) {
          // If the replacer returned a different value, store it in a copy.
          const copy = getCopy(frame)
          copy[index] = valueTransformed
        } else {
          // Leaf value that was not transformed, we can keep it as is.
        }
      }
    } else {
      // ObjectFrame
      const { entries } = frame

      for (let index = 0; index < entries.length; index++) {
        const [key, value] = entries[index]

        const valueTransformed = transformValue(value, replacer, context)
        if (valueTransformed === NESTED) {
          stack.pushNested(value as object, { frame, index })
        } else if (valueTransformed === OMIT) {
          // Omit this property (undefined values should be removed)
          const copy = getCopy(frame)
          delete copy[key]
        } else if (valueTransformed !== value) {
          // If the replacer returned a different value, store it in a copy.
          const copy = getCopy(frame)
          copy[key] = valueTransformed
        } else {
          // Leaf value that was not transformed, we can keep it as is.
        }
      }
    }
  }

  return stack.root.copy ?? stack.root.input
}

function transformValue(
  value: unknown,
  replacer: (child: object, context: TransformationContext) => unknown,
  context: TransformationContext,
): typeof NESTED | typeof OMIT | unknown {
  switch (typeof value) {
    case 'object': {
      if (value === null) return value
      if (Array.isArray(value)) return NESTED

      const valueTransformed = replacer(value, context)
      if (valueTransformed !== undefined) {
        return valueTransformed
      }

      // Input is an object or array that needs further processing.
      return NESTED
    }
    case 'number':
      if (context.allowNonSafeIntegers) return value
      if (Number.isSafeInteger(value)) return value
      throw new TypeError(`Invalid number (got ${value})`)
    case 'boolean':
    case 'string':
      return value
    case 'undefined':
      return OMIT
    default:
      throw new TypeError(`Invalid ${typeof value} value`)
  }
}
