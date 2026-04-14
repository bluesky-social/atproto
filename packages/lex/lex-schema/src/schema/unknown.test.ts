import { describe, expect, it } from 'vitest'
import { unknown } from './unknown.js'

describe('UnknownSchema', () => {
  describe('basic validation', () => {
    const schema = unknown()

    it('accepts strings', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('accepts numbers', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(42)
      }
    })

    it('accepts booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('accepts null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('accepts undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(undefined)
      }
    })

    it('accepts plain objects', () => {
      const obj = { key: 'value', nested: { prop: 123 } }
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(obj)
      }
    })

    it('accepts arrays', () => {
      const arr = [1, 2, 3, 'four', { five: 5 }]
      const result = schema.safeParse(arr)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(arr)
      }
    })

    it('accepts empty arrays', () => {
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual([])
      }
    })

    it('accepts empty objects', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual({})
      }
    })
  })

  describe('edge cases', () => {
    const schema = unknown()

    it('accepts zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(0)
      }
    })

    it('accepts empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('')
      }
    })

    it('accepts negative numbers', () => {
      const result = schema.safeParse(-123)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(-123)
      }
    })

    it('accepts floating point numbers', () => {
      const result = schema.safeParse(3.14159)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(3.14159)
      }
    })

    it('accepts NaN', () => {
      const result = schema.safeParse(NaN)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBeNaN()
      }
    })

    it('accepts Infinity', () => {
      const result = schema.safeParse(Infinity)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(Infinity)
      }
    })

    it('accepts -Infinity', () => {
      const result = schema.safeParse(-Infinity)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(-Infinity)
      }
    })

    it('accepts BigInt', () => {
      const bigIntValue = BigInt(9007199254740991)
      const result = schema.safeParse(bigIntValue)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(bigIntValue)
      }
    })

    it('accepts functions', () => {
      const fn = () => 'test'
      const result = schema.safeParse(fn)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(fn)
      }
    })

    it('accepts Date objects', () => {
      const date = new Date('2023-01-01')
      const result = schema.safeParse(date)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(date)
      }
    })

    it('accepts RegExp objects', () => {
      const regex = /test/gi
      const result = schema.safeParse(regex)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(regex)
      }
    })

    it('accepts Symbol', () => {
      const sym = Symbol('test')
      const result = schema.safeParse(sym)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(sym)
      }
    })

    it('accepts Map objects', () => {
      const map = new Map([['key', 'value']])
      const result = schema.safeParse(map)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(map)
      }
    })

    it('accepts Set objects', () => {
      const set = new Set([1, 2, 3])
      const result = schema.safeParse(set)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(set)
      }
    })

    it('accepts WeakMap objects', () => {
      const weakMap = new WeakMap()
      const result = schema.safeParse(weakMap)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(weakMap)
      }
    })

    it('accepts WeakSet objects', () => {
      const weakSet = new WeakSet()
      const result = schema.safeParse(weakSet)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(weakSet)
      }
    })

    it('accepts class instances', () => {
      class TestClass {
        constructor(public value: string) {}
      }
      const instance = new TestClass('test')
      const result = schema.safeParse(instance)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(instance)
      }
    })

    it('accepts nested complex structures', () => {
      const complex = {
        array: [1, 'two', { three: 3 }],
        nested: {
          deep: {
            value: [null, undefined, true],
          },
        },
        fn: () => 'test',
        date: new Date(),
      }
      const result = schema.safeParse(complex)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toEqual(complex)
      }
    })
  })

  describe('special JavaScript values', () => {
    const schema = unknown()

    it('accepts objects with null prototype', () => {
      const obj = Object.create(null)
      obj.key = 'value'
      const result = schema.safeParse(obj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(obj)
      }
    })

    it('accepts Proxy objects', () => {
      const target = { value: 42 }
      const proxy = new Proxy(target, {})
      const result = schema.safeParse(proxy)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(proxy)
      }
    })

    it('accepts typed arrays', () => {
      const uint8Array = new Uint8Array([1, 2, 3])
      const result = schema.safeParse(uint8Array)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(uint8Array)
      }
    })

    it('accepts ArrayBuffer', () => {
      const buffer = new ArrayBuffer(8)
      const result = schema.safeParse(buffer)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(buffer)
      }
    })

    it('accepts Promise objects', () => {
      const promise = Promise.resolve(42)
      const result = schema.safeParse(promise)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(promise)
      }
    })

    it('accepts Error objects', () => {
      const error = new Error('test error')
      const result = schema.safeParse(error)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(error)
      }
    })
  })
})
