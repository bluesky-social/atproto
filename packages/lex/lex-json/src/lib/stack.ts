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

export type StackOptions = {
  /**
   * The maximum allowed depth of nested structures. If the input exceeds this
   * depth, a TypeError will be thrown.
   */
  maxNestedLevels: number
  /**
   * The maximum allowed length of arrays and objects. If the input exceeds this
   * length, a TypeError will be thrown.
   */
  maxContainerLength: number
  /**
   * The maximum allowed length of object keys. If a key exceeds this length, a
   * TypeError will be thrown.
   */
  maxObjectKeyLen: number
}

/**
 * A stack data structure for managing iterative traversal of nested JSON
 * structures. Encapsulates the stack operations and length/nesting factor
 * checking.
 *
 * @internal
 */
export class Stack<TCustom extends NonNullable<unknown> = never> {
  public readonly root: StackFrame

  private readonly stack: (StackFrame | TCustom)[]

  constructor(
    input: readonly unknown[] | object,
    private readonly options: Required<StackOptions>,
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

    if (parent.frame.depth >= options.maxNestedLevels) {
      throw new TypeError(
        `Input is too deeply nested at ${stringifyPath(parent)}`,
      )
    }

    if (
      options.maxNestedLevels === Infinity &&
      parent.frame.depth > 100 &&
      parent.frame.depth % 100 === 0
    ) {
      // @NOTE Traversing the parentRef chain on every frame creation can add
      // significant overhead (O(n^2)) to processing large structures especially
      // when there are no cycles. Since lexicon data should never have cycles
      // (as it is impossible to represent cycles in JSON / CBOR), we perform
      // this check only if there is a risk of creating an infinite loop (i.e.
      // when maxNestedLevels is Infinity), and only at certain intervals (every
      // 100 frames) to avoid excessive overhead. Otherwise,
      // we rely on the nesting limit to prevent infinite loops, which should be
      // sufficient for all data.

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

  private createFrame(
    input: readonly unknown[] | object,
    parent?: ParentRef,
  ): StackFrame {
    if (Array.isArray(input)) {
      if (input.length > this.options.maxContainerLength) {
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

      if (entries.length > this.options.maxContainerLength) {
        throw new TypeError(
          `Object has too many entries (length ${entries.length}) at ${stringifyPath(parent)}`,
        )
      }

      if (this.options.maxObjectKeyLen !== Infinity) {
        for (let index = 0; index < entries.length; index++) {
          const key = entries[index][0]
          if (key.length > this.options.maxObjectKeyLen) {
            throw new TypeError(
              `Object key is too long (length ${key.length}) at ${stringifyPath(parent)}`,
            )
          }
        }
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
const ERROR_PATH_MAX_DEPTH = 10

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
