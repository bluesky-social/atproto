const STRICT_DEPTH_LIMIT = 250
const LENIENT_DEPTH_LIMIT = 5_000

const MAX_ARRAY_LENGTH = 10_000

const ERROR_PATH_MAX_DEPTH = 10

export type JsonTransformOptions = {
  strict?: boolean
  maxDepth?: number
}

/**
 * Recursively transforms a value by applying a transformation function to all
 * nested *objects*. If the transform function returns a non-undefined value,
 * that value is used in place of the original (without further transformation
 * of its children). If the transform function returns undefined, the original
 * value is used (after transforming its children).
 *
 * In any transformation was applied to a branch of the nested input structure,
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
  transform: (child: object) => any,
  {
    strict = false,
    maxDepth = strict ? STRICT_DEPTH_LIMIT : LENIENT_DEPTH_LIMIT,
  }: JsonTransformOptions = {},
): T {
  const scalar = transformPrimitive(input, transform, strict)
  if (scalar !== undefined) return scalar as T

  const root: StackFrame = Array.isArray(input)
    ? { type: 'array', depth: 0, copy: null, input }
    : { type: 'object', depth: 0, copy: null, input: input as object }
  const stack: StackFrame[] = [root]

  while (stack.length > 0) {
    const frame = stack.pop()!

    if (frame.type === 'array') {
      const { depth, input, parent } = frame // ArrayFrame

      // Avoid CodeQL / Loop bound injection
      if (input.length > MAX_ARRAY_LENGTH) {
        throw new TypeError(
          `Array is too long (length ${input.length}) at ${stringifyPath(parent)}`,
        )
      }

      for (let index = 0; index < input.length; index++) {
        const child = input[index]

        const result = transformPrimitive(child, transform, strict)
        if (result !== undefined) {
          if (result !== child) {
            frame.copy ??= performCopy(parent, input.slice())
            frame.copy[index] = result
          }
        } else {
          addToStack(stack, depth, child as object, { frame, index }, maxDepth)
        }
      }
    } else {
      const { depth, input, parent } = frame // ObjectFrame

      for (const [key, child] of Object.entries(input) as [string, unknown][]) {
        const result = transformPrimitive(child, transform, strict)
        if (result !== undefined) {
          if (result !== child) {
            frame.copy ??= performCopy(parent, { ...input })
            frame.copy[key] = result
          }
        } else {
          addToStack(stack, depth, child as object, { frame, key }, maxDepth)
        }
      }
    }
  }

  return (root.copy ?? root.input) as T
}

type ArrayFrame = {
  type: 'array'
  depth: number
  parent?: ParentRef
  input: readonly unknown[]
  copy: null | unknown[]
}

type ObjectFrame = {
  type: 'object'
  depth: number
  parent?: ParentRef
  input: object
  copy: null | Record<string, unknown>
}

type ParentRef =
  | { frame: ArrayFrame; index: number }
  | { frame: ObjectFrame; key: string }

type StackFrame = ArrayFrame | ObjectFrame

function addToStack(
  stack: StackFrame[],
  depth: number,
  child: object,
  parent: ParentRef,
  maxDepth: number,
) {
  if (depth >= maxDepth) {
    throw new TypeError(
      `Input is too deeply nested at ${stringifyPath(parent)}`,
    )
  }

  if (Array.isArray(child)) {
    stack.push({
      type: 'array',
      depth: depth + 1,
      parent,
      input: child,
      copy: null,
    })
  } else {
    stack.push({
      type: 'object',
      depth: depth + 1,
      parent,
      input: child as object,
      copy: null,
    })
  }
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
      if (isArrayParent(currentParent)) {
        currentParent.frame.copy[currentParent.index] = currentCopy
      } else {
        currentParent.frame.copy[currentParent.key] = currentCopy
      }

      // If the parent already has a copy, it means we've already propagated the
      // new value up to that point, so we can stop here since the rest of the
      // chain already points to the new copy.
      break
    }

    // We need to create a copy of the parent's input, and save the current
    // copy in the appropriate key/index, so that the parent frame now points to
    if (isArrayParent(currentParent)) {
      currentParent.frame.copy = currentParent.frame.input.slice()
      currentParent.frame.copy[currentParent.index] = currentCopy
    } else {
      currentParent.frame.copy = { ...currentParent.frame.input }
      currentParent.frame.copy[currentParent.key] = currentCopy
    }

    currentCopy = currentParent.frame.copy
    currentParent = currentParent.frame.parent
  }

  return newValue
}

function isArrayParent<T extends { frame: { type: string } }>(
  ref: T,
): ref is Extract<T, { frame: { type: 'array' } }> {
  return ref.frame.type === 'array'
}

function transformPrimitive(
  input: unknown,
  transform: (child: object) => any,
  strictMode: boolean,
  parent?: ParentRef,
): unknown {
  switch (typeof input) {
    case 'object':
      if (input === null) return input
      if (!Array.isArray(input)) return transform(input)
      return undefined
    case 'number': {
      if (!strictMode) return input
      if (Number.isSafeInteger(input)) return input

      throw new TypeError(
        `Invalid number (got ${input}) at ${stringifyPath(parent)}`,
      )
    }
    case 'boolean':
    case 'string':
      return input
    default:
      throw new TypeError(`Invalid ${typeof input} at ${stringifyPath(parent)}`)
  }
}

function stringifyPath(parent?: ParentRef): string {
  const segments: ParentRef[] = []

  while (parent) {
    segments.push(parent)
    parent = parent.frame.parent
  }

  if (segments.length > ERROR_PATH_MAX_DEPTH) {
    return `$${segments.slice(-ERROR_PATH_MAX_DEPTH).reverse().map(stringifyParentRefIndex).join('')}(...)`
  }

  return `$${segments.reverse().map(stringifyParentRefIndex).join('')}`
}

function stringifyParentRefIndex(parent: ParentRef): string {
  if (isArrayParent(parent)) {
    return `[${parent.index}]`
  } else if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(parent.key)) {
    return `.${parent.key}`
  } else {
    return `[${JSON.stringify(parent.key)}]`
  }
}
