import { describe, expect, it, test } from 'vitest'
import { jsonStringifyDeep } from './json-stringify-deep.js'
import { JsonValue } from './json.js'
import { MAX_DEPTH } from './lib/stack-frame.js'

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
      expect(jsonStringifyDeep(JSON.parse(json), { maxDepth: Infinity })).toBe(
        json,
      )
    })

    it('handles nested objects (10000 levels)', () => {
      const json = '{"a":'.repeat(10000) + 'null' + '}'.repeat(10000)
      expect(jsonStringifyDeep(JSON.parse(json), { maxDepth: Infinity })).toBe(
        json,
      )
    })

    it('limits maximum depth by default', () => {
      const depth = MAX_DEPTH + 2
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

  describe('circular reference detection', () => {
    it('detects circular reference in object', () => {
      const obj: any = { a: 1 }
      obj.self = obj
      expect(() => jsonStringifyDeep(obj)).toThrow('Input is too deeply nested')
    })

    it('detects circular reference in array', () => {
      const arr: any = [1, 2, 3]
      arr.push(arr)
      expect(() => jsonStringifyDeep(arr)).toThrow('Input is too deeply nested')
    })

    it('detects circular reference in nested object', () => {
      const obj: any = { a: { b: { c: 1 } } }
      obj.a.b.c = obj
      expect(() => jsonStringifyDeep(obj)).toThrow('Input is too deeply nested')
    })

    it('detects circular reference in nested array', () => {
      const arr: any = [[1, [2, [3]]]]
      arr[0][1][1].push(arr)
      expect(() => jsonStringifyDeep(arr)).toThrow('Input is too deeply nested')
    })

    it('detects circular reference in mixed structure', () => {
      const obj: any = { items: [{ nested: { value: 1 } }] }
      obj.items[0].nested.ref = obj
      expect(() => jsonStringifyDeep(obj)).toThrow('Input is too deeply nested')
    })

    it('detects circular reference to parent array', () => {
      const arr: any = [1, [2, [3]]]
      arr[1][1].push(arr[1])
      expect(() => jsonStringifyDeep(arr)).toThrow('Input is too deeply nested')
    })

    it('detects circular reference to parent object', () => {
      const obj: any = { a: { b: { c: 1 } } }
      obj.a.b.parent = obj.a
      expect(() => jsonStringifyDeep(obj)).toThrow('Input is too deeply nested')
    })

    it('allows repeated references to same object (not circular)', () => {
      const shared = { shared: 'value' }
      const obj = {
        ref1: shared,
        ref2: shared,
        nested: { ref3: shared },
        array: [shared, shared],
      }
      // This should not throw - it's not a circular reference
      expect(() => jsonStringifyDeep(obj)).not.toThrow()
    })
  })

  describe('toJSON() method support', () => {
    it('calls toJSON() on objects that have it', () => {
      const obj = {
        value: 42,
        toJSON() {
          return { transformed: true }
        },
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('{"transformed":true}')
    })

    it('calls toJSON() on nested objects', () => {
      const nested = {
        data: 'test',
        toJSON() {
          return { serialized: this.data }
        },
      }
      const obj = { wrapper: nested }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('{"wrapper":{"serialized":"test"}}')
    })

    it('calls toJSON() returning primitive', () => {
      const obj = {
        value: 42,
        toJSON() {
          return this.value
        },
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('42')
    })

    it('calls toJSON() returning string', () => {
      const obj = {
        toJSON() {
          return 'custom string'
        },
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('"custom string"')
    })

    it('calls toJSON() returning null', () => {
      const obj = {
        toJSON() {
          return null
        },
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('null')
    })

    it('calls toJSON() returning undefined (omits from object)', () => {
      const obj = {
        keep: 'this',
        remove: {
          toJSON() {
            return undefined
          },
        },
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('{"keep":"this"}')
    })

    it('calls toJSON() returning undefined (becomes null in array)', () => {
      const obj = {
        toJSON() {
          return undefined
        },
      }
      const arr = [1, obj, 3]
      const expected = JSON.stringify(arr)
      const result = jsonStringifyDeep(arr as any)
      expect(result).toBe(expected)
      expect(result).toBe('[1,null,3]')
    })

    it('calls toJSON() on array elements', () => {
      const item1 = {
        id: 1,
        toJSON() {
          return { id: this.id, type: 'item' }
        },
      }
      const item2 = {
        id: 2,
        toJSON() {
          return { id: this.id, type: 'item' }
        },
      }
      const arr = [item1, item2]
      const expected = JSON.stringify(arr)
      const result = jsonStringifyDeep(arr as any)
      expect(result).toBe(expected)
      expect(result).toBe('[{"id":1,"type":"item"},{"id":2,"type":"item"}]')
    })

    it('handles toJSON() returning object with toJSON()', () => {
      const innerObj = {
        value: 'inner',
        toJSON() {
          return { nested: this.value }
        },
      }
      const outerObj = {
        toJSON() {
          return innerObj
        },
      }
      const expected = JSON.stringify(outerObj)
      const result = jsonStringifyDeep(outerObj as any)
      expect(result).toBe(expected)
    })

    it('handles chain of toJSON() calls', () => {
      const level3 = {
        toJSON() {
          return 'final'
        },
      }
      const level2 = {
        toJSON() {
          return level3
        },
      }
      const level1 = {
        toJSON() {
          return level2
        },
      }
      const expected = JSON.stringify(level1)
      const result = jsonStringifyDeep(level1 as any)
      expect(result).toBe(expected)
    })

    it('handles Date objects (which have toJSON)', () => {
      const date = new Date('2024-01-01T00:00:00.000Z')
      const obj = { timestamp: date }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(JSON.parse(result)).toStrictEqual(JSON.parse(expected))
    })

    it('handles mixed objects with and without toJSON', () => {
      const withToJSON = {
        value: 'a',
        toJSON() {
          return { converted: this.value }
        },
      }
      const withoutToJSON = {
        value: 'b',
      }
      const obj = {
        first: withToJSON,
        second: withoutToJSON,
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
    })

    it('handles toJSON() in deeply nested structure', () => {
      const deepObj = {
        level: 1,
        child: {
          level: 2,
          child: {
            level: 3,
            toJSON() {
              return { transformed: 'deep' }
            },
          },
        },
      }
      const expected = JSON.stringify(deepObj)
      const result = jsonStringifyDeep(deepObj as any)
      expect(result).toBe(expected)
    })

    it('handles toJSON() that returns array', () => {
      const obj = {
        toJSON() {
          return [1, 2, 3]
        },
      }
      const expected = JSON.stringify(obj)
      const result = jsonStringifyDeep(obj as any)
      expect(result).toBe(expected)
      expect(result).toBe('[1,2,3]')
    })

    it('handles array with toJSON() returning object', () => {
      const arr = {
        toJSON() {
          return { converted: 'to object' }
        },
      }
      const expected = JSON.stringify(arr)
      const result = jsonStringifyDeep(arr as any)
      expect(result).toBe(expected)
      expect(result).toBe('{"converted":"to object"}')
    })

    it('toJSON() is called with correct this context', () => {
      let contextValue: any
      const obj = {
        myValue: 'test',
        toJSON() {
          contextValue = this.myValue
          return { value: this.myValue }
        },
      }
      jsonStringifyDeep(obj as any)
      expect(contextValue).toBe('test')
    })

    it('handles toJSON() throwing error', () => {
      const obj = {
        toJSON() {
          throw new Error('toJSON error')
        },
      }
      // Both should throw the same error
      expect(() => JSON.stringify(obj)).toThrow('toJSON error')
      expect(() => jsonStringifyDeep(obj as any)).toThrow('toJSON error')
    })
  })
})
