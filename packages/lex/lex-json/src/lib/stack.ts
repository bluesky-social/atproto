// This module defines utilities for working with a nested data structures (like
// JSON). It includes the definition of a stack used for iterative traversal of
// nested structures (instead of recursion).
//
// The main purpose of this module is to support the implementation of
// `iterativeTransform` and `jsonStringifyDeep`, which need to traverse and
// transform deeply nested structures without hitting call stack limits.
//
// An added benefit of using a custom stack implementation is that it can
// provide informative error messages when the input data is invalid (e.g. too
// deeply nested, contains circular references, etc.).

import {
  MAX_CBOR_CONTAINER_LEN,
  MAX_CBOR_NESTED_LEVELS,
  MAX_CBOR_OBJECT_KEY_LEN,
} from '@atproto/lex-data'
import { validateMaxUtf8Length } from './validate-max-utf8-length'

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

export type PathSegment = string | number
export type StackOptions = {
  /**
   * The maximum allowed depth of nested structures. If the input exceeds this
   * depth, an error will be thrown.
   *
   * @default MAX_CBOR_NESTED_LEVELS
   */
  maxNestedLevels?: number
  /**
   * The maximum allowed length of arrays and objects. If the input exceeds this
   * length, an error will be thrown.
   *
   * @default MAX_CBOR_CONTAINER_LEN
   */
  maxContainerLength?: number
  /**
   * The maximum allowed length of object keys. If a key exceeds this length, an
   * error will be thrown.
   *
   * @default MAX_CBOR_OBJECT_KEY_LEN
   */
  maxObjectKeyLen?: number
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
  private readonly options: Required<StackOptions>

  constructor(
    input: readonly unknown[] | object,
    {
      maxNestedLevels = MAX_CBOR_NESTED_LEVELS,
      maxContainerLength = MAX_CBOR_CONTAINER_LEN,
      maxObjectKeyLen = MAX_CBOR_OBJECT_KEY_LEN,
    }: StackOptions = {},
  ) {
    // @NOTE createFrame requires the options to be set on the instance.
    this.options = {
      maxNestedLevels,
      maxContainerLength,
      maxObjectKeyLen,
    }

    const frame = this.createFrame(input)
    this.root = frame
    this.stack = [frame]
  }

  get value() {
    return this.root.copy ?? this.root.input
  }

  pop(): StackFrame | TCustom | undefined {
    return this.stack.pop()
  }

  push(frame: StackFrame | TCustom): void {
    this.stack.push(frame)
  }

  pushNested(input: readonly unknown[] | object, parent: ParentRef): void {
    const { options } = this

    if (parent.frame.depth >= options.maxNestedLevels) {
      throw new TypeError(`Input is too deeply nested`)
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
      // 100 frames) to avoid excessive overhead. Otherwise, we rely on the
      // nesting limit (see "if" statement above) to prevent infinite loops,
      // which should be sufficient for all data.

      // Check for circular reference by walking up the parent chain
      let current: ParentRef | undefined = parent
      // If a copy was made, we can stop checking for circular references
      // since the copy cannot be part of the original input structure
      while (current && current.frame.copy == null) {
        if (current.frame.input === input) {
          throw new TypeError(`Circular reference detected`)
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
        throw new TypeError(`Array is too long (length ${input.length})`)
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
          `Object has too many entries (length ${entries.length})`,
        )
      }

      for (let index = 0; index < entries.length; index++) {
        const key = entries[index][0]
        if (key === '__proto__') {
          throw new TypeError(`Forbidden "__proto__" key`)
        }
        if (!validateMaxUtf8Length(key, this.options.maxObjectKeyLen)) {
          const keyStr = `${JSON.stringify(key.slice(0, 10)).slice(0, -1)}\u2026"`
          throw new TypeError(`Object key is too long (${keyStr})`)
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
export function isArrayFrame<T extends { type: string }>(
  frame: T,
): frame is Extract<T, { type: 'array' }> {
  return frame.type === 'array'
}

/** @internal */
export function isObjectFrame<T extends { type: string }>(
  frame: T,
): frame is Extract<T, { type: 'object' }> {
  return frame.type === 'object'
}

export function getCopy(frame: ArrayFrame): unknown[]
export function getCopy(frame: ObjectFrame): Record<string, unknown>
export function getCopy(frame: StackFrame): unknown {
  if (isArrayFrame(frame)) {
    return (frame.copy ??= performCopy(frame.parent, [...frame.input]))
  } else {
    return (frame.copy ??= performCopy(frame.parent, { ...frame.input }))
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
  // We stop once we reach a parent that already has a copy. Note that we cannot
  // use recursion here since the parent chain can be arbitrarily long (up to
  // the maxNestedLevels limit).
  while (currentParent) {
    if (currentParent.frame.copy != null) {
      if (isArrayFrame(currentParent.frame)) {
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
