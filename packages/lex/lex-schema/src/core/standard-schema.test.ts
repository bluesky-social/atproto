import { assert, describe, expect, it } from 'vitest'
import { array } from '../schema/array.js'
import { integer } from '../schema/integer.js'
import { object } from '../schema/object.js'
import { optional } from '../schema/optional.js'
import { string } from '../schema/string.js'
import { withDefault } from '../schema/with-default.js'
import { LexValidationError } from './validation-error.js'

describe('StandardSchemaAdapter', () => {
  describe('metadata', () => {
    const schema = integer()

    it('has version 1', () => {
      expect(schema['~standard'].version).toBe(1)
    })

    it('has vendor @atproto/lex-schema', () => {
      expect(schema['~standard'].vendor).toBe('@atproto/lex-schema')
    })
  })

  describe('lazy caching', () => {
    it('returns the same adapter instance on repeated accesses', () => {
      const schema = integer()
      const first = schema['~standard']
      const second = schema['~standard']
      expect(first).toBe(second)
    })
  })

  describe('validate() result shape on success', () => {
    it('returns a value property for a valid integer', () => {
      const result = integer()['~standard'].validate(42)
      expect(result).toMatchObject({ value: 42 })
    })

    it('returns a value property for a valid string', () => {
      const result = string()['~standard'].validate('hello')
      expect(result).toMatchObject({ value: 'hello' })
    })

    it('does not include an issues property on success', () => {
      const result = integer()['~standard'].validate(1)
      expect(result).not.toHaveProperty('issues')
    })
  })

  describe('validate() result shape on failure', () => {
    it('returns a LexValidationError with issues for an invalid value', () => {
      const result = integer()['~standard'].validate('not-a-number')
      assert(result instanceof LexValidationError)
      expect(Array.isArray(result.issues)).toBe(true)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('does not include a value property on failure', () => {
      const result = integer()['~standard'].validate('not-a-number')
      expect(result).not.toHaveProperty('value')
    })

    describe('issues[].message', () => {
      it('is a non-empty string', () => {
        const result = integer()['~standard'].validate('not-a-number')
        assert(result instanceof LexValidationError)
        for (const issue of result.issues) {
          expect(typeof issue.message).toBe('string')
          expect(issue.message.length).toBeGreaterThan(0)
        }
      })

      it('describes the type mismatch', () => {
        const result = integer()['~standard'].validate('not-a-number')
        assert(result instanceof LexValidationError)
        expect(result.issues[0].message).toContain('integer')
      })
    })

    describe('issues[].path', () => {
      it('is an empty array for a root-level failure', () => {
        const result = integer()['~standard'].validate('not-a-number')
        assert(result instanceof LexValidationError)
        expect(result.issues[0].path).toEqual([])
      })

      it('reflects the property key for a nested object failure', () => {
        const schema = object({ age: integer() })
        const result = schema['~standard'].validate({ age: 'not-a-number' })
        assert(result instanceof LexValidationError)
        expect(result.issues[0].path).toContain('age')
      })

      it('reflects the index for an array element failure', () => {
        const schema = array(integer())
        const result = schema['~standard'].validate([1, 'bad', 3])
        assert(result instanceof LexValidationError)
        expect(result.issues[0].path).toContain(1)
      })
    })
  })

  describe('parse mode (default value application)', () => {
    it('applies default values when input is undefined', () => {
      const schema = withDefault(integer(), 10)
      const result = schema['~standard'].validate(undefined)
      expect(result).toMatchObject({ value: 10 })
    })

    it('uses the provided value instead of default when input is present', () => {
      const schema = withDefault(integer(), 10)
      const result = schema['~standard'].validate(42)
      expect(result).toMatchObject({ value: 42 })
    })

    it('applies defaults for optional object properties in parse mode', () => {
      const schema = object({
        name: string(),
        count: optional(withDefault(integer(), 0)),
      })
      const result = schema['~standard'].validate({ name: 'Alice' })
      expect(result).toMatchObject({ value: { name: 'Alice', count: 0 } })
    })
  })
})
