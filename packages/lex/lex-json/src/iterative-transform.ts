import { Stack, StackOptions, getCopy, isArrayFrame } from './lib/stack.js'

const OMIT = Symbol('OMIT')
const OBJECT = Symbol('object')

export type IterativeTransformOptions = StackOptions & TransformValueOptions

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
 * stack size, by using an iterative approach with an explicit stack instead of
 * recursion. It also handles cyclic references by keeping track of visited
 * parent objects.
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
export function iterativeTransform<
  O extends IterativeTransformOptions = IterativeTransformOptions,
>(
  input: unknown,
  replacer: (child: object, options: O) => unknown,
  options: O = {} as O,
): unknown {
  const inputValue = transformValue(input, replacer, options)
  if (inputValue === OMIT) {
    throw new TypeError('Invalid undefined value')
  }
  if (inputValue !== OBJECT) {
    return inputValue
  }

  const stack = new Stack(input as object, options)

  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    if (isArrayFrame(frame)) {
      const { input } = frame // ArrayFrame

      for (let index = 0; index < input.length; index++) {
        const value = input[index]

        const result = transformValue(value, replacer, options)
        if (result === OBJECT) {
          stack.pushNested(value as object, { frame, index })
        } else if (result === OMIT) {
          // Undefined values in arrays are not allowed by lex-data.
          throw new TypeError(`Invalid undefined value`)
        } else {
          // Leaf value. If the replacer returned a different value, we need to
          // create a copy. Otherwise we can keep the original input value since
          // it is unchanged.
          if (result !== value) {
            const copy = getCopy(frame)
            copy[index] = result
          }
        }
      }
    } else {
      const { entries } = frame // ObjectFrame

      for (let index = 0; index < entries.length; index++) {
        const value = entries[index][1]
        const result = transformValue(value, replacer, options)
        if (result === OBJECT) {
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

  return stack.value
}

type TransformValueOptions = {
  /** @default true */
  allowNonSafeIntegers?: boolean
}

function transformValue<
  TInput,
  TOptions extends TransformValueOptions,
  TReplacer extends (child: TInput & object, options: TOptions) => any,
>(
  value: TInput,
  replacer: TReplacer,
  options: TOptions,
): typeof OBJECT | typeof OMIT | TInput | ReturnType<TReplacer> {
  switch (typeof value) {
    case 'object': {
      if (value === null) return value
      if (Array.isArray(value)) return OBJECT

      const transformed = replacer(value, options)
      if (transformed !== undefined) return transformed

      return OBJECT
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
      // Return sentinel to indicate this property should be omitted
      // (matching JSON.stringify behavior for object properties)
      return OMIT
    default:
      throw new TypeError(`Invalid ${typeof value} value`)
  }
}
