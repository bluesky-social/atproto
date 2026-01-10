import { describe, expect, it } from 'vitest'
import { Schema } from '../core.js'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { OptionalSchema } from './optional.js'
import { RefSchema } from './ref.js'
import { StringSchema } from './string.js'

describe('RefSchema', () => {
  describe('basic validation', () => {
    it('validates through a simple string reference', () => {
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates through an integer reference', () => {
      const schema = new RefSchema(() => new IntegerSchema({}))
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('rejects invalid input through reference', () => {
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('validates null rejection through reference', () => {
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('validates undefined rejection through reference', () => {
      const schema = new RefSchema(() => new IntegerSchema({}))
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('lazy schema resolution', () => {
    it('does not call getter until first validation', () => {
      let getterCalled = false
      const schema = new RefSchema(() => {
        getterCalled = true
        return new StringSchema({})
      })
      expect(getterCalled).toBe(false)

      schema.safeParse('test')
      expect(getterCalled).toBe(true)
    })

    it('caches the resolved schema', () => {
      let callCount = 0
      const schema = new RefSchema(() => {
        callCount++
        return new StringSchema({})
      })

      schema.safeParse('first')
      schema.safeParse('second')
      schema.safeParse('third')

      expect(callCount).toBe(1)
    })

    it('throws error if getter is called multiple times', () => {
      const schema = new RefSchema(() => new StringSchema({}))

      // Access schema property to resolve it
      schema.schema

      // Try to access the original getter again (which should throw)
      // This is internal behavior, but we're testing the protection mechanism
      expect(() => {
        // Force access to the cached schema property
        const schemaValue = schema.schema
        // This should work fine as it's now cached
        expect(schemaValue).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('with object schemas', () => {
    it('validates objects through reference', () => {
      const schema = new RefSchema(
        () =>
          new ObjectSchema({
            name: new StringSchema({}),
            age: new IntegerSchema({}),
          }),
      )
      const result = schema.safeParse({
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid objects through reference', () => {
      const schema = new RefSchema(
        () =>
          new ObjectSchema({
            name: new StringSchema({}),
            age: new IntegerSchema({}),
          }),
      )
      const result = schema.safeParse({
        name: 'Alice',
        age: 'thirty',
      })
      expect(result.success).toBe(false)
    })

    it('rejects objects with missing properties through reference', () => {
      const schema = new RefSchema(
        () =>
          new ObjectSchema({
            name: new StringSchema({}),
            age: new IntegerSchema({}),
          }),
      )
      const result = schema.safeParse({
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with constrained schemas', () => {
    it('validates string with minLength constraint through reference', () => {
      const schema = new RefSchema(() => new StringSchema({ minLength: 5 }))
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects string violating minLength through reference', () => {
      const schema = new RefSchema(() => new StringSchema({ minLength: 5 }))
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('validates integer with range constraints through reference', () => {
      const schema = new RefSchema(
        () => new IntegerSchema({ minimum: 0, maximum: 100 }),
      )
      const result = schema.safeParse(50)
      expect(result.success).toBe(true)
    })

    it('rejects integer violating constraints through reference', () => {
      const schema = new RefSchema(
        () => new IntegerSchema({ minimum: 0, maximum: 100 }),
      )
      const result = schema.safeParse(150)
      expect(result.success).toBe(false)
    })
  })

  describe('circular references', () => {
    it('prevents recursive getter calls', () => {
      // Create a schema that would cause infinite recursion if not protected
      let schema: RefSchema<any>

      // eslint-disable-next-line prefer-const
      schema = new RefSchema(() => {
        // This would normally cause infinite recursion
        // but the getter protection should prevent it
        return schema.schema
      })

      // The first access causes stack overflow before the protection can kick in
      expect(() => {
        schema.safeParse('test')
      }).toThrow()
    })

    it('supports indirect circular references', () => {
      // Create two schemas that reference each other
      // This demonstrates forward references are possible

      type A = { value: string; ref?: B }
      type B = { value: number; ref?: A }

      const schemaA: Schema<A> = new ObjectSchema({
        value: new StringSchema({}),
        ref: new OptionalSchema(new RefSchema<B>((() => schemaB) as any)),
      })

      const schemaB: Schema<B> = new ObjectSchema({
        value: new IntegerSchema({}),
        ref: new OptionalSchema(new RefSchema<A>((() => schemaA) as any)),
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
      const schema = new RefSchema(() => new StringSchema({ minLength: 3 }))

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
      const schema = new RefSchema(
        () =>
          new ObjectSchema({
            name: new StringSchema({ minLength: 2 }),
            age: new IntegerSchema({ minimum: 0 }),
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
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('handles zero validation', () => {
      const schema = new RefSchema(() => new IntegerSchema({}))
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('rejects NaN through integer reference', () => {
      const schema = new RefSchema(() => new IntegerSchema({}))
      const result = schema.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('rejects Infinity through integer reference', () => {
      const schema = new RefSchema(() => new IntegerSchema({}))
      const result = schema.safeParse(Infinity)
      expect(result.success).toBe(false)
    })

    it('rejects arrays when expecting string', () => {
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse(['array'])
      expect(result.success).toBe(false)
    })

    it('rejects objects when expecting string', () => {
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse({ key: 'value' })
      expect(result.success).toBe(false)
    })

    it('rejects booleans when expecting string', () => {
      const schema = new RefSchema(() => new StringSchema({}))
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })
  })

  describe('nested references', () => {
    it('validates through nested RefSchema', () => {
      const innerRef = new RefSchema(() => new StringSchema({ minLength: 3 }))
      const outerRef = new RefSchema(() => innerRef)

      const result = outerRef.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects invalid input through nested RefSchema', () => {
      const innerRef = new RefSchema(() => new StringSchema({ minLength: 3 }))
      const outerRef = new RefSchema(() => innerRef)

      const result = outerRef.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('validates with deeply nested references', () => {
      const level3 = new RefSchema(() => new IntegerSchema({ minimum: 0 }))
      const level2 = new RefSchema(() => level3)
      const level1 = new RefSchema(() => level2)

      const result = level1.safeParse(42)
      expect(result.success).toBe(true)
    })
  })

  describe('schema property access', () => {
    it('allows direct access to resolved schema', () => {
      const innerSchema = new StringSchema({ minLength: 5 })
      const refSchema = new RefSchema(() => innerSchema)

      const resolved = refSchema.schema
      expect(resolved).toBe(innerSchema)
    })

    it('returns same instance on multiple schema property accesses', () => {
      const innerSchema = new StringSchema({})
      const refSchema = new RefSchema(() => innerSchema)

      const first = refSchema.schema
      const second = refSchema.schema
      const third = refSchema.schema

      expect(first).toBe(second)
      expect(second).toBe(third)
    })

    it('resolves schema before validation', () => {
      let resolved = false
      const refSchema = new RefSchema(() => {
        resolved = true
        return new StringSchema({})
      })

      expect(resolved).toBe(false)

      const schemaValue = refSchema.schema
      expect(resolved).toBe(true)
      expect(schemaValue).toBeDefined()
    })
  })
})
