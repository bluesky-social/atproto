import { describe, expect, it } from 'vitest'
import { nullSchema } from './null.js'

describe('NullSchema', () => {
  describe('basic validation', () => {
    const schema = nullSchema()

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('rejects strings', () => {
      const result = schema.safeParse('null')
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(false)
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

    it('rejects empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    const schema = nullSchema()

    it('rejects falsy values', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('rejects string "null"', () => {
      const result = schema.safeParse('null')
      expect(result.success).toBe(false)
    })

    it('rejects NaN', () => {
      const result = schema.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('rejects nested null in object', () => {
      const result = schema.safeParse({ value: null })
      expect(result.success).toBe(false)
    })

    it('rejects nested null in array', () => {
      const result = schema.safeParse([null])
      expect(result.success).toBe(false)
    })
  })
})
