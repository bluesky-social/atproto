import { describe, expect, it } from 'vitest'
import {
  type ParentRef,
  type StackFrameOptions,
  createStackFrame,
  isArrayFrame,
  stringifyPath,
} from './stack-frame.js'

const DEFAULT_OPTIONS: StackFrameOptions = {
  maxDepth: 100,
  maxArrayLength: 10_000,
  maxObjectEntries: 10_000,
}

describe(createStackFrame, () => {
  it('creates root array frame', () => {
    const input = [1, 2, 3]
    const frame = createStackFrame(input, undefined, DEFAULT_OPTIONS)

    expect(frame.type).toBe('array')
    expect(frame.depth).toBe(0)
    expect(frame.parent).toBeUndefined()
    expect(frame.input).toBe(input)
    if (frame.type === 'array') {
      expect(frame.copy).toBeUndefined()
    }
  })

  it('creates root object frame', () => {
    const input = { a: 1, b: 2 }
    const frame = createStackFrame(input, undefined, DEFAULT_OPTIONS)

    expect(frame.type).toBe('object')
    expect(frame.depth).toBe(0)
    expect(frame.parent).toBeUndefined()
    expect(frame.input).toBe(input)
    if (frame.type === 'object') {
      expect(frame.entries).toEqual([
        ['a', 1],
        ['b', 2],
      ])
      expect(frame.copy).toBeUndefined()
    }
  })

  it('creates child frame with correct depth', () => {
    const rootInput = [1]
    const rootFrame = createStackFrame(rootInput, undefined, DEFAULT_OPTIONS)

    const childInput = { nested: true }
    const parent: ParentRef = { frame: rootFrame, index: 0 }
    const childFrame = createStackFrame(childInput, parent, DEFAULT_OPTIONS)

    expect(childFrame.depth).toBe(1)
    expect(childFrame.parent).toBe(parent)
  })

  it('throws on exceeding max depth', () => {
    const options: StackFrameOptions = {
      ...DEFAULT_OPTIONS,
      maxDepth: 2,
    }

    // Depth 0
    let frame = createStackFrame([], undefined, options)
    let parent: ParentRef = { frame, index: 0 }

    // Depth 1
    frame = createStackFrame([], parent, options)
    parent = { frame, index: 0 }

    // Depth 2 - at max depth, should still succeed
    frame = createStackFrame([], parent, options)
    parent = { frame, index: 0 }

    // Depth 3 - exceeds max depth, should throw
    expect(() => createStackFrame([], parent, options)).toThrow(
      /Input is too deeply nested at \$\[0\]\[0\]\[0\]/,
    )
  })

  it('throws on array exceeding max length', () => {
    const options: StackFrameOptions = {
      ...DEFAULT_OPTIONS,
      maxArrayLength: 5,
    }

    const longArray = Array.from({ length: 6 }, (_, i) => i)

    expect(() => createStackFrame(longArray, undefined, options)).toThrow(
      /Array is too long \(length 6\) at \$/,
    )
  })

  it('throws on object exceeding max entries', () => {
    const options: StackFrameOptions = {
      ...DEFAULT_OPTIONS,
      maxObjectEntries: 2,
    }

    const largeObject = { a: 1, b: 2, c: 3 }

    expect(() => createStackFrame(largeObject, undefined, options)).toThrow(
      /Object has too many entries \(length 3\) at \$/,
    )
  })

  it('detects circular references at depth 50', () => {
    const circularInput = [1, 2, 3]
    const options: StackFrameOptions = {
      ...DEFAULT_OPTIONS,
      maxDepth: Infinity, // Disable depth limit to force circular reference check
    }

    // Build a chain of 50 frames
    let input: unknown[] = circularInput
    let frame = createStackFrame(circularInput, undefined, options)
    let parent: ParentRef | undefined

    for (let i = 0; i < 50; i++) {
      input = [input]
      parent = { frame: frame, index: 0 }
      frame = createStackFrame(input, parent, options)
    }

    // At depth 50, trying to add the original input should detect the cycle
    parent = { frame: frame, index: 0 }
    expect(() => createStackFrame(circularInput, parent, options)).toThrow(
      'Circular reference detected',
    )
  })

  it('does not check circular references at depth 49', () => {
    const circularInput = [1, 2, 3]

    // Build a chain of 49 frames
    let frame = createStackFrame(circularInput, undefined, DEFAULT_OPTIONS)

    for (let i = 0; i < 49; i++) {
      frame = createStackFrame([i], { frame, index: 0 }, DEFAULT_OPTIONS)
    }

    // At depth 49, circular check is skipped (happens every 50 levels)
    expect(() =>
      createStackFrame(circularInput, { frame, index: 0 }, DEFAULT_OPTIONS),
    ).not.toThrow()
  })
})

