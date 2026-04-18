import {
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_DEPTH_STRICT,
  MAX_NESTING_FACTOR,
  MAX_NESTING_FACTOR_STRICT,
  MAX_OBJECT_ENTRIES,
  type ParentRef,
  Stack,
  StackOptions,
  isArrayFrame,
  stringifyPath,
} from './lib/stack.js'

const OMIT = Symbol('OMIT')
const OBJECT = Symbol('object')

export type JsonTransformOptions = Partial<StackOptions> &
  Partial<TransformValueOptions> & {
    /**
     * If true, the function will enforce stricter default options, such as
     * disallowing numbers that are not safe integers, and setting a lower maximum
     * depth limit.
     */
    strict?: boolean
  }

/**
 * Recursively transforms a value by applying a replacer function to all
 * nested *objects*. If the replacer function returns a non-undefined value,
 * that value is used in place of the original (without further transformation∏
 * of its children). If the replacer function returns undefined, the original
 * value is used (after transforming its children).
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
 * The main purpose of this function if to transform lex-data structures, which
 * can be deeply nested, but should always be bound in size and should never
 * contain cyclic references.
 *
 * The `strict` option can be used to enforce certain constraints on the input
 * data (namely disallowing numbers that are not safe integers, and forcing a
 * maximum depth limit), which can help catch errors in the input data.
 *
 * @internal
 */
export function jsonTransform<T>(
  input: unknown,
  replacer: (child: object) => unknown,
  {
    strict = false,
    allowNonInteger = !strict,
    maxNestingFactor = strict ? MAX_NESTING_FACTOR_STRICT : MAX_NESTING_FACTOR,
    maxDepth = strict ? MAX_DEPTH_STRICT : MAX_DEPTH,
    maxArrayLength = MAX_ARRAY_LENGTH,
    maxObjectEntries = MAX_OBJECT_ENTRIES,
  }: JsonTransformOptions = {},
): T {
  const options: TransformValueOptions = { allowNonInteger }

  const inputValue = transformValue(input, replacer, options)
  if (inputValue === OMIT) {
    // @NOTE That JSON.stringify(undefined) returns undefined (although it is
    // not typed as such in TypeScript, and not valid JSON). We disallow this
    // since it is not a valid JSON value and is likely an error in the input
    // data.
    throw new TypeError('Invalid undefined value at $')
  }
  if (inputValue !== OBJECT) {
    return inputValue as T
  }

  const stack = new Stack(input as object, {
    maxNestingFactor,
    maxDepth,
    maxArrayLength,
    maxObjectEntries,
  })

  for (const frame of stack) {
    if (frame.type === 'array') {
      const { input, parent } = frame // ArrayFrame

      for (let index = 0; index < input.length; index++) {
        const value = input[index]

        const result = transformValue(value, replacer, options)
        if (result === OBJECT) {
          stack.pushObject(value as object, { frame, index })
        } else if (result === OMIT) {
          // Undefined values in arrays are not allowed by lex-data.
          throw new TypeError(
            `Invalid undefined value at ${stringifyPath({ frame, index })}`,
          )
        } else {
          // Leaf value. If the replacer returned a different value, we need to
          // create a copy. Otherswise we can keep the original input value
          // since it is unchanged.
          if (result !== value) {
            frame.copy ??= performCopy(parent, input.slice())
            frame.copy[index] = result
          }
        }
      }
    } else {
      const { entries, parent } = frame // ObjectFrame

      for (let index = 0; index < entries.length; index++) {
        const value = entries[index][1]
        const result = transformValue(value, replacer, options)
        if (result === OBJECT) {
          stack.pushObject(value as object, { frame, index })
        } else if (result === OMIT) {
          // Omit this property (undefined values should be removed)
          frame.copy ??= performCopy(parent, Object.fromEntries(entries))
          delete frame.copy[entries[index][0]]
        } else {
          // Leaf value. If the replacer returned a different value, we need to
          // create a copy. Otherswise we can keep the original input value
          // since it is unchanged.
          if (result !== value) {
            frame.copy ??= performCopy(parent, Object.fromEntries(entries))
            frame.copy[entries[index][0]] = result
          }
        }
      }
    }
  }

  return (stack.root.copy ?? stack.root.input) as T
}

// When a transformation is applied to a value, we need to create a copy of all
// of its ancestors in the input structure, so that the transformation is
// applied immutably. This function performs that copying and returns the new
// value to use in place of the original transformed value. The `parent`
// argument is a reference to the parent frame in the stack, which contains the
// input object and the key/index of the current value being transformed.
function performCopy<T>(parent: ParentRef | undefined, newValue: T): T {
  let currentCopy: unknown = newValue
  let currentParent: ParentRef | undefined = parent

  // We need to propagate the copy up the parent chain, so that all ancestors of
  // the transformed node point to the new copy instead of the original input.
  // We stop once we reach a parent that already has a copy.
  while (currentParent) {
    if (currentParent.frame.copy != null) {
      if (currentParent.frame.type === 'array') {
        currentParent.frame.copy[currentParent.index] = currentCopy
      } else {
        const key = currentParent.frame.entries[currentParent.index][0]
        currentParent.frame.copy[key] = currentCopy
      }

      // If the parent already has a copy, it means we've already propagated the
      // new value up to that point, so we can stop here since the rest of the
      // chain already points to the new copy.
      break
    }

    // We need to create a copy of the parent's input, and save the current
    // copy in the appropriate key/index, so that the parent frame now points to
    if (isArrayFrame(currentParent.frame)) {
      currentParent.frame.copy = currentParent.frame.input.slice()
      currentParent.frame.copy[currentParent.index] = currentCopy
    } else {
      currentParent.frame.copy = Object.fromEntries(currentParent.frame.entries)
      const key = currentParent.frame.entries[currentParent.index][0]
      currentParent.frame.copy[key] = currentCopy
    }

    currentCopy = currentParent.frame.copy
    currentParent = currentParent.frame.parent
  }

  return newValue
}

type TransformValueOptions = {
  allowNonInteger: boolean
}

function transformValue<I, T extends (child: I & object) => any>(
  input: I,
  replacer: T,
  options: TransformValueOptions,
  parent?: ParentRef,
): typeof OBJECT | typeof OMIT | I | ReturnType<T> {
  switch (typeof input) {
    case 'object':
      if (input === null) return input
      if (!Array.isArray(input)) {
        const transformed = replacer(input)
        if (transformed !== undefined) return transformed
      }

      // We return a sentinel value to indicate that this is an object that
      // should be traversed
      return OBJECT
    case 'number': {
      if (options.allowNonInteger) return input
      if (Number.isSafeInteger(input)) return input

      throw new TypeError(
        `Invalid number (got ${input}) at ${stringifyPath(parent)}`,
      )
    }
    case 'boolean':
    case 'string':
      return input
    case 'undefined':
      // Return sentinel to indicate this property should be omitted
      // (matching JSON.stringify behavior for object properties)
      return OMIT
    default:
      throw new TypeError(`Invalid ${typeof input} at ${stringifyPath(parent)}`)
  }
}
