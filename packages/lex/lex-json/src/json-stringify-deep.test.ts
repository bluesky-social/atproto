import { describe, expect, test } from 'vitest'
import { jsonStringifyDeep } from './json-stringify-deep.js'

describe(jsonStringifyDeep, () => {
  describe('primitives', () => {
    test('string', () => {
      expect(jsonStringifyDeep('hello')).toBe('"hello"')
    })

    test('number', () => {
      expect(jsonStringifyDeep(42)).toBe('42')
      expect(jsonStringifyDeep(0)).toBe('0')
      expect(jsonStringifyDeep(-123)).toBe('-123')
      expect(jsonStringifyDeep(3.14159)).toBe('3.14159')
    })

    test('boolean', () => {
      expect(jsonStringifyDeep(true)).toBe('true')
      expect(jsonStringifyDeep(false)).toBe('false')
    })

    test('null', () => {
      expect(jsonStringifyDeep(null)).toBe('null')
    })
  })

  describe('simple objects', () => {
    test('empty object', () => {
      expect(jsonStringifyDeep({})).toBe('{}')
    })

    test('object with single property', () => {
      const result = jsonStringifyDeep({ foo: 'bar' })
      expect(JSON.parse(result)).toStrictEqual({ foo: 'bar' })
    })

    test('object with multiple properties', () => {
      const result = jsonStringifyDeep({
        string: 'abc',
        number: 123,
        bool: true,
        null: null,
      })
      expect(JSON.parse(result)).toStrictEqual({
        string: 'abc',
        number: 123,
        bool: true,
        null: null,
      })
    })

    test('object with unicode strings', () => {
      const result = jsonStringifyDeep({
        unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧',
      })
      expect(JSON.parse(result)).toStrictEqual({
        unicode: 'a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧',
      })
    })
  })

  describe('simple arrays', () => {
    test('empty array', () => {
      expect(jsonStringifyDeep([])).toBe('[]')
    })

    test('array of primitives', () => {
      const result = jsonStringifyDeep([1, 2, 3, 4, 5])
      expect(JSON.parse(result)).toStrictEqual([1, 2, 3, 4, 5])
    })

    test('array of mixed types', () => {
      const result = jsonStringifyDeep(['string', 123, true, null])
      expect(JSON.parse(result)).toStrictEqual(['string', 123, true, null])
    })
  })

  describe('nested structures', () => {
    test('object with nested object', () => {
      const result = jsonStringifyDeep({
        outer: {
          inner: {
            value: 'nested',
          },
        },
      })
      expect(JSON.parse(result)).toStrictEqual({
        outer: {
          inner: {
            value: 'nested',
          },
        },
      })
    })

    test('object with nested array', () => {
      const result = jsonStringifyDeep({
        items: [
          { id: 1, name: 'first' },
          { id: 2, name: 'second' },
        ],
      })
      expect(JSON.parse(result)).toStrictEqual({
        items: [
          { id: 1, name: 'first' },
          { id: 2, name: 'second' },
        ],
      })
    })

    test('array with nested objects', () => {
      const result = jsonStringifyDeep([{ a: 1 }, { b: 2 }, { c: { d: 3 } }])
      expect(JSON.parse(result)).toStrictEqual([
        { a: 1 },
        { b: 2 },
        { c: { d: 3 } },
      ])
    })

    test('array with nested arrays', () => {
      const result = jsonStringifyDeep([
        [1, 2],
        [3, 4],
        [5, [6, 7]],
      ])
      expect(JSON.parse(result)).toStrictEqual([
        [1, 2],
        [3, 4],
        [5, [6, 7]],
      ])
    })
  })

  describe('complex structures', () => {
    test('mixed nested structure', () => {
      const data = {
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
      }
      const result = jsonStringifyDeep(data)
      expect(JSON.parse(result)).toStrictEqual(data)
    })

    test('large array of objects', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        metadata: {
          count: i * 10,
          active: i % 2 === 0,
          tags: ['tag1', 'tag2', 'tag3'],
        },
      }))
      const result = jsonStringifyDeep(data)
      expect(JSON.parse(result)).toStrictEqual(data)
    })
  })

  describe('deeply nested structures', () => {
    describe('handles deep nesting without stack overflow', () => {
      test('deeply nested objects (5000 levels)', () => {
        let deepData: any = { value: 'leaf' }
        for (let i = 0; i <= 5000; i++) {
          deepData = { level: i, nested: deepData }
        }

        // jsonStringifyDeep should succeed
        expect(() => jsonStringifyDeep(deepData)).not.toThrow()

        const jsonString = jsonStringifyDeep(deepData)
        expect(jsonString.startsWith('{"level":')).toBe(true)
        expect(jsonString.length).toBeGreaterThan(50000)

        // Verify round-trip
        const parsed = JSON.parse(jsonString)
        expect(parsed.level).toBe(5000)
        expect(typeof parsed.nested).toBe('object')
      })

      test('deeply nested arrays (5000 levels)', () => {
        let deepData: any = ['leaf']
        for (let i = 0; i < 5000; i++) {
          deepData = [deepData]
        }

        // jsonStringifyDeep should succeed
        expect(() => jsonStringifyDeep(deepData)).not.toThrow()

        const jsonString = jsonStringifyDeep(deepData)
        expect(jsonString.startsWith('[[[')).toBe(true)

        // Verify round-trip
        const parsed = JSON.parse(jsonString)
        expect(Array.isArray(parsed)).toBe(true)
      })

      test('very deeply nested mixed structure (5000 levels)', () => {
        let deepData: any = { leaf: 'value', number: 42 }
        for (let i = 0; i < 5000; i++) {
          deepData = { level: i, nested: deepData }
        }

        // jsonStringifyDeep should succeed
        expect(() => jsonStringifyDeep(deepData)).not.toThrow()

        const jsonString = jsonStringifyDeep(deepData)
        expect(jsonString.length).toBeGreaterThan(50000)

        // Verify round-trip on a subset
        const parsed = JSON.parse(jsonString)
        expect(parsed.level).toBe(4999)
        expect(typeof parsed.nested).toBe('object')
      })

      test('deeply nested objects with multiple properties at each level', () => {
        let deepData: any = { value: 'leaf', extra: 'data', count: 0 }
        for (let i = 0; i <= 5000; i++) {
          deepData = {
            level: i,
            name: `level-${i}`,
            nested: deepData,
            sibling: { a: i, b: i * 2 },
          }
        }

        // jsonStringifyDeep should succeed
        const jsonString = jsonStringifyDeep(deepData)
        const parsed = JSON.parse(jsonString)
        expect(parsed.level).toBe(5000)
        expect(parsed.name).toBe('level-5000')
        expect(parsed.sibling).toStrictEqual({ a: 5000, b: 10000 })
      })

      test('deeply nested arrays with multiple elements at each level', () => {
        let deepData: any = ['leaf', 'data']
        for (let i = 0; i <= 5000; i++) {
          deepData = [i, `level-${i}`, deepData, { extra: i }]
        }

        // jsonStringifyDeep should succeed
        const jsonString = jsonStringifyDeep(deepData)
        const parsed = JSON.parse(jsonString)
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed[0]).toBe(5000)
        expect(parsed[1]).toBe('level-5000')
        expect(parsed[3]).toStrictEqual({ extra: 5000 })
      })

      test('mixed deeply nested objects and arrays', () => {
        let deepData: any = { value: 'leaf' }
        for (let i = 0; i < 2500; i++) {
          if (i % 2 === 0) {
            deepData = { level: i, nested: deepData, array: [i, i * 2] }
          } else {
            deepData = [i, { nested: deepData }]
          }
        }

        // jsonStringifyDeep should succeed
        const jsonString = jsonStringifyDeep(deepData)
        const parsed = JSON.parse(jsonString)
        // Top level should be an array (i=2499 is odd, the loop stops before 2500)
        expect(typeof parsed).toBe('object')
        expect(Array.isArray(parsed)).toBe(true)
      })
    })

    describe('performance characteristics with deep nesting', () => {
      test('extremely deep structure (10000 levels)', () => {
        let deepData: any = { value: 'leaf' }
        for (let i = 0; i <= 10000; i++) {
          deepData = { level: i, nested: deepData }
        }

        // JSON.stringify should fail
        expect(() => JSON.stringify(deepData)).toThrow(RangeError)

        // jsonStringifyDeep should handle it
        const jsonString = jsonStringifyDeep(deepData)
        expect(jsonString.length).toBeGreaterThan(100000)

        const parsed = JSON.parse(jsonString)
        expect(parsed.level).toBe(10000)
      })

      test('wide and deep structure', () => {
        let deepData: any = { value: 'leaf' }
        for (let i = 0; i <= 2500; i++) {
          const wideObj: any = { nested: deepData }
          // Add 20 properties at each level
          for (let j = 0; j <= 20; j++) {
            wideObj[`prop${j}`] = `value-${i}-${j}`
          }
          deepData = wideObj
        }

        const jsonString = jsonStringifyDeep(deepData)
        const parsed = JSON.parse(jsonString)
        expect(parsed.prop0).toBe('value-2500-0')
        expect(parsed.prop20).toBe('value-2500-20')
      })
    })
  })

  describe('output matches JSON.stringify', () => {
    test('simple object', () => {
      const data = { a: 1, b: 'test', c: true }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('nested structure', () => {
      const data = {
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
      }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('array of primitives', () => {
      const data = [1, 'two', true, null, 5]
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('empty structures', () => {
      const data = {
        emptyObject: {},
        emptyArray: [],
        nested: {
          alsoEmpty: {},
        },
      }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('special characters and unicode', () => {
      const data = {
        quotes: 'He said "hello"',
        backslash: 'path\\to\\file',
        newline: 'line1\nline2',
        tab: 'col1\tcol2',
        unicode: '世界 🌍 Ñoño',
      }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })
  })

  describe('edge cases', () => {
    test('object with numeric string keys', () => {
      const data = { '0': 'zero', '1': 'one', '10': 'ten' }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('array with null values', () => {
      const data = [1, null, 3, null, 5]
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('object with special key names', () => {
      const data = {
        '': 'empty string key',
        ' ': 'space key',
        'key with spaces': 'value',
        'key-with-dashes': 'value',
        'key.with.dots': 'value',
      }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('numbers with different formats', () => {
      const data = {
        integer: 42,
        negative: -123,
        float: 3.14159,
        scientific: 1.5e10,
        zero: 0,
        negativeZero: -0,
      }
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })

    test('repeated references to same object (not circular)', () => {
      const shared = { shared: 'value' }
      const data = {
        ref1: shared,
        ref2: shared,
        nested: {
          ref3: shared,
        },
      }
      // Note: JSON.stringify creates independent copies of shared objects
      expect(JSON.parse(jsonStringifyDeep(data))).toStrictEqual(
        JSON.parse(JSON.stringify(data)),
      )
    })
  })
})
