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
  return deepTransformUnknown(input, replacer, {
    strict,
    allowNonSafeIntegers,
    initialNestedLevel,
    maxNestedLevels,
    maxContainerLength,
    maxObjectKeyLen,
    // Optimization: we use Math.min when creating the context so that the most
    // common case (initialNestedLevel < maxRecursionDepth && initialNestedLevel
    // < maxNestedLevels) can be checked with a single condition when processing
    // nested structures (type "object"). This also allows deepTransformUnknown
    // to rely on deepTransformIterative solely for maxNestedLevels checks,
    // avoiding duplicated logic.
    maxRecursionDepth:
      maxRecursionDepth > maxNestedLevels ? maxNestedLevels : maxRecursionDepth,
  })
}

type TransformationContext = DeepTransformOptions & {
  initialNestedLevel: number
  maxRecursionDepth: number
  maxContainerLength: number
}

function deepTransformUnknown(
  input: unknown,
  replacer: (child: object, context: TransformationContext) => unknown,
  context: TransformationContext,
): unknown {
  switch (typeof input) {
    case 'object': {
      if (input === null) {
        return input
      }

      if (context.initialNestedLevel >= context.maxRecursionDepth) {
        // Switch to iterative implementation to handle deeper nesting levels
        // without hitting recursive call stack limits.

        // @NOTE max nested levels is checked in the iterative implementation
        return deepTransformIterative(input, replacer, context)
      }

      if (Array.isArray(input)) {
        return deepTransformArray(input, replacer, context)
      } else {
        return (
          replacer(input, context) ??
          deepTransformObject(input, replacer, context)
        )
      }
    }
    case 'number': {
      if (context.allowNonSafeIntegers) return input
      if (Number.isSafeInteger(input)) return input

      throw new TypeError(`Invalid number (got ${input})`)
    }
    case 'boolean':
    case 'string':
      return input
    default:
      throw new TypeError(`Invalid JSON value of type ${typeof input}`)
  }
}

function deepTransformArray(
  input: readonly unknown[],
  replacer: (child: object, context: TransformationContext) => unknown,
  context: TransformationContext,
): readonly unknown[] {
  if (input.length > context.maxContainerLength) {
    throw new TypeError(`Array is too long (length ${input.length})`)
  }

  if (!input.length) {
    return input
  }

  context.initialNestedLevel++

  // Lazily copy value
  let copy: unknown[] | undefined

  for (let index = 0; index < input.length; index++) {
    const inputItem = input[index]
    const item = deepTransformUnknown(inputItem, replacer, context)
    if (item !== inputItem) {
      copy ??= [...input]
      copy[index] = item
    }
  }

  context.initialNestedLevel--

  return copy ?? input
}

function deepTransformObject(
  input: Readonly<object>,
  replacer: (child: object, context: TransformationContext) => unknown,
  context: TransformationContext,
): unknown {
  const entries = Object.entries(input)

  if (entries.length > context.maxContainerLength) {
    throw new TypeError(
      `Object has too many entries (length ${entries.length})`,
    )
  }

  if (!entries.length) {
    return input
  }

  context.initialNestedLevel++

  // Lazily copy value
  let copy: { [key: string]: unknown } | undefined = undefined

  for (const [key, value] of entries) {
    // Prevent prototype pollution
    if (key === '__proto__') {
      throw new TypeError(`Forbidden "__proto__" key`)
    }

    if (!validateMaxUtf8Length(key, context.maxObjectKeyLen)) {
      const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
      throw new TypeError(`Object key is too long (${keyStr})`)
    }

    // Ignore (strip) undefined values
    if (value === undefined) {
      copy ??= { ...input }
      delete copy[key]
    } else {
      const converted = deepTransformUnknown(value, replacer, context)
      if (converted !== value) {
        copy ??= { ...input }
        copy[key] = converted
      }
    }
  }

  context.initialNestedLevel--

  return copy ?? input
}

function deepTransformIterative(
  input: unknown,
  replacer: (child: object, context: TransformationContext) => unknown,
  options: TransformationContext,
): unknown {
  const inputValue = transformValue(input, replacer, options)

  if (inputValue !== NESTED) {
    if (inputValue === OMIT) {
      throw new TypeError('Invalid undefined value')
    }
    return inputValue
  }

  const stack = new Stack(input as object, options)

  for (const frame of stack) {
    if (isArrayFrame(frame)) {
      const { input } = frame

      for (let index = 0; index < input.length; index++) {
        const value = input[index]

        const result = transformValue(value, replacer, options)
        if (result === NESTED) {
          stack.pushNested(value as object, { frame, index })
        } else if (result === OMIT) {
          // Undefined values in arrays are not allowed by lex-data.
          throw new TypeError(`Invalid undefined value`)
        } else {
          // Leaf value
          if (result !== value) {
            // If the replacer returned a different value, we need to obtain a
            // copy of the parent tree, and update the copy with the new value.
            const copy = getCopy(frame)
            copy[index] = result
          } else {
            // The value is unchanged, so we can keep the original input value.
          }
        }
      }
    } else {
      // ObjectFrame
      const { entries } = frame

      for (let index = 0; index < entries.length; index++) {
        const value = entries[index][1]
        const result = transformValue(value, replacer, options)
        if (result === NESTED) {
          stack.pushNested(value as object, { frame, index })
        } else if (result === OMIT) {
          // Omit this property (undefined values should be removed)
          const copy = getCopy(frame)
          delete copy[entries[index][0]]
        } else {
          // Leaf value. If the replacer returned a different value, we need to
          // create a copy. Otherwise we can keep the original input value since
          // it is unchanged.
          if (result !== value) {
            const copy = getCopy(frame)
            copy[entries[index][0]] = result
          }
        }
      }
    }
  }

  return stack.root.copy ?? stack.root.input
}

function transformValue(
  value: unknown,
  replacer: (child: object, context: TransformationContext) => unknown,
  options: TransformationContext,
): typeof NESTED | typeof OMIT | unknown {
  switch (typeof value) {
    case 'object': {
      if (value === null) return value
      if (Array.isArray(value)) return NESTED

      const transformed = replacer(value, options)
      if (transformed !== undefined) return transformed

      // Input is an object or array that needs further processing.
      return NESTED
    }
    case 'number': {
      if (options.allowNonSafeIntegers ?? true) return value
      if (Number.isSafeInteger(value)) return value

      throw new TypeError(`Invalid number (got ${value})`)
    }
    case 'boolean':
    case 'string':
      return value
    case 'undefined':
      return OMIT
    default:
      throw new TypeError(`Invalid ${typeof value} value`)
  }
}
