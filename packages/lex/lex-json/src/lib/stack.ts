// This module defines utilities for working with a nested JSON like data
// structure. It includes the definition of a stack frame used for iterative
// traversal of nested structures, as well as functions for creating stack
// frames and stringifying error paths.
//
// The main purpose of this module is to support the implementation of
// `jsonTransform`, which needs to traverse and transform deeply nested
// structures without hitting call stack limits, and provide informative error
// messages when the input data is invalid (e.g. too deeply nested, contains
// circular references, etc.).
//
// The `stringifyPath` function is used to generate human-readable paths for
// error messages, which can help identify where in the input structure an error
// occurred.
//
// The stack frame structure also includes checks for maximum depth and maximum
// array/object size limits, which can help prevent excessive resource usage
// when processing untrusted input data.

const ERROR_PATH_MAX_DEPTH = 10

export const MAX_DEPTH_STRICT = 100
export const MAX_DEPTH = 5_000
export const MAX_ARRAY_LENGTH = 10_000
export const MAX_OBJECT_ENTRIES = 10_000
export const MAX_NESTING_FACTOR = 100_000
export const MAX_NESTING_FACTOR_STRICT = 10_000

/** @internal */
export type ArrayFrame = {
  type: 'array'
  depth: number
  parent?: ParentRef
  input: readonly unknown[]
  copy: undefined | unknown[]
}

/** @internal */
export type ObjectFrame = {
  type: 'object'
  depth: number
  parent?: ParentRef
  input: object
  entries: readonly [string, unknown][]
  copy: undefined | Record<string, unknown>
}

/** @internal */
export type ParentRef =
  | { frame: ArrayFrame; index: number }
  | { frame: ObjectFrame; index: number }

/** @internal */
export type StackFrame = ArrayFrame | ObjectFrame

/** @internal */
export type StackFrameOptions = {
  /**
   * Maximum depth to serialize. This is a safeguard against infinite recursion
   * in case of circular references.
   *
   * @default MAX_DEPTH
   */
  maxDepth: number
  /**
   * Maximum length of arrays to serialize. This is a safeguard against
   * excessively large arrays.
   *
   * @default MAX_ARRAY_LENGTH
   */
  maxArrayLength: number
  /**
   * Maximum number of entries in objects to serialize. This is a safeguard
   * against excessively large objects.
   *
   * @default MAX_OBJECT_ENTRIES
   */
  maxObjectEntries: number
}

/** @internal */
export function createStackFrame(
  input: readonly unknown[],
  parent: undefined | ParentRef,
  options: StackFrameOptions,
): ArrayFrame
export function createStackFrame(
  input: object,
  parent: undefined | ParentRef,
  options: StackFrameOptions,
): ObjectFrame
export function createStackFrame(
  input: readonly unknown[] | object,
  parent: undefined | ParentRef,
  options: StackFrameOptions,
): StackFrame {
  // Check depth limit
  if (parent && parent.frame.depth > 0) {
    // @NOTE Traversing the parentRef chain on every frame creation can add
    // significant overhead (O(n^2)) to processing large structures especially
    // when there are no cycles. Since lexicon data should never have cycles
    // (as it is impossible to represent cycles in JSON / CBOR), we perform
    // this check only if there is a risk of creating an infinite loop (i.e.
    // when maxDepth is set to Infinity), and only at certain intervals (every
    // 50 frames) to avoid excessive overhead. Otherwise, we rely on the
    // depth limit to prevent infinite loops, which should be sufficient for
    // well-formed input data.
    if (options.maxDepth === Infinity) {
      if (parent.frame.depth % 50 === 0) {
        // Check for circular reference by walking up the parent chain
        let currentParent: ParentRef | undefined = parent
        // If a copy was made, we can stop checking for circular references
        // since the copy cannot be part of the original input structure
        while (currentParent && currentParent.frame.copy == null) {
          if (currentParent.frame.input === input) {
            throw new TypeError(
              `Circular reference detected at ${stringifyPath(parent)}`,
            )
          }
          currentParent = currentParent.frame.parent
        }
      }
    } else if (parent.frame.depth >= options.maxDepth) {
      throw new TypeError(
        `Input is too deeply nested at ${stringifyPath(parent)}`,
      )
    }
  }

  if (Array.isArray(input)) {
    // CodeQL: Avoid Loop bound injection
    if (input.length > options.maxArrayLength) {
      throw new TypeError(
        `Array is too long (length ${input.length}) at ${stringifyPath(parent)}`,
      )
    }

    return {
      type: 'array',
      depth: parent ? parent.frame.depth + 1 : 0,
      parent,
      input,
      copy: undefined,
    }
  } else {
    const entries = Object.entries(input)

    if (entries.length > options.maxObjectEntries) {
      throw new TypeError(
        `Object has too many entries (length ${entries.length}) at ${stringifyPath(parent)}`,
      )
    }

    return {
      type: 'object',
      depth: parent ? parent.frame.depth + 1 : 0,
      parent,
      input,
      entries,
      copy: undefined,
    }
  }
}

/** @internal */
export function isArrayFrame(frame: StackFrame): frame is ArrayFrame {
  return frame.type === 'array'
}

/**
 * Creates a nesting factor checker that tracks and validates the number of
 * nested objects/arrays processed.
 *
 * @param maxNestingFactor - Maximum allowed nesting factor
 * @returns A checker function that increments the counter and throws if exceeded
 * @internal
 */
export function createNestingFactorChecker(maxNestingFactor: number) {
  let currentNestingFactor = 1

  return (parent: ParentRef) => {
    if (currentNestingFactor >= maxNestingFactor) {
      throw new TypeError(
        `Input is too large (exceeds max nesting factor of ${maxNestingFactor}) at ${stringifyPath(parent)}`,
      )
    }
    currentNestingFactor++
  }
}

/** @internal */
export function stringifyPath(parent?: ParentRef): string {
  const segments = flattenParentChain(parent).reverse()

  if (segments.length > ERROR_PATH_MAX_DEPTH) {
    const truncatedSegments = segments
      .slice(-ERROR_PATH_MAX_DEPTH)
      .map(stringifyParentRefIndex)
    const lastSegment = stringifyParentRefIndex(segments[segments.length - 1])
    return `$${truncatedSegments.join('')}\u2026${lastSegment}`
  }

  return `$${segments.map(stringifyParentRefIndex).join('')}`
}

function flattenParentChain(parent?: ParentRef): ParentRef[] {
  const segments: ParentRef[] = []

  while (parent) {
    segments.push(parent)
    parent = parent.frame.parent
  }

  return segments
}

function stringifyParentRefIndex(parent: ParentRef): string {
  if (parent.frame.type === 'array') {
    return `[${parent.index}]`
  } else {
    const key = parent.frame.entries[parent.index][0]
    if (/^[a-zA-Z_$][a-zA-Z0-9_]*$/.test(key)) {
      return `.${key}`
    } else {
      return `[${JSON.stringify(key)}]`
    }
  }
}
