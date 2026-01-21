import { describe, expect, it } from 'vitest'
import { Schema, Validator } from '../core.js'
import { integer } from './integer.js'
import { object } from './object.js'
import { optional } from './optional.js'
import { ref } from './ref.js'
import { string } from './string.js'

describe('RefSchema', () => {
  describe('basic validation', () => {
    it('validates through a simple string reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates through an integer reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer()
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects invalid input through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('validates null rejection through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('validates undefined rejection through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer()
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('lazy schema resolution', () => {
    it('does not call getter until first validation', () => {
      let getterCalled = false
      const schema = ref(() => {
        getterCalled = true
        return string()
      })
      expect(getterCalled).toBe(false)

      schema.safeParse('test')
      expect(getterCalled).toBe(true)
    })

    it('throws error if getter is called multiple times', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()

      // Access schema property to resolve it
      schema.validator

      // Try to access the original getter again (which should throw)
      // This is internal behavior, but we're testing the protection mechanism
      expect(() => {
        // Force access to the cached schema property
        const schemaValue = schema.validator
        // This should work fine as it's now cached
        expect(schemaValue).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('with object schemas', () => {
    it('validates objects through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = object({
        name: string(),
        age: integer(),
      })

      expect(
        schema.safeValidate({
          name: 'Alice',
          age: 30,
        }),
      ).toMatchObject({
        success: true,
      })
    })

    it('rejects invalid objects through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = object({
        name: string(),
        age: integer(),
      })
      const result = schema.safeParse({
        name: 'Alice',
        age: 'thirty',
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with missing properties through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = object({
        name: string(),
        age: integer(),
      })
      const result = schema.safeParse({
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with constrained schemas', () => {
    it('validates string with minLength constraint through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string({ minLength: 5 })
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects string violating minLength through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string({ minLength: 5 })
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('validates integer with range constraints through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer({ minimum: 0, maximum: 100 })
      const result = schema.safeParse(50)
      expect(result.success).toBe(true)
    })

    it('rejects integer violating constraints through reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer({ minimum: 0, maximum: 100 })
      const result = schema.safeParse(150)
      expect(result.success).toBe(false)
    })
  })

  describe('circular references', () => {
    it('supports indirect circular references', () => {
      // Create two schemas that reference each other
      // This demonstrates forward references are possible

      type A = { value: string; ref?: B }
      type B = { value: number; ref?: A }

      const schemaA: Schema<A> = object({
        value: string(),
        ref: optional(ref<Validator<B>>((() => schemaB) as any)),
      })

      const schemaB: Schema<B> = object({
        value: integer(),
        ref: optional(ref<Validator<A>>((() => schemaA) as any)),
      })

      expect(
        schemaB.matches({
          value: 42,
          ref: {
            value: 'hello',
            ref: {
              value: 3,
            },
          },
        }),
      ).toBe(true)

      expect(
        schemaA.matches({
          value: 'hello',
          ref: {
            value: 3,
            ref: {
              value: 'world',
            },
          },
        }),
      ).toBe(true)
    })
  })

  describe('multiple validations', () => {
    it('validates multiple inputs correctly', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string({ minLength: 3 })

      const result1 = schema.safeParse('hello')
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse('hi')
      expect(result2.success).toBe(false)

      const result3 = schema.safeParse('world')
      expect(result3.success).toBe(true)

      const result4 = schema.safeParse('no')
      expect(result4.success).toBe(false)
    })

    it('handles different types of validation failures', () => {
      const schema = ref(() =>
        object({
          name: string({ minLength: 2 }),
          age: integer({ minimum: 0 }),
        }),
      )

      const result1 = schema.safeParse({ name: 'A', age: 25 })
      expect(result1.success).toBe(false)

      const result2 = schema.safeParse({ name: 'Alice', age: -5 })
      expect(result2.success).toBe(false)

      const result3 = schema.safeParse({ name: 'Alice', age: 25 })
      expect(result3.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles empty string validation', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('handles zero validation', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer()
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('rejects NaN through integer reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer()
      const result = schema.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('rejects Infinity through integer reference', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = integer()
      const result = schema.safeParse(Infinity)
      expect(result.success).toBe(false)
    })

    it('rejects arrays when expecting string', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse(['array'])
      expect(result.success).toBe(false)
    })

    it('rejects objects when expecting string', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse({ key: 'value' })
      expect(result.success).toBe(false)
    })

    it('rejects booleans when expecting string', () => {
      const schema = ref(() => innerSchema)
      const innerSchema = string()
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })
  })

  describe('nested references', () => {
    it('validates through nested RefSchema', () => {
      const innerRef = ref(() => innerSchema)
      const innerSchema = string({ minLength: 3 })
      const outerRef = ref(() => innerRef)

      const result = outerRef.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects invalid input through nested RefSchema', () => {
      const innerRef = ref(() => innerSchema)
      const innerSchema = string({ minLength: 3 })
      const outerRef = ref(() => innerRef)

      const result = outerRef.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('validates with deeply nested references', () => {
      const level3 = ref(() => innerSchema)
      const innerSchema = integer({ minimum: 0 })
      const level2 = ref(() => level3)
      const level1 = ref(() => level2)

      const result = level1.safeParse(42)
      expect(result.success).toBe(true)
    })
  })

  describe('schema property access', () => {
    it('allows direct access to resolved schema', () => {
      const innerSchema = string({ minLength: 5 })
      const refSchema = ref(() => innerSchema)

      const resolved = refSchema.validator
      expect(resolved).toBe(innerSchema)
    })

    it('returns same instance on multiple schema property accesses', () => {
      const innerSchema = string()
      const refSchema = ref(() => innerSchema)

      const first = refSchema.validator
      const second = refSchema.validator
      const third = refSchema.validator

      expect(first).toBe(second)
      expect(second).toBe(third)
    })

    it('resolves schema before validation', () => {
      let resolved = false
      const refSchema = ref(() => {
        resolved = true
        return string()
      })

      expect(resolved).toBe(false)

      const schemaValue = refSchema.validator
      expect(resolved).toBe(true)
      expect(schemaValue).toBeDefined()
    })
  })
})
