import { describe, expect, it } from 'vitest'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'
import { TypedObjectSchema } from './typed-object.js'
import { TypedRefSchema } from './typed-ref.js'

describe('TypedRefSchema', () => {
  describe('basic validation', () => {
    it('validates through a typed object reference with explicit $type', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
          age: new IntegerSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        age: 30,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.user')
      }
    })

    it('validates through a typed object with explicit $type', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
          age: new IntegerSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        age: 30,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.user')
      }
    })

    it('rejects input with wrong $type', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.wrong',
        name: 'Alice',
      })

      expect(result.success).toBe(false)
    })

    it('rejects invalid input through reference', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
          age: new IntegerSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        age: 'thirty',
      })

      expect(result.success).toBe(false)
    })

    it('rejects non-objects through reference', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.value',
        new ObjectSchema({
          value: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })

    it('rejects null through reference', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined through reference', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('$type property', () => {
    it('exposes the $type from the referenced schema', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.post',
        new ObjectSchema({
          text: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      expect(schema.$type).toBe('com.example.post')
    })

    it('validates that output has correct $type', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.like',
        new ObjectSchema({
          subject: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.like',
        subject: 'at://did:plc:abc/app.bsky.feed.post/123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.like')
      }
    })

    it('ensures $type matches expected value', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.follow',
        new ObjectSchema({
          subject: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      // Try to pass wrong $type
      const result = schema.safeParse({
        $type: 'com.example.block',
        subject: 'did:plc:abc',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('lazy schema resolution', () => {
    it('does not call getter until first validation', () => {
      let getterCalled = false

      const schema = new TypedRefSchema(() => {
        getterCalled = true
        return new TypedObjectSchema(
          'com.example.test',
          new ObjectSchema({
            value: new StringSchema({}),
          }),
        )
      })

      expect(getterCalled).toBe(false)

      schema.safeParse({ value: 'test' })
      expect(getterCalled).toBe(true)
    })

    it('does not call getter until $type is accessed', () => {
      let getterCalled = false

      const schema = new TypedRefSchema(() => {
        getterCalled = true
        return new TypedObjectSchema(
          'com.example.test',
          new ObjectSchema({
            value: new StringSchema({}),
          }),
        )
      })

      expect(getterCalled).toBe(false)

      // Access $type should trigger getter
      const type = schema.$type
      expect(getterCalled).toBe(true)
      expect(type).toBe('com.example.test')
    })

    it('caches the resolved schema', () => {
      let callCount = 0

      const schema = new TypedRefSchema(() => {
        callCount++
        return new TypedObjectSchema(
          'com.example.test',
          new ObjectSchema({
            value: new StringSchema({}),
          }),
        )
      })

      schema.safeParse({ value: 'first' })
      schema.safeParse({ value: 'second' })
      schema.safeParse({ value: 'third' })

      expect(callCount).toBe(1)
    })

    it('caches schema after $type access', () => {
      let callCount = 0

      const schema = new TypedRefSchema(() => {
        callCount++
        return new TypedObjectSchema(
          'com.example.test',
          new ObjectSchema({
            value: new StringSchema({}),
          }),
        )
      })

      // Access $type first
      schema.$type
      expect(callCount).toBe(1)

      // Then validate multiple times
      schema.safeParse({ value: 'test1' })
      schema.safeParse({ value: 'test2' })

      expect(callCount).toBe(1)
    })

    it('throws error if getter is called recursively', () => {
      // @ts-expect-error
      const schema = new TypedRefSchema(() => {
        // This would cause infinite recursion if not protected
        return schema.schema
      })

      expect(() => {
        schema.safeParse({ value: 'test' })
      }).toThrow()
    })
  })

  describe('with constrained schemas', () => {
    it('validates typed object with string constraints', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.post',
        new ObjectSchema({
          text: new StringSchema({ minLength: 1, maxLength: 300 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.post',
        text: 'This is a valid post',
      })

      expect(result.success).toBe(true)
    })

    it('rejects typed object violating string constraints', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.post',
        new ObjectSchema({
          text: new StringSchema({ minLength: 1, maxLength: 300 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.post',
        text: '',
      })

      expect(result.success).toBe(false)
    })

    it('validates typed object with integer constraints', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.rating',
        new ObjectSchema({
          score: new IntegerSchema({ minimum: 1, maximum: 5 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.rating',
        score: 4,
      })

      expect(result.success).toBe(true)
    })

    it('rejects typed object violating integer constraints', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.rating',
        new ObjectSchema({
          score: new IntegerSchema({ minimum: 1, maximum: 5 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.rating',
        score: 10,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('multiple validations', () => {
    it('validates multiple inputs correctly', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({ minLength: 2 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result1 = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
      })
      expect(result1.success).toBe(true)

      const result2 = schema.safeParse({ $type: 'com.example.user', name: 'A' })
      expect(result2.success).toBe(false)

      const result3 = schema.safeParse({
        $type: 'com.example.user',
        name: 'Bob',
      })
      expect(result3.success).toBe(true)

      const result4 = schema.safeParse({ $type: 'com.example.user', name: '' })
      expect(result4.success).toBe(false)
    })

    it('handles different types of validation failures', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({ minLength: 2 }),
          age: new IntegerSchema({ minimum: 0, maximum: 150 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result1 = schema.safeParse({
        $type: 'com.example.user',
        name: 'A',
        age: 25,
      })
      expect(result1.success).toBe(false)

      const result2 = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        age: 200,
      })
      expect(result2.success).toBe(false)

      const result3 = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        age: 25,
      })
      expect(result3.success).toBe(true)

      const result4 = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
      })
      expect(result4.success).toBe(false)
    })

    it('validates same input multiple times consistently', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.post',
        new ObjectSchema({
          text: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const input = { $type: 'com.example.post', text: 'Hello world' }

      const result1 = schema.safeParse(input)
      const result2 = schema.safeParse(input)
      const result3 = schema.safeParse(input)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result3.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles empty object validation', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.empty',
        new ObjectSchema({}),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({ $type: 'com.example.empty' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.empty')
      }
    })

    it('rejects arrays', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.test',
        new ObjectSchema({
          value: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse([{ value: 'test' }])
      expect(result.success).toBe(false)
    })

    it('rejects primitive values', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.test',
        new ObjectSchema({
          value: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result1 = schema.safeParse('string')
      expect(result1.success).toBe(false)

      const result2 = schema.safeParse(123)
      expect(result2.success).toBe(false)

      const result3 = schema.safeParse(true)
      expect(result3.success).toBe(false)
    })

    it('handles objects with extra properties', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        extra: 'property',
        another: 'value',
      })

      expect(result.success).toBe(true)
    })

    it('validates with zero values', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.counter',
        new ObjectSchema({
          count: new IntegerSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.counter',
        count: 0,
      })
      expect(result.success).toBe(true)
    })

    it('validates with empty strings', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.text',
        new ObjectSchema({
          content: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.text',
        content: '',
      })
      expect(result.success).toBe(true)
    })

    it('rejects NaN in integer fields', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.number',
        new ObjectSchema({
          value: new IntegerSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.number',
        value: NaN,
      })
      expect(result.success).toBe(false)
    })

    it('rejects Infinity in integer fields', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.number',
        new ObjectSchema({
          value: new IntegerSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.number',
        value: Infinity,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('nested references', () => {
    it('validates through nested TypedRefSchema', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({ minLength: 2 }),
        }),
      )

      const innerRef = new TypedRefSchema(() => typedObject)
      const outerRef = new TypedRefSchema(() => innerRef.schema)

      const result = outerRef.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.user')
      }
    })

    it('validates with objects containing TypedRef fields', () => {
      const innerTyped = new TypedObjectSchema(
        'com.example.profile',
        new ObjectSchema({
          bio: new StringSchema({}),
        }),
      )

      const outerTyped = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
          profile: new TypedRefSchema(() => innerTyped),
        }),
      )

      const schema = new TypedRefSchema(() => outerTyped)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        profile: {
          $type: 'com.example.profile',
          bio: 'Software developer',
        },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.user')
        expect(result.value.profile.$type).toBe('com.example.profile')
      }
    })

    it('rejects nested objects with wrong $type', () => {
      const innerTyped = new TypedObjectSchema(
        'com.example.profile',
        new ObjectSchema({
          bio: new StringSchema({}),
        }),
      )

      const outerTyped = new TypedObjectSchema(
        'com.example.user',
        new ObjectSchema({
          name: new StringSchema({}),
          profile: new TypedRefSchema(() => innerTyped),
        }),
      )

      const schema = new TypedRefSchema(() => outerTyped)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        profile: {
          $type: 'com.example.wrongtype',
          bio: 'Software developer',
        },
      })

      expect(result.success).toBe(false)
    })
  })

  describe('schema property access', () => {
    it('allows direct access to resolved schema', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.test',
        new ObjectSchema({
          value: new StringSchema({}),
        }),
      )

      const refSchema = new TypedRefSchema(() => typedObject)

      const resolved = refSchema.schema
      expect(resolved).toBe(typedObject)
      expect(resolved.$type).toBe('com.example.test')
    })

    it('returns same instance on multiple schema property accesses', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.test',
        new ObjectSchema({
          value: new StringSchema({}),
        }),
      )

      const refSchema = new TypedRefSchema(() => typedObject)

      const first = refSchema.schema
      const second = refSchema.schema
      const third = refSchema.schema

      expect(first).toBe(second)
      expect(second).toBe(third)
      expect(first.$type).toBe('com.example.test')
    })

    it('resolves schema before validation', () => {
      let resolved = false

      const refSchema = new TypedRefSchema(() => {
        resolved = true
        return new TypedObjectSchema(
          'com.example.test',
          new ObjectSchema({
            value: new StringSchema({}),
          }),
        )
      })

      expect(resolved).toBe(false)

      const schemaValue = refSchema.schema
      expect(resolved).toBe(true)
      expect(schemaValue).toBeDefined()
      expect(schemaValue.$type).toBe('com.example.test')
    })
  })

  describe('complex object structures', () => {
    it('validates complex nested structure', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.post',
        new ObjectSchema({
          text: new StringSchema({ minLength: 1, maxLength: 300 }),
          createdAt: new StringSchema({ format: 'datetime' }),
          likeCount: new IntegerSchema({ minimum: 0 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.post',
        text: 'Hello world!',
        createdAt: '2023-01-01T00:00:00Z',
        likeCount: 42,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.post')
        expect(result.value.text).toBe('Hello world!')
        expect(result.value.likeCount).toBe(42)
      }
    })

    it('validates structure with multiple property types', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.record',
        new ObjectSchema({
          id: new StringSchema({ format: 'nsid' }),
          count: new IntegerSchema({ minimum: 0 }),
          flag: new StringSchema({}),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      const result = schema.safeParse({
        $type: 'com.example.record',
        id: 'com.example.feed.post',
        count: 100,
        flag: 'active',
      })

      expect(result.success).toBe(true)
    })

    it('rejects structure with any invalid property', () => {
      const typedObject = new TypedObjectSchema(
        'com.example.record',
        new ObjectSchema({
          name: new StringSchema({ minLength: 1 }),
          count: new IntegerSchema({ minimum: 0 }),
        }),
      )

      const schema = new TypedRefSchema(() => typedObject)

      // Valid name, invalid count
      const result1 = schema.safeParse({
        $type: 'com.example.record',
        name: 'test',
        count: -5,
      })
      expect(result1.success).toBe(false)

      // Invalid name, valid count
      const result2 = schema.safeParse({
        $type: 'com.example.record',
        name: '',
        count: 5,
      })
      expect(result2.success).toBe(false)

      // Both invalid
      const result3 = schema.safeParse({
        $type: 'com.example.record',
        name: '',
        count: -5,
      })
      expect(result3.success).toBe(false)
    })
  })
})
