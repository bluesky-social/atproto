import { describe, expect, it } from 'vitest'
import { boolean } from './boolean.js'
import { integer } from './integer.js'
import { optional } from './optional.js'
import { string } from './string.js'
import { withDefault } from './with-default.js'

describe('OptionalSchema', () => {
  describe('basic validation with string schema', () => {
    const schema = optional(string())

    it('validates defined string values', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('validates empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('')
      }
    })

    it('validates undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(undefined)
      }
    })

    it('rejects invalid types for the inner schema', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects objects', () => {
      const result = schema.safeParse({ value: 'hello' })
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['hello'])
      expect(result.success).toBe(false)
    })
  })

  describe('basic validation with integer schema', () => {
    const schema = optional(integer())

    it('validates defined integer values', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(42)
      }
    })

    it('validates zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(0)
      }
    })

    it('validates negative integers', () => {
      const result = schema.safeParse(-42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(-42)
      }
    })

    it('validates undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(undefined)
      }
    })

    it('rejects invalid types for the inner schema', () => {
      const result = schema.safeParse('not a number')
      expect(result.success).toBe(false)
    })

    it('rejects floats', () => {
      const result = schema.safeParse(3.14)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })
  })

  describe('basic validation with boolean schema', () => {
    const schema = optional(boolean())

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

    it('validates undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(undefined)
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
  })

  describe('inner schema with constraints', () => {
    const schema = optional(string({ minLength: 5, maxLength: 10 }))

    it('validates values meeting inner schema constraints', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates values at minimum boundary', () => {
      const result = schema.safeParse('abcde')
      expect(result.success).toBe(true)
    })

    it('validates values at maximum boundary', () => {
      const result = schema.safeParse('1234567890')
      expect(result.success).toBe(true)
    })

    it('validates undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
    })

    it('rejects values violating inner schema minimum constraint', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('rejects values violating inner schema maximum constraint', () => {
      const result = schema.safeParse('this is too long')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings when inner schema has minLength', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('inner schema with default value', () => {
    const schema = optional(withDefault(string(), 'default'))

    it('applies default value when undefined is provided', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('default')
      }
    })

    it('does not apply default when explicit value is provided', () => {
      const result = schema.safeParse('explicit')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('explicit')
      }
    })

    it('does not apply default when empty string is provided', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('')
      }
    })
  })

  describe('inner schema with default value and constraints', () => {
    const schema = optional(withDefault(string({ minLength: 5 }), 'default'))

    it('applies default value when undefined is provided', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('default')
      }
    })

    it('validates explicit values against constraints', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects explicit values violating constraints', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })
  })

  describe('inner schema with invalid default value', () => {
    const schema = optional(string({ default: 'bad', minLength: 5 }))

    it('returns undefined when default value violates constraints', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(undefined)
      }
    })

    it('still validates conforming explicit values', () => {
      const result = schema.safeParse('valid')
      expect(result.success).toBe(true)
    })
  })

  describe('inner schema with integer default', () => {
    const schema = optional(withDefault(integer(), 42))

    it('applies default value when undefined is provided', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(42)
      }
    })

    it('does not apply default when explicit value is provided', () => {
      const result = schema.safeParse(100)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(100)
      }
    })

    it('does not apply default when zero is provided', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(0)
      }
    })
  })

  describe('inner schema with boolean default', () => {
    const schema = optional(withDefault(boolean(), true))

    it('applies default value when undefined is provided', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('does not apply default when explicit true is provided', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it('does not apply default when explicit false is provided', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe('edge cases', () => {
    const schema = optional(string())

    it('handles very long strings', () => {
      const longString = 'a'.repeat(10000)
      const result = schema.safeParse(longString)
      expect(result.success).toBe(true)
    })

    it('handles strings with special characters', () => {
      const result = schema.safeParse('hello\nworld\ttab')
      expect(result.success).toBe(true)
    })

    it('handles strings with unicode characters', () => {
      const result = schema.safeParse('Hello 世界 🌍')
      expect(result.success).toBe(true)
    })

    it('handles empty string distinctly from undefined', () => {
      const emptyResult = schema.safeParse('')
      expect(emptyResult.success).toBe(true)
      if (emptyResult.success) {
        expect(emptyResult.value).toBe('')
      }

      const undefinedResult = schema.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      if (undefinedResult.success) {
        expect(undefinedResult.value).toBe(undefined)
      }
    })
  })

  describe('type distinctions', () => {
    it('distinguishes between zero and undefined for integers', () => {
      const schema = optional(integer())

      const zeroResult = schema.safeParse(0)
      expect(zeroResult.success).toBe(true)
      if (zeroResult.success) {
        expect(zeroResult.value).toBe(0)
      }

      const undefinedResult = schema.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      if (undefinedResult.success) {
        expect(undefinedResult.value).toBe(undefined)
      }
    })

    it('distinguishes between false and undefined for booleans', () => {
      const schema = optional(boolean())

      const falseResult = schema.safeParse(false)
      expect(falseResult.success).toBe(true)
      if (falseResult.success) {
        expect(falseResult.value).toBe(false)
      }

      const undefinedResult = schema.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      if (undefinedResult.success) {
        expect(undefinedResult.value).toBe(undefined)
      }
    })

    it('distinguishes between empty string and undefined for strings', () => {
      const schema = optional(string())

      const emptyResult = schema.safeParse('')
      expect(emptyResult.success).toBe(true)
      if (emptyResult.success) {
        expect(emptyResult.value).toBe('')
      }

      const undefinedResult = schema.safeParse(undefined)
      expect(undefinedResult.success).toBe(true)
      if (undefinedResult.success) {
        expect(undefinedResult.value).toBe(undefined)
      }
    })
  })

  describe('nested optional schemas', () => {
    const schema = optional(optional(string()))

    it('validates defined values through nested optionals', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('validates undefined through nested optionals', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(undefined)
      }
    })

    it('rejects invalid types through nested optionals', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })
  })

  describe('inner schema format constraints', () => {
    const schema = optional(string({ format: 'uri' }))

    it('validates values meeting format constraint', () => {
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(true)
    })

    it('validates undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
    })

    it('rejects values violating format constraint', () => {
      const result = schema.safeParse('not a uri')
      expect(result.success).toBe(false)
    })
  })

  describe('integer constraint validation', () => {
    const schema = optional(integer({ minimum: 0, maximum: 100 }))

    it('validates values within range', () => {
      const result = schema.safeParse(50)
      expect(result.success).toBe(true)
    })

    it('validates values at minimum boundary', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates values at maximum boundary', () => {
      const result = schema.safeParse(100)
      expect(result.success).toBe(true)
    })

    it('validates undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
    })

    it('rejects values below minimum', () => {
      const result = schema.safeParse(-1)
      expect(result.success).toBe(false)
    })

    it('rejects values above maximum', () => {
      const result = schema.safeParse(101)
      expect(result.success).toBe(false)
    })
  })
})
