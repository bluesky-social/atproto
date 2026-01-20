import { describe, expect, it } from 'vitest'
import { unknownObject } from './unknown-object.js'

describe('UnknownObjectSchema', () => {
  describe('basic validation', () => {
    const schema = unknownObject()

    it('accepts empty plain objects', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual({})
      }
    })

    it('accepts plain objects with string values', () => {
      const obj = { key: 'value', name: 'test' }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts plain objects with number values', () => {
      const obj = { count: 42, total: 100 }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts plain objects with boolean values', () => {
      const obj = { enabled: true, visible: false }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts plain objects with null values', () => {
      const obj = { value: null, optional: null }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts nested plain objects', () => {
      const obj = {
        nested: {
          deep: {
            value: 'test',
          },
        },
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts plain objects with array values', () => {
      const obj = {
        items: [1, 2, 3],
        names: ['alice', 'bob'],
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts plain objects with mixed value types', () => {
      const obj = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', 3],
        nested: { key: 'value' },
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts plain objects with Uint8Array values', () => {
      const obj = {
        bytes: new Uint8Array([1, 2, 3, 4]),
        data: new Uint8Array([255, 0, 128]),
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })
  })

  describe('rejects non-plain-objects', () => {
    const schema = unknownObject()

    it('rejects strings', () => {
      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse([1, 2, 3])
      expect(result.success).toBe(false)
    })

    it('rejects empty arrays', () => {
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('rejects Date objects', () => {
      const result = schema.safeParse(new Date())
      expect(result.success).toBe(false)
    })

    it('rejects RegExp objects', () => {
      const result = schema.safeParse(/test/gi)
      expect(result.success).toBe(false)
    })

    it('rejects Map objects', () => {
      const result = schema.safeParse(new Map([['key', 'value']]))
      expect(result.success).toBe(false)
    })

    it('rejects Set objects', () => {
      const result = schema.safeParse(new Set([1, 2, 3]))
      expect(result.success).toBe(false)
    })

    it('rejects WeakMap objects', () => {
      const result = schema.safeParse(new WeakMap())
      expect(result.success).toBe(false)
    })

    it('rejects WeakSet objects', () => {
      const result = schema.safeParse(new WeakSet())
      expect(result.success).toBe(false)
    })

    it('rejects Error objects', () => {
      const result = schema.safeParse(new Error('test'))
      expect(result.success).toBe(false)
    })

    it('rejects Promise objects', () => {
      const result = schema.safeParse(Promise.resolve(42))
      expect(result.success).toBe(false)
    })

    it('rejects functions', () => {
      const result = schema.safeParse(() => 'test')
      expect(result.success).toBe(false)
    })

    it('rejects Symbol', () => {
      const result = schema.safeParse(Symbol('test'))
      expect(result.success).toBe(false)
    })

    it('rejects BigInt', () => {
      const result = schema.safeParse(BigInt(123))
      expect(result.success).toBe(false)
    })

    it('rejects class instances', () => {
      class TestClass {
        constructor(public value: string) {}
      }
      const result = schema.safeParse(new TestClass('test'))
      expect(result.success).toBe(false)
    })
  })

  describe('rejects invalid value types', () => {
    const schema = unknownObject()

    it('rejects objects with floating point numbers', () => {
      const result = schema.safeParse({ value: 3.14 })
      expect(result.success).toBe(false)
    })

    it('rejects objects with NaN values', () => {
      const result = schema.safeParse({ value: NaN })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Infinity values', () => {
      const result = schema.safeParse({ value: Infinity })
      expect(result.success).toBe(false)
    })

    it('rejects objects with -Infinity values', () => {
      const result = schema.safeParse({ value: -Infinity })
      expect(result.success).toBe(false)
    })

    it('rejects objects with undefined values', () => {
      const result = schema.safeParse({ value: undefined })
      expect(result.success).toBe(false)
    })

    it('rejects objects with function values', () => {
      const result = schema.safeParse({ fn: () => 'test' })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Symbol values', () => {
      const result = schema.safeParse({ sym: Symbol('test') })
      expect(result.success).toBe(false)
    })

    it('rejects objects with BigInt values', () => {
      const result = schema.safeParse({ big: BigInt(123) })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Date values', () => {
      const result = schema.safeParse({ date: new Date() })
      expect(result.success).toBe(false)
    })

    it('rejects objects with RegExp values', () => {
      const result = schema.safeParse({ pattern: /test/i })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Map values', () => {
      const result = schema.safeParse({ map: new Map() })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Set values', () => {
      const result = schema.safeParse({ set: new Set() })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Error values', () => {
      const result = schema.safeParse({ error: new Error('test') })
      expect(result.success).toBe(false)
    })

    it('rejects objects with Promise values', () => {
      const result = schema.safeParse({ promise: Promise.resolve(1) })
      expect(result.success).toBe(false)
    })

    it('rejects objects with class instance values', () => {
      class TestClass {}
      const result = schema.safeParse({ instance: new TestClass() })
      expect(result.success).toBe(false)
    })
  })

  describe('rejects invalid nested values', () => {
    const schema = unknownObject()

    it('rejects deeply nested invalid values', () => {
      const result = schema.safeParse({
        nested: {
          deep: {
            invalid: 3.14,
          },
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects arrays with invalid values', () => {
      const result = schema.safeParse({
        items: [1, 2, 3.14],
      })
      expect(result.success).toBe(false)
    })

    it('rejects arrays with undefined values', () => {
      const result = schema.safeParse({
        items: [1, undefined, 3],
      })
      expect(result.success).toBe(false)
    })

    it('rejects nested arrays with invalid values', () => {
      const result = schema.safeParse({
        matrix: [
          [1, 2],
          [3, 4.5],
        ],
      })
      expect(result.success).toBe(false)
    })

    it('rejects mixed valid and invalid keys', () => {
      const result = schema.safeParse({
        valid: 'string',
        invalid: Infinity,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    const schema = unknownObject()

    it('accepts objects with numeric string keys', () => {
      const obj = { '0': 'zero', '1': 'one', '2': 'two' }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with special string keys', () => {
      const obj = {
        'with spaces': 'value',
        'with-dashes': 'value',
        'with.dots': 'value',
        with_underscores: 'value',
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with empty string keys', () => {
      const obj = { '': 'empty key value' }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with zero values', () => {
      const obj = { count: 0, index: 0 }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with negative integer values', () => {
      const obj = { temperature: -10, balance: -500 }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with empty string values', () => {
      const obj = { name: '', description: '' }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with empty array values', () => {
      const obj = { items: [], tags: [] }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with empty nested objects', () => {
      const obj = { config: {}, metadata: {} }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with empty Uint8Array values', () => {
      const obj = { data: new Uint8Array([]) }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts deeply nested structures', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep',
                  array: [1, 2, [3, 4, [5]]],
                },
              },
            },
          },
        },
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts complex nested arrays and objects', () => {
      const obj = {
        matrix: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        nested: {
          arrays: [[['deep']]],
          mixed: [{ a: 1 }, { b: 2 }],
        },
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with null prototype', () => {
      const obj = Object.create(null)
      obj.key = 'value'
      obj.count = 42
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(obj)
      }
    })

    it('accepts objects with $type property', () => {
      const obj = { $type: 'app.bsky.feed.post', text: 'Hello' }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with various special characters in keys', () => {
      const obj = {
        '@mention': 'user',
        '#hashtag': 'tag',
        '!important': 'flag',
        'key:value': 'pair',
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })
  })

  describe('large objects', () => {
    const schema = unknownObject()

    it('accepts objects with many keys', () => {
      const obj: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        obj[`key${i}`] = i
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with large arrays', () => {
      const obj = {
        numbers: Array.from({ length: 1000 }, (_, i) => i),
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts objects with large Uint8Array values', () => {
      const obj = {
        data: new Uint8Array(1000).fill(0),
      }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })
  })

  describe('preservation of input', () => {
    const schema = unknownObject()

    it('preserves the original object reference', () => {
      const input = { key: 'value', count: 42 }
      const result = schema.safeParse(input)

      if (result.success) {
        expect(result.value).toBe(input)
      } else {
        throw new Error('Expected validation to succeed')
      }
    })

    it('preserves nested object references', () => {
      const nested = { inner: 'value' }
      const input = { outer: nested }
      const result = schema.safeParse(input)

      if (result.success) {
        expect(result.value).toBe(input)
        expect(result.value.outer).toBe(nested)
      } else {
        throw new Error('Expected validation to succeed')
      }
    })

    it('preserves array references in object values', () => {
      const arr = [1, 2, 3]
      const input = { items: arr }
      const result = schema.safeParse(input)

      if (result.success) {
        expect(result.value).toBe(input)
        expect(result.value.items).toBe(arr)
      } else {
        throw new Error('Expected validation to succeed')
      }
    })

    it('preserves Uint8Array references in object values', () => {
      const bytes = new Uint8Array([1, 2, 3])
      const input = { data: bytes }
      const result = schema.safeParse(input)

      if (result.success) {
        expect(result.value).toBe(input)
        expect(result.value.data).toBe(bytes)
      } else {
        throw new Error('Expected validation to succeed')
      }
    })
  })
})
