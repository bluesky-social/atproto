import { describe, expect, it } from 'vitest'
import { integer } from './integer.js'
import { object } from './object.js'
import { string } from './string.js'
import { typedObject } from './typed-object.js'
import { typedRef } from './typed-ref.js'

describe('TypedRefSchema', () => {
  describe('basic validation', () => {
    it('validates through a typed object reference with explicit $type', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
          age: integer(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
          age: integer(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.wrong',
        name: 'Alice',
      })

      expect(result.success).toBe(false)
    })

    it('rejects invalid input through reference', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
          age: integer(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        age: 'thirty',
      })

      expect(result.success).toBe(false)
    })

    it('rejects non-objects through reference', () => {
      const typedObjectSchema = typedObject(
        'com.example.value',
        'main',
        object({
          value: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })

    it('rejects null through reference', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined through reference', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('$type property', () => {
    it('exposes the $type from the referenced schema', () => {
      const typedObjectSchema = typedObject(
        'com.example.post',
        'main',
        object({
          text: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      expect(schema.$type).toBe('com.example.post')
    })

    it('validates that output has correct $type', () => {
      const typedObjectSchema = typedObject(
        'com.example.like',
        'main',
        object({
          subject: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.follow',
        'main',
        object({
          subject: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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

      const schema = typedRef(() => {
        getterCalled = true
        return typedObject(
          'com.example.test',
          'main',
          object({
            value: string(),
          }),
        )
      })

      expect(getterCalled).toBe(false)

      schema.safeParse({ value: 'test' })
      expect(getterCalled).toBe(true)
    })

    it('does not call getter until $type is accessed', () => {
      let getterCalled = false

      const schema = typedRef(() => {
        getterCalled = true
        return typedObject(
          'com.example.test',
          'main',
          object({
            value: string(),
          }),
        )
      })

      expect(getterCalled).toBe(false)

      // Access $type should trigger getter
      const type = schema.$type
      expect(getterCalled).toBe(true)
      expect(type).toBe('com.example.test')
    })

    it('throws error if getter is called recursively', () => {
      // @ts-expect-error
      const schema = typedRef(() => {
        // This would cause infinite recursion if not protected
        return schema.validator
      })

      expect(() => {
        schema.safeParse({ value: 'test' })
      }).toThrow()
    })
  })

  describe('with constrained schemas', () => {
    it('validates typed object with string constraints', () => {
      const typedObjectSchema = typedObject(
        'com.example.post',
        'main',
        object({
          text: string({ minLength: 1, maxLength: 300 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.post',
        text: 'This is a valid post',
      })

      expect(result.success).toBe(true)
    })

    it('rejects typed object violating string constraints', () => {
      const typedObjectSchema = typedObject(
        'com.example.post',
        'main',
        object({
          text: string({ minLength: 1, maxLength: 300 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.post',
        text: '',
      })

      expect(result.success).toBe(false)
    })

    it('validates typed object with integer constraints', () => {
      const typedObjectSchema = typedObject(
        'com.example.rating',
        'main',
        object({
          score: integer({ minimum: 1, maximum: 5 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.rating',
        score: 4,
      })

      expect(result.success).toBe(true)
    })

    it('rejects typed object violating integer constraints', () => {
      const typedObjectSchema = typedObject(
        'com.example.rating',
        'main',
        object({
          score: integer({ minimum: 1, maximum: 5 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.rating',
        score: 10,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('multiple validations', () => {
    it('validates multiple inputs correctly', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string({ minLength: 2 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string({ minLength: 2 }),
          age: integer({ minimum: 0, maximum: 150 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.post',
        'main',
        object({
          text: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.empty',
        'main',
        object({}),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({ $type: 'com.example.empty' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.$type).toBe('com.example.empty')
      }
    })

    it('rejects arrays', () => {
      const typedObjectSchema = typedObject(
        'com.example.test',
        'main',
        object({
          value: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse([{ value: 'test' }])
      expect(result.success).toBe(false)
    })

    it('rejects primitive values', () => {
      const typedObjectSchema = typedObject(
        'com.example.test',
        'main',
        object({
          value: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result1 = schema.safeParse('string')
      expect(result1.success).toBe(false)

      const result2 = schema.safeParse(123)
      expect(result2.success).toBe(false)

      const result3 = schema.safeParse(true)
      expect(result3.success).toBe(false)
    })

    it('handles objects with extra properties', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.user',
        name: 'Alice',
        extra: 'property',
        another: 'value',
      })

      expect(result.success).toBe(true)
    })

    it('validates with zero values', () => {
      const typedObjectSchema = typedObject(
        'com.example.counter',
        'main',
        object({
          count: integer(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.counter',
        count: 0,
      })
      expect(result.success).toBe(true)
    })

    it('validates with empty strings', () => {
      const typedObjectSchema = typedObject(
        'com.example.text',
        'main',
        object({
          content: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.text',
        content: '',
      })
      expect(result.success).toBe(true)
    })

    it('rejects NaN in integer fields', () => {
      const typedObjectSchema = typedObject(
        'com.example.number',
        'main',
        object({
          value: integer(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.number',
        value: NaN,
      })
      expect(result.success).toBe(false)
    })

    it('rejects Infinity in integer fields', () => {
      const typedObjectSchema = typedObject(
        'com.example.number',
        'main',
        object({
          value: integer(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.number',
        value: Infinity,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('nested references', () => {
    it('validates through nested TypedRefSchema', () => {
      const typedObjectSchema = typedObject(
        'com.example.user',
        'main',
        object({
          name: string({ minLength: 2 }),
        }),
      )

      const innerRef = typedRef(() => typedObjectSchema)
      const outerRef = typedRef(() => innerRef.validator)

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
      const innerTyped = typedObject(
        'com.example.profile',
        'main',
        object({
          bio: string(),
        }),
      )

      const outerTyped = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
          profile: typedRef(() => innerTyped),
        }),
      )

      const schema = typedRef(() => outerTyped)

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
      const innerTyped = typedObject(
        'com.example.profile',
        'main',
        object({
          bio: string(),
        }),
      )

      const outerTyped = typedObject(
        'com.example.user',
        'main',
        object({
          name: string(),
          profile: typedRef(() => innerTyped),
        }),
      )

      const schema = typedRef(() => outerTyped)

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
      const typedObjectSchema = typedObject(
        'com.example.test',
        'main',
        object({
          value: string(),
        }),
      )

      const refSchema = typedRef(() => typedObjectSchema)

      const resolved = refSchema.validator
      expect(resolved).toBe(typedObjectSchema)
      expect(resolved.$type).toBe('com.example.test')
    })

    it('returns same instance on multiple schema property accesses', () => {
      const typedObjectSchema = typedObject(
        'com.example.test',
        'main',
        object({
          value: string(),
        }),
      )

      const refSchema = typedRef(() => typedObjectSchema)

      const first = refSchema.validator
      const second = refSchema.validator
      const third = refSchema.validator

      expect(first).toBe(second)
      expect(second).toBe(third)
      expect(first.$type).toBe('com.example.test')
    })
  })

  describe('complex object structures', () => {
    it('validates complex nested structure', () => {
      const typedObjectSchema = typedObject(
        'com.example.post',
        'main',
        object({
          text: string({ minLength: 1, maxLength: 300 }),
          createdAt: string({ format: 'datetime' }),
          likeCount: integer({ minimum: 0 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
      const typedObjectSchema = typedObject(
        'com.example.record',
        'main',
        object({
          id: string({ format: 'nsid' }),
          count: integer({ minimum: 0 }),
          flag: string(),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

      const result = schema.safeParse({
        $type: 'com.example.record',
        id: 'com.example.feed.post',
        count: 100,
        flag: 'active',
      })

      expect(result.success).toBe(true)
    })

    it('rejects structure with any invalid property', () => {
      const typedObjectSchema = typedObject(
        'com.example.record',
        'main',
        object({
          name: string({ minLength: 1 }),
          count: integer({ minimum: 0 }),
        }),
      )

      const schema = typedRef(() => typedObjectSchema)

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