describe('isArrayFrame', () => {
  it('returns true for array frames', () => {
    const frame = createStackFrame([1, 2, 3], undefined, DEFAULT_OPTIONS)
    expect(isArrayFrame(frame)).toBe(true)
  })

  it('returns false for object frames', () => {
    const frame = createStackFrame({ a: 1 }, undefined, DEFAULT_OPTIONS)
    expect(isArrayFrame(frame)).toBe(false)
  })
})

describe(stringifyPath, () => {
  it('returns "$" for undefined parent', () => {
    expect(stringifyPath(undefined)).toBe('$')
  })

  it('formats simple array index', () => {
    const frame = createStackFrame([1, 2, 3], undefined, DEFAULT_OPTIONS)
    const parent: ParentRef = { frame, index: 1 }
    expect(stringifyPath(parent)).toBe('$[1]')
  })

  it('formats simple object key (valid identifier)', () => {
    const frame = createStackFrame({ name: 'test' }, undefined, DEFAULT_OPTIONS)
    const parent: ParentRef = { frame, index: 0 }
    expect(stringifyPath(parent)).toBe('$.name')
  })

  it('formats object key with special characters', () => {
    const frame = createStackFrame({ 'my-key': 1 }, undefined, DEFAULT_OPTIONS)
    const parent: ParentRef = { frame, index: 0 }
    expect(stringifyPath(parent)).toBe('$["my-key"]')
  })

  it('formats object key with spaces', () => {
    const frame = createStackFrame(
      { 'key with spaces': 1 },
      undefined,
      DEFAULT_OPTIONS,
    )
    const parent: ParentRef = { frame, index: 0 }
    expect(stringifyPath(parent)).toBe('$["key with spaces"]')
  })

  it('formats numeric string keys', () => {
    const frame = createStackFrame(
      { '123': 'value' },
      undefined,
      DEFAULT_OPTIONS,
    )
    const parent: ParentRef = { frame, index: 0 }
    expect(stringifyPath(parent)).toBe('$["123"]')
  })

  it('formats nested paths', () => {
    const rootFrame = createStackFrame(
      { a: { b: [1, 2, 3] } },
      undefined,
      DEFAULT_OPTIONS,
    )
    const parent1: ParentRef = { frame: rootFrame, index: 0 } // .a

    const level2Frame = createStackFrame(
      { b: [1, 2, 3] },
      parent1,
      DEFAULT_OPTIONS,
    )
    const parent2: ParentRef = { frame: level2Frame, index: 0 } // .b

    const level3Frame = createStackFrame([1, 2, 3], parent2, DEFAULT_OPTIONS)
    const parent3: ParentRef = { frame: level3Frame, index: 1 } // [1]

    expect(stringifyPath(parent3)).toBe('$.a.b[1]')
  })

  it('truncates paths deeper than 10 levels', () => {
    let frame = createStackFrame([], undefined, DEFAULT_OPTIONS)
    let parent: ParentRef | undefined

    // Build a chain of 12 levels
    for (let i = 0; i < 12; i++) {
      parent = { frame: frame, index: i }
      frame = createStackFrame([], parent, DEFAULT_OPTIONS)
    }

    const path = stringifyPath(parent)

    // Should truncate and show ellipsis
    expect(path).toContain('…')
    // Should still show the last segment
    expect(path).toMatch(/\[11\]$/)
  })

  it('handles mixed array and object paths', () => {
    const rootFrame = createStackFrame(
      [{ items: [{ id: 1 }] }],
      undefined,
      DEFAULT_OPTIONS,
    )
    const parent1: ParentRef = { frame: rootFrame, index: 0 } // [0]

    const level2Frame = createStackFrame(
      { items: [] },
      parent1,
      DEFAULT_OPTIONS,
    )
    const parent2: ParentRef = { frame: level2Frame, index: 0 } // .items

    const level3Frame = createStackFrame([{ id: 1 }], parent2, DEFAULT_OPTIONS)
    const parent3: ParentRef = { frame: level3Frame, index: 0 } // [0]

    const level4Frame = createStackFrame({ id: 1 }, parent3, DEFAULT_OPTIONS)
    const parent4: ParentRef = { frame: level4Frame, index: 0 } // .id

    expect(stringifyPath(parent4)).toBe('$[0].items[0].id')
  })
})
