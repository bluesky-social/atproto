import { describe, expect, it } from 'vitest'
import { BooleanSchema } from './boolean.js'

describe('BooleanSchema', () => {
  describe('basic validation', () => {
    const schema = new BooleanSchema()

    it('validates true', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('validates false', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })

    it('rejects strings', () => {
      const result = schema.safeParse('true')
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(1)
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
  })

  describe('with default value', () => {
    it('uses default value of true when input is undefined', () => {
      const schema = new BooleanSchema({ default: true })
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('uses default value of false when input is undefined', () => {
      const schema = new BooleanSchema({ default: false })
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })

    it('overrides default value with explicit true', () => {
      const schema = new BooleanSchema({ default: false })
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('overrides default value with explicit false', () => {
      const schema = new BooleanSchema({ default: true })
      const result = schema.safeParse(false)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })

    it('rejects invalid types even with default', () => {
      const schema = new BooleanSchema({ default: true })
      const result = schema.safeParse('not a boolean')
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    const schema = new BooleanSchema()

    it('rejects Boolean object', () => {
      const result = schema.safeParse(new Boolean(true))
      expect(result.success).toBe(false)
    })

    it('rejects truthy values', () => {
      const result = schema.safeParse('truthy')
      expect(result.success).toBe(false)
    })

    it('rejects falsy values', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })
  })
})
