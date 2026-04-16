import { bench, describe } from 'vitest'
import { jsonStringifyDeep } from './json-stringify-deep.js'
import { JsonValue } from './json.js'

// This benchmark compares the performance of two implementations for
// serializing JSON values to JSON strings:
// - jsonStringifyDeep: Custom iterative implementation that handles deep nesting
// - JSON.stringify: Native implementation (will fail on very deep structures)

describe('small object', () => {
  benchData({
    string: 'Hello world! 👋',
    number: 42,
    bool: true,
    null: null,
  })
})

describe('simple nested structure', () => {
  benchData({
    nested: {
      array: [
        {
          number: 42,
          string: 'hello world',
          bool: true,
          null: null,
        },
      ],
      string: 'Hello 世界! 🌍🌎🌏 Ñoño',
      createdAt: '2024-01-01T00:00:00Z',
    },
    metadata: {
      type: 'post',
      version: 1,
    },
  })
})

describe('large payload', () => {
  benchData({
    items: Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      longUnicode:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit 🤩.\n'.repeat(
          2,
        ),
      tags: ['tag1', 'tag2', 'tag3'],
      metadata: {
        created: '2024-01-01T00:00:00Z',
        count: i * 10,
        nested: {
          flag: i % 2 === 0,
          values: [i, i * 2, i * 3],
        },
        items: Array.from({ length: 5 }, (_, j) => ({
          id: `${i}-${j}`,
          value: `Value ${i}-${j}`,
        })),
      },
    })),
  })
})

describe('deeply nested structure (depth 100)', () => {
  type NestedObject = { level: number; nested?: NestedObject }
  const nestedObject: NestedObject = { level: 0 }
  let current: NestedObject = nestedObject
  for (let i = 1; i <= 100; i++) {
    current.nested = { level: i }
    current = current.nested
  }

  benchData(nestedObject)
})

describe('deeply nested structure (depth 500)', () => {
  type NestedObject = { level: number; nested?: NestedObject }
  const nestedObject: NestedObject = { level: 0 }
  let current: NestedObject = nestedObject
  for (let i = 1; i <= 500; i++) {
    current.nested = { level: i }
    current = current.nested
  }

  benchData(nestedObject)
})

describe('array heavy', () => {
  benchData({
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      active: i % 2 === 0,
    })),
  })
})

describe('mixed array', () => {
  benchData({
    items: Array.from({ length: 100 }, (_, i) => {
      if (i % 2 === 0) {
        return {
          id: i,
          type: 'even',
          data: { value: i * 2 },
        }
      } else {
        return {
          id: i,
          name: `Item ${i}`,
          active: true,
        }
      }
    }),
  })
})

describe('primitives only', () => {
  benchData({
    string: 'hello world',
    number: 42,
    bool: true,
    null: null,
    array: [1, 2, 3, 4, 5],
    nested: {
      a: 1,
      b: 'test',
      c: [true, false],
    },
  })
})

describe('wide object (many keys)', () => {
  const wideObject: Record<string, number> = {}
  for (let i = 0; i < 100; i++) {
    wideObject[`key${i}`] = i
  }
  benchData(wideObject)
})

describe('deeply nested arrays (depth 100)', () => {
  let deepArray: any = [1, 2, 3]
  for (let i = 0; i < 100; i++) {
    deepArray = [deepArray]
  }

  benchData(deepArray)
})

describe('empty structures', () => {
  benchData({
    emptyObject: {},
    emptyArray: [],
    nested: {
      alsoEmpty: {},
      emptyArr: [],
    },
    arrayOfEmpty: [{}, {}, {}],
  })
})

describe('unicode heavy', () => {
  benchData({
    strings: Array.from({ length: 50 }, (_, i) => ({
      id: i,
      text: `Hello 世界! 🌍🌎🌏 Ñoño ${i}`,
      unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧',
    })),
  })
})

describe('mixed nesting levels', () => {
  benchData({
    shallow: {
      a: 1,
      b: 2,
    },
    medium: {
      level1: {
        level2: {
          level3: {
            value: 'here',
          },
        },
      },
    },
    deep: (() => {
      let obj: any = { value: 'leaf' }
      for (let i = 0; i < 50; i++) {
        obj = { nested: obj }
      }

      return obj
    })(),
    array: [1, [2, [3, [4, [5]]]]],
  })
})

describe('large strings', () => {
  benchData({
    small: 'a'.repeat(100),
    medium: 'b'.repeat(1000),
    large: 'c'.repeat(10000),
    withUnicode: '🌍'.repeat(100),
  })
})

function benchData(data: JsonValue) {
  bench('current', () => {
    jsonStringifyDeep(data)
  })

  bench('native', () => {
    JSON.stringify(data)
  })
}
