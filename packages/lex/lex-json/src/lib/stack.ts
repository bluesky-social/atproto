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
export const MAX_ARRAY_LENGTH = 1_000
export const MAX_OBJECT_ENTRIES = 1_000
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
export type StackOptions = {
  /**
   * Maximum depth to serialize. This is a safeguard against infinite recursion
   * in case of circular references.
   */
  maxDepth: number
  /**
   * Maximum length of arrays to serialize. This is a safeguard against
   * excessively large arrays.
   */
  maxArrayLength: number
  /**
   * Maximum number of entries in objects to serialize. This is a safeguard
   * against excessively large objects.
   */
  maxObjectEntries: number
  /**
   * Maximum nesting factor to serialize. This is a safeguard against
   * excessively large structures with many nested objects/arrays, even if they
   * do not exceed the max depth or max array/object size limits. The nesting
   * factor is calculated as the total number of nested objects/arrays in the
   * structure, which can grow much faster than the depth or size of individual
   * arrays/objects (e.g. a structure with 100 levels of nesting, but each level
   * is an array of 100 items, would have a total of 100^100 nested
   * objects/arrays, which would likely cause memory exhaustion even if the
   * depth limit is not exceeded).
   */
  maxNestingFactor: number
}

/**
 * A stack data structure for managing iterative traversal of nested JSON
 * structures. Encapsulates the stack operations and length/nesting factor
 * checking.
 *
 * @internal
 */
export class Stack<TCustom extends NonNullable<unknown> = never> {
  readonly root: StackFrame
  private readonly stack: (StackFrame | TCustom)[]
  private currentNestingFactor = 1

  constructor(
    input: readonly unknown[] | object,
    private readonly options: StackOptions,
  ) {
    const frame = this.createFrame(input)
    this.root = frame
    this.stack = [frame]
  }

  *[Symbol.iterator](): IterableIterator<StackFrame | TCustom> {
    // @NOTE we cannot use a simple for..of loop or yield* here since the array
    // will be mutated during iteration (new frames will be added / removed from
    // the stack).
    const { stack } = this
    for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
      yield frame
    }
  }

  pop(): StackFrame | TCustom | undefined {
    return this.stack.pop()
  }

  pushCustom(frame: TCustom): void {
    this.stack.push(frame)
  }

  pushObject(input: readonly unknown[] | object, parent: ParentRef): void {
    const { options } = this

    if (this.currentNestingFactor >= options.maxNestingFactor) {
      throw new TypeError(
        `Input is too large (exceeds max nesting factor of ${options.maxNestingFactor}) at ${stringifyPath(parent)}`,
      )
    }
    this.currentNestingFactor++

    if (parent.frame.depth >= options.maxDepth) {
      throw new TypeError(
        `Input is too deeply nested at ${stringifyPath(parent)}`,
      )
    } else if (
      parent.frame.depth >= 100 &&
      parent.frame.depth % 100 === 0 &&
      options.maxDepth === Infinity &&
      options.maxNestingFactor === Infinity
    ) {
      // @NOTE Traversing the parentRef chain on every frame creation can add
      // significant overhead (O(n^2)) to processing large structures especially
      // when there are no cycles. Since lexicon data should never have cycles
      // (as it is impossible to represent cycles in JSON / CBOR), we perform
      // this check only if there is a risk of creating an infinite loop (i.e.
      // when maxDepth and maxNestingFactor are both Infinity), and only at
      // certain intervals (every 100 frames) to avoid excessive overhead.
      // Otherwise, we rely on the depth limit to prevent infinite loops, which
      // should be sufficient for all data.

      // Check for circular reference by walking up the parent chain
      let current: ParentRef | undefined = parent
      // If a copy was made, we can stop checking for circular references
      // since the copy cannot be part of the original input structure
      while (current && current.frame.copy == null) {
        if (current.frame.input === input) {
          throw new TypeError(
            `Circular reference detected at ${stringifyPath(parent)}`,
          )
        }
        current = current.frame.parent
      }
    }

    this.stack.push(this.createFrame(input, parent))
  }

  createFrame(
    input: readonly unknown[] | object,
    parent?: ParentRef,
  ): StackFrame {
    if (Array.isArray(input)) {
      // Avoid Loop bound injection
      if (input.length > this.options.maxArrayLength) {
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

      // Avoid Loop bound injection
      if (entries.length > this.options.maxObjectEntries) {
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
}

/** @internal */
export function isArrayFrame(frame: StackFrame): frame is ArrayFrame {
  return frame.type === 'array'
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
