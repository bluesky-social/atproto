import { describe, expect, it } from 'vitest'
import { never } from './never.js'

describe('NeverSchema', () => {
  describe('basic validation', () => {
    const schema = never()

    it('rejects strings', () => {
      const result = schema.safeParse('string')
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

    it('rejects objects', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('rejects false', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    const schema = never()

    it('rejects BigInt', () => {
      const result = schema.safeParse(BigInt(123))
      expect(result.success).toBe(false)
    })

    it('rejects Symbol', () => {
      const result = schema.safeParse(Symbol('test'))
      expect(result.success).toBe(false)
    })

    it('rejects functions', () => {
      const result = schema.safeParse(() => {})
      expect(result.success).toBe(false)
    })

    it('rejects Date objects', () => {
      const result = schema.safeParse(new Date())
      expect(result.success).toBe(false)
    })

    it('rejects RegExp objects', () => {
      const result = schema.safeParse(/test/)
      expect(result.success).toBe(false)
    })

    it('rejects nested objects', () => {
      const result = schema.safeParse({ nested: { value: 'test' } })
      expect(result.success).toBe(false)
    })

    it('rejects nested arrays', () => {
      const result = schema.safeParse([
        [1, 2],
        [3, 4],
      ])
      expect(result.success).toBe(false)
    })

    it('rejects Map objects', () => {
      const result = schema.safeParse(new Map())
      expect(result.success).toBe(false)
    })

    it('rejects Set objects', () => {
      const result = schema.safeParse(new Set())
      expect(result.success).toBe(false)
    })

    it('rejects Error objects', () => {
      const result = schema.safeParse(new Error('test'))
      expect(result.success).toBe(false)
    })
  })

  describe('complex data types', () => {
    const schema = never()

    it('rejects class instances', () => {
      class TestClass {
        value = 'test'
      }
      const result = schema.safeParse(new TestClass())
      expect(result.success).toBe(false)
    })

    it('rejects arrays with values', () => {
      const result = schema.safeParse([1, 2, 3, 'four', true])
      expect(result.success).toBe(false)
    })

    it('rejects objects with properties', () => {
      const result = schema.safeParse({
        name: 'test',
        age: 30,
        active: true,
      })
      expect(result.success).toBe(false)
    })

    it('rejects Promise objects', () => {
      const result = schema.safeParse(Promise.resolve(42))
      expect(result.success).toBe(false)
    })

    it('rejects Buffer objects', () => {
      const result = schema.safeParse(Buffer.from('test'))
      expect(result.success).toBe(false)
    })
  })

  describe('special number values', () => {
    const schema = never()

    it('rejects NaN', () => {
      const result = schema.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('rejects Infinity', () => {
      const result = schema.safeParse(Infinity)
      expect(result.success).toBe(false)
    })

    it('rejects negative Infinity', () => {
      const result = schema.safeParse(-Infinity)
      expect(result.success).toBe(false)
    })

    it('rejects negative zero', () => {
      const result = schema.safeParse(-0)
      expect(result.success).toBe(false)
    })
  })
})
