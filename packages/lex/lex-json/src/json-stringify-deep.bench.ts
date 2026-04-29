import { bench, describe } from 'vitest'
import {
  JsonStringifyDeepOptions,
  jsonStringifyDeep,
} from './json-stringify-deep.js'
import { JsonValue } from './json.js'

const UNSAFE_JSON_STRINGIFY_OPTIONS: Required<JsonStringifyDeepOptions> = {
  allowNonSafeIntegers: true,
  maxContainerLength: Infinity,
  maxNestedLevels: Infinity,
  maxObjectKeyLen: Infinity,
}

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

describe('deeply nested structure (depth 5000)', () => {
  type NestedObject = { level: number; nested?: NestedObject }
  const nestedObject: NestedObject = { level: 0 }
  let current: NestedObject = nestedObject
  for (let i = 1; i <= 5000; i++) {
    current.nested = { level: i }
    current = current.nested
  }

  benchData(nestedObject)
})

function benchData(data: JsonValue) {
  bench(jsonStringifyDeep, () => {
    jsonStringifyDeep(data, UNSAFE_JSON_STRINGIFY_OPTIONS)
  })

  bench('JSON.stringify', () => {
    JSON.stringify(data)
  })
}
