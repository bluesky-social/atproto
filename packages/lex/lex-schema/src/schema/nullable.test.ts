import { describe, expect, it } from 'vitest'
import { enumSchema } from './enum.js'
import { integer } from './integer.js'
import { nullable } from './nullable.js'
import { object } from './object.js'
import { string } from './string.js'
import { withDefault } from './with-default.js'

describe('NullableSchema', () => {
  describe('with StringSchema', () => {
    const schema = nullable(string())

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('validates valid string values', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('validates empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects objects', () => {
      const result = schema.safeParse({ value: 'test' })
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['hello'])
      expect(result.success).toBe(false)
    })
  })

  describe('with IntegerSchema', () => {
    const schema = nullable(integer())

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('validates valid integer values', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(42)
      }
    })

    it('validates zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates negative integers', () => {
      const result = schema.safeParse(-42)
      expect(result.success).toBe(true)
    })

    it('rejects floats', () => {
      const result = schema.safeParse(3.14)
      expect(result.success).toBe(false)
    })

    it('rejects strings', () => {
      const result = schema.safeParse('42')
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('with EnumSchema', () => {
    const schema = nullable(enumSchema(['red', 'green', 'blue']))

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('validates valid enum values', () => {
      expect(schema.safeParse('red').success).toBe(true)
      expect(schema.safeParse('green').success).toBe(true)
      expect(schema.safeParse('blue').success).toBe(true)
    })

    it('rejects invalid enum values', () => {
      const result = schema.safeParse('yellow')
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects empty string when not in enum', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('with constrained StringSchema', () => {
    const schema = nullable(string({ minLength: 3, maxLength: 10 }))

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
    })

    it('validates strings within constraints', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects strings below minimum length', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('rejects strings above maximum length', () => {
      const result = schema.safeParse('hello world!')
      expect(result.success).toBe(false)
    })

    it('accepts strings at minimum boundary', () => {
      const result = schema.safeParse('abc')
      expect(result.success).toBe(true)
    })

    it('accepts strings at maximum boundary', () => {
      const result = schema.safeParse('1234567890')
      expect(result.success).toBe(true)
    })
  })

  describe('with constrained IntegerSchema', () => {
    const schema = nullable(integer({ minimum: 0, maximum: 100 }))

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
    })

    it('validates integers within constraints', () => {
      const result = schema.safeParse(50)
      expect(result.success).toBe(true)
    })

    it('validates minimum value', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates maximum value', () => {
      const result = schema.safeParse(100)
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

  describe('with StringSchema having default value', () => {
    const schema = nullable(withDefault(string(), 'default'))

    it('validates null explicitly', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('uses default value when undefined is provided', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('default')
      }
    })

    it('validates explicit string values', () => {
      const result = schema.safeParse('custom')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('custom')
      }
    })
  })

  describe('with ObjectSchema', () => {
    const schema = nullable(
      object({
        name: string(),
        age: integer(),
      }),
    )

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('validates valid objects', () => {
      const result = schema.safeParse({ name: 'Alice', age: 30 })
      expect(result.success).toBe(true)
    })

    it('rejects invalid objects with missing properties', () => {
      const result = schema.safeParse({ name: 'Alice' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid objects with wrong types', () => {
      const result = schema.safeParse({ name: 'Alice', age: 'thirty' })
      expect(result.success).toBe(false)
    })

    it('rejects empty objects', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects primitive values', () => {
      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })
  })

  describe('nested nullable schemas', () => {
    const schema = nullable(nullable(string()))

    it('validates null at outer level', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('validates valid string values', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects invalid types', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })
  })

  describe('with StringSchema format constraints', () => {
    const schema = nullable(string({ format: 'uri' }))

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
    })

    it('validates valid URIs', () => {
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(true)
    })

    it('rejects invalid URIs', () => {
      const result = schema.safeParse('not a uri')
      expect(result.success).toBe(false)
    })

    it('rejects invalid format even with valid string', () => {
      const result = schema.safeParse('just a string')
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    const stringSchema = nullable(string())

    it('handles null correctly without coercion', () => {
      const result = stringSchema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
        expect(result.value).not.toBe(undefined)
        expect(result.value).not.toBe('')
        expect(result.value).not.toBe(0)
        expect(result.value).not.toBe(false)
      }
    })

    it('distinguishes null from falsy values', () => {
      expect(stringSchema.safeParse(null).success).toBe(true)
      expect(stringSchema.safeParse(undefined).success).toBe(false)
      expect(stringSchema.safeParse('').success).toBe(true)
      expect(stringSchema.safeParse(0).success).toBe(false)
      expect(stringSchema.safeParse(false).success).toBe(false)
    })

    it('handles NaN correctly', () => {
      const result = stringSchema.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('handles Symbol correctly', () => {
      const result = stringSchema.safeParse(Symbol('test'))
      expect(result.success).toBe(false)
    })
  })

  describe('type preservation', () => {
    it('preserves string type for valid strings', () => {
      const schema = nullable(string())
      const result = schema.safeParse('test')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.value).toBe('string')
        expect(result.value).toBe('test')
      }
    })

    it('preserves number type for valid integers', () => {
      const schema = nullable(integer())
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.value).toBe('number')
        expect(result.value).toBe(42)
      }
    })

    it('preserves object type for valid objects', () => {
      const schema = nullable(object({ key: string() }))
      const input = { key: 'value' }
      const result = schema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.value).toBe('object')
        expect(result.value).toEqual({ key: 'value' })
      }
    })

    it('preserves null type exactly', () => {
      const schema = nullable(string())
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
        expect(result.value === null).toBe(true)
        expect(typeof result.value).toBe('object')
      }
    })
  })

  describe('with complex wrapped schemas', () => {
    it('validates nullable enum with default', () => {
      const schema = nullable(
        withDefault(enumSchema(['option1', 'option2']), 'option1'),
      )

      expect(schema.safeParse(null).success).toBe(true)
      expect(schema.safeParse('option1').success).toBe(true)
      expect(schema.safeParse('option2').success).toBe(true)
      expect(schema.safeParse(undefined).success).toBe(true)
      expect(schema.safeParse('invalid').success).toBe(false)
    })

    it('handles nullable schema with grapheme constraints', () => {
      const schema = nullable(string({ minGraphemes: 2, maxGraphemes: 5 }))

      expect(schema.safeParse(null).success).toBe(true)
      expect(schema.safeParse('ab').success).toBe(true)
      expect(schema.safeParse('hello').success).toBe(true)
      expect(schema.safeParse('a').success).toBe(false)
      expect(schema.safeParse('hello!').success).toBe(false)
    })

    it('handles nullable integer with negative range', () => {
      const schema = nullable(integer({ minimum: -100, maximum: -10 }))

      expect(schema.safeParse(null).success).toBe(true)
      expect(schema.safeParse(-50).success).toBe(true)
      expect(schema.safeParse(-100).success).toBe(true)
      expect(schema.safeParse(-10).success).toBe(true)
      expect(schema.safeParse(0).success).toBe(false)
      expect(schema.safeParse(-5).success).toBe(false)
      expect(schema.safeParse(-150).success).toBe(false)
    })
  })

  describe('validation error behavior', () => {
    it('returns failure for wrapped schema validation errors', () => {
      const schema = nullable(integer({ minimum: 10 }))
      const result = schema.safeParse(5)
      expect(result.success).toBe(false)
    })

    it('returns failure for type mismatches', () => {
      const schema = nullable(string())
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('returns success for null regardless of wrapped constraints', () => {
      const schema = nullable(string({ minLength: 100, format: 'uri' }))
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
    })

    it('wrapped schema validation applies when value is not null', () => {
      const schema = nullable(string({ minLength: 5 }))
      expect(schema.safeParse(null).success).toBe(true)
      expect(schema.safeParse('hello').success).toBe(true)
      expect(schema.safeParse('hi').success).toBe(false)
    })
  })
})
