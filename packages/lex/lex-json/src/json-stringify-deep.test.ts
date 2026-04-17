import { describe, expect, it, test } from 'vitest'
import { DEFAULT_MAX_DEPTH, jsonStringifyDeep } from './json-stringify-deep.js'
import { JsonValue } from './json.js'

describe(jsonStringifyDeep, () => {
  describe('behavior matches JSON.stringify', () => {
    function testData(name: string, data: JsonValue = name) {
      test(name, () => {
        const json = JSON.stringify(data)
        const result = jsonStringifyDeep(data)
        expect(result).toBe(json)
      })
    }

    testData('Hello 世界! 🌍🌎🌏 Ñoño')
    testData('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')
    testData('zero', 42)
    testData('integer', 42)
    testData('negative integer', -123)
    testData('float', 3.14159)
    testData('true', true)
    testData('false', false)
    testData('null', null)
    testData('string', 'hello')
    testData('empty string', '')
    testData(
      'string with special characters',
      'He said "hello"\nNew line and tab\tcharacters',
    )
    testData('empty array', [])
    testData('array of primitives', [1, 'two', true, null, 5])
    testData('empty object', {})
    testData('object with primitives', { a: 1, b: 'hello', c: true })
    testData('nested object', { outer: { inner: { value: 'nested' } } })
    testData('simple object', { a: 1, b: 'test', c: true })
    testData('array of primitives', [1, 'two', true, null, 5])

    testData('nested structure', {
      items: [
        { id: 1, values: [1, 2, 3] },
        { id: 2, values: [4, 5, 6] },
      ],
      metadata: {
        count: 2,
        nested: {
          flag: true,
        },
      },
    })

    testData('empty structures', {
      emptyObject: {},
      emptyArray: [],
      nested: {
        alsoEmpty: {},
      },
    })

    testData('special characters and unicode', {
      quotes: 'He said "hello"',
      backslash: 'path\\to\\file',
      newline: 'line1\nline2',
      tab: 'col1\tcol2',
      unicode: '世界 🌍 Ñoño',
    })

    testData('nested array', {
      items: [
        [1, 2],
        [3, 4],
        [5, [6, 7]],
      ],
    })
    testData('mixed nested structure', {
      string: 'Hello 世界! 🌍🌎🌏 Ñoño',
      number: 42,
      bool: true,
      null: null,
      array: [
        'item1',
        {
          nested: {
            deeply: ['a', 'b', 'c'],
            value: 123,
          },
        },
      ],
      object: {
        a: [1, 2, 3],
        b: {
          c: {
            d: 'deep',
          },
        },
      },
    })
    testData(
      'large array of objects',
      Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        metadata: {
          count: i * 10,
          active: i % 2 === 0,
          tags: ['tag1', 'tag2', 'tag3'],
        },
      })),
    )

    testData('object with numeric string keys', {
      '0': 'zero',
      '1': 'one',
      '10': 'ten',
    })
    testData('array with null values', [1, null, 3, null, 5])

    testData('object with special key names', {
      '': 'empty string key',
      ' ': 'space key',
      'key with spaces': 'value',
      'key-with-dashes': 'value',
      'key.with.dots': 'value',
    })

    testData('numbers with different formats', {
      integer: 42,
      negative: -123,
      float: 3.14159,
      scientific: 1.5e10,
      zero: 0,
      negativeZero: -0,
    })

    const shared = { shared: 'value' }
    testData('repeated references to same object (not circular)', {
      ref1: shared,
      ref2: shared,
      nested: { ref3: shared },
      array: [shared, shared],
    })
  })

  describe('deeply nested structures', () => {
    it('handles nested arrays (10000 levels)', () => {
      const json = '['.repeat(10000) + ']'.repeat(10000)
      expect(jsonStringifyDeep(JSON.parse(json))).toBe(json)
    })

    it('handles nested objects (10000 levels)', () => {
      const json = '{"a":'.repeat(10000) + 'null' + '}'.repeat(10000)
      expect(jsonStringifyDeep(JSON.parse(json))).toBe(json)
    })

    it('limits maximum depth by default', () => {
      const depth = DEFAULT_MAX_DEPTH + 2
      const json = '['.repeat(depth) + ']'.repeat(depth)
      expect(() => jsonStringifyDeep(JSON.parse(json))).toThrow(
        /Input is too deeply nested/,
      )
    })

    it('allows custom max depth (lower than default)', () => {
      const depth = 5000
      const json = '['.repeat(depth) + ']'.repeat(depth)
      expect(jsonStringifyDeep(JSON.parse(json), { maxDepth: depth - 1 })).toBe(
        json,
      )
      expect(() =>
        jsonStringifyDeep(JSON.parse(json), { maxDepth: depth - 2 }),
      ).toThrow()
    })

    it('allows unlimited max depth', () => {
      const depth = 150_000
      const json = '['.repeat(depth) + ']'.repeat(depth)
      expect(jsonStringifyDeep(JSON.parse(json), { maxDepth: Infinity })).toBe(
        json,
      )
    })
  })
})
