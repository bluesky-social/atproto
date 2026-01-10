import { describe, expect, it } from 'vitest'
import { EnumSchema } from './enum.js'
import { IntegerSchema } from './integer.js'
import { NullableSchema } from './nullable.js'
import { ObjectSchema } from './object.js'
import { OptionalSchema } from './optional.js'
import { StringSchema } from './string.js'
import { TypedObjectSchema } from './typed-object.js'

describe('TypedObjectSchema', () => {
  const schema = new TypedObjectSchema(
    'app.bsky.feed.post#main',
    new ObjectSchema({
      text: new StringSchema({}),
      likes: new OptionalSchema(new IntegerSchema({})),
    }),
  )

  describe('basic validation', () => {
    it('validates plain objects without $type', () => {
      const result = schema.safeParse({
        text: 'Hello world',
        likes: 5,
      })
      expect(result.success).toBe(true)
    })

    it('validates plain objects with matching $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post#main',
        text: 'Hello world',
        likes: 5,
      })
      expect(result.success).toBe(true)
    })

    it('rejects objects with non-matching $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.like#main',
        text: 'Hello world',
        likes: 5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-objects', () => {
      const result = schema.safeParse('not an object')
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

    it('rejects arrays', () => {
      const result = schema.safeParse(['text', 5])
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
  })

  describe('property validation', () => {
    it('rejects missing required properties', () => {
      const result = schema.safeParse({
        likes: 5,
      })
      expect(result.success).toBe(false)
    })

    it('validates optional properties', () => {
      const result = schema.safeParse({
        text: 'Hello world',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid property types', () => {
      const result = schema.safeParse({
        text: 'Hello world',
        likes: 'five',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid required property types', () => {
      const result = schema.safeParse({
        text: 123,
        likes: 5,
      })
      expect(result.success).toBe(false)
    })

    it('ignores extra properties', () => {
      const result = schema.safeParse({
        text: 'Hello world',
        likes: 5,
        extra: 'value',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('$type validation', () => {
    it('treats undefined $type as valid', () => {
      const result = schema.safeParse({
        $type: undefined,
        text: 'Hello world',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty string $type', () => {
      const result = schema.safeParse({
        $type: '',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects numeric $type', () => {
      const result = schema.safeParse({
        $type: 123,
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects object $type', () => {
      const result = schema.safeParse({
        $type: { type: 'app.bsky.feed.post#main' },
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects partial match $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects $type with extra characters', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post#main-extra',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects case-mismatched $type', () => {
      const result = schema.safeParse({
        $type: 'APP.BSKY.FEED.POST#MAIN',
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('isTypeOf method', () => {
    it('returns true for objects without $type', () => {
      const obj = { text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(true)
    })

    it('returns true for objects with undefined $type', () => {
      const obj = { $type: undefined, text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(true)
    })

    it('returns true for objects with matching $type', () => {
      const obj = { $type: 'app.bsky.feed.post#main', text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(true)
    })

    it('returns false for objects with non-matching $type', () => {
      const obj = { $type: 'app.bsky.feed.like#main', text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(false)
    })

    it('returns false for objects with empty $type', () => {
      const obj = { $type: '', text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(false)
    })

    it('returns false for objects with numeric $type', () => {
      const obj = { $type: 123, text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(false)
    })
  })

  describe('$isTypeOf method', () => {
    it('returns true for objects without $type', () => {
      const obj = { text: 'Hello' }
      expect(schema.$isTypeOf(obj)).toBe(true)
    })

    it('returns true for objects with matching $type', () => {
      const obj = { $type: 'app.bsky.feed.post#main', text: 'Hello' }
      expect(schema.$isTypeOf(obj)).toBe(true)
    })

    it('returns false for objects with non-matching $type', () => {
      const obj = { $type: 'app.bsky.feed.like#main', text: 'Hello' }
      expect(schema.$isTypeOf(obj)).toBe(false)
    })

    it('behaves identically to isTypeOf', () => {
      const obj1 = { text: 'Hello' }
      const obj2 = { $type: 'app.bsky.feed.post#main', text: 'Hello' }
      const obj3 = { $type: 'app.bsky.feed.like#main', text: 'Hello' }

      expect(schema.$isTypeOf(obj1)).toBe(schema.isTypeOf(obj1))
      expect(schema.$isTypeOf(obj2)).toBe(schema.isTypeOf(obj2))
      expect(schema.$isTypeOf(obj3)).toBe(schema.isTypeOf(obj3))
    })
  })

  describe('build method', () => {
    it('adds $type to object without $type', () => {
      const input = { text: 'Hello world', likes: 5 }
      const result = schema.build(input)
      expect(result).toEqual({
        text: 'Hello world',
        likes: 5,
        $type: 'app.bsky.feed.post#main',
      })
    })

    it('adds $type to object with only required properties', () => {
      const input = { text: 'Hello world' }
      const result = schema.build(input)
      expect(result).toEqual({
        text: 'Hello world',
        $type: 'app.bsky.feed.post#main',
      })
    })

    it('preserves existing properties', () => {
      const input = { text: 'Hello', likes: 10, extra: 'value' } as any
      const result = schema.build(input)
      expect(result).toEqual({
        text: 'Hello',
        likes: 10,
        extra: 'value',
        $type: 'app.bsky.feed.post#main',
      })
    })

    it('does not mutate the input object', () => {
      const input = { text: 'Hello world', likes: 5 }
      const inputCopy = { ...input }
      schema.build(input)
      expect(input).toEqual(inputCopy)
    })

    it('adds $type to empty object', () => {
      const emptySchema = new TypedObjectSchema(
        'app.bsky.test#main',
        new ObjectSchema({}),
      )
      const input = {}
      const result = emptySchema.build(input)
      expect(result).toEqual({ $type: 'app.bsky.test#main' })
    })
  })

  describe('$build method', () => {
    it('adds $type to object without $type', () => {
      const input = { text: 'Hello world', likes: 5 }
      const result = schema.$build(input)
      expect(result).toEqual({
        text: 'Hello world',
        likes: 5,
        $type: 'app.bsky.feed.post#main',
      })
    })

    it('behaves identically to build', () => {
      const input1 = { text: 'Hello world', likes: 5 }
      const input2 = { text: 'Another post' }

      expect(schema.$build(input1)).toEqual(schema.build(input1))
      expect(schema.$build(input2)).toEqual(schema.build(input2))
    })

    it('does not mutate the input object', () => {
      const input = { text: 'Hello world' }
      const inputCopy = { ...input }
      schema.$build(input)
      expect(input).toEqual(inputCopy)
    })
  })

  describe('with complex nested schemas', () => {
    const complexSchema = new TypedObjectSchema(
      'app.bsky.actor.profile#main',
      new ObjectSchema({
        displayName: new StringSchema({}),
        bio: new OptionalSchema(new StringSchema({ maxLength: 256 })),
        followerCount: new OptionalSchema(new IntegerSchema({ minimum: 0 })),
        verified: new OptionalSchema(
          new NullableSchema(new EnumSchema([true, false])),
        ),
      }),
    )

    it('validates complex nested structure', () => {
      const result = complexSchema.safeParse({
        displayName: 'John Doe',
        bio: 'Software developer',
        followerCount: 1000,
        verified: true,
      })
      expect(result.success).toBe(true)
    })

    it('validates with nullable property set to null', () => {
      const result = complexSchema.safeParse({
        displayName: 'John Doe',
        verified: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects when nested constraint is violated', () => {
      const result = complexSchema.safeParse({
        displayName: 'John Doe',
        followerCount: -1,
      })
      expect(result.success).toBe(false)
    })

    it('rejects when string exceeds maxLength', () => {
      const result = complexSchema.safeParse({
        displayName: 'John Doe',
        bio: 'x'.repeat(257),
      })
      expect(result.success).toBe(false)
    })

    it('validates with matching $type', () => {
      const result = complexSchema.safeParse({
        $type: 'app.bsky.actor.profile#main',
        displayName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })

    it('rejects with non-matching $type', () => {
      const result = complexSchema.safeParse({
        $type: 'app.bsky.feed.post#main',
        displayName: 'John Doe',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with different $type formats', () => {
    it('validates with main type', () => {
      const mainSchema = new TypedObjectSchema(
        'app.bsky.feed.post#main',
        new ObjectSchema({ text: new StringSchema({}) }),
      )
      const result = mainSchema.safeParse({ text: 'Hello' })
      expect(result.success).toBe(true)
    })

    it('validates with custom fragment', () => {
      const fragmentSchema = new TypedObjectSchema(
        'app.bsky.feed.post#reply',
        new ObjectSchema({ text: new StringSchema({}) }),
      )
      const result = fragmentSchema.safeParse({
        $type: 'app.bsky.feed.post#reply',
        text: 'Hello',
      })
      expect(result.success).toBe(true)
    })

    it('distinguishes between different fragments', () => {
      const replySchema = new TypedObjectSchema(
        'app.bsky.feed.post#reply',
        new ObjectSchema({ text: new StringSchema({}) }),
      )
      const result = replySchema.safeParse({
        $type: 'app.bsky.feed.post#quote',
        text: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('validates with long NSID', () => {
      const longSchema = new TypedObjectSchema(
        'com.example.app.feature.action.detail#variant',
        new ObjectSchema({ value: new StringSchema({}) }),
      )
      const result = longSchema.safeParse({
        $type: 'com.example.app.feature.action.detail#variant',
        value: 'test',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('validates object with only extra properties', () => {
      const minimalSchema = new TypedObjectSchema(
        'app.bsky.test#main',
        new ObjectSchema({}),
      )
      const result = minimalSchema.safeParse({
        extra1: 'value1',
        extra2: 'value2',
      })
      expect(result.success).toBe(true)
    })

    it('validates empty object with no required properties', () => {
      const minimalSchema = new TypedObjectSchema(
        'app.bsky.test#main',
        new ObjectSchema({}),
      )
      const result = minimalSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('validates with $type as only property', () => {
      const minimalSchema = new TypedObjectSchema(
        'app.bsky.test#main',
        new ObjectSchema({}),
      )
      const result = minimalSchema.safeParse({
        $type: 'app.bsky.test#main',
      })
      expect(result.success).toBe(true)
    })

    it('rejects object with prototype properties', () => {
      const obj = Object.create({ inherited: 'value' })
      obj.text = 'Hello world'
      const result = schema.safeParse(obj)
      expect(result.success).toBe(false)
    })

    it('rejects Date objects', () => {
      const result = schema.safeParse(new Date())
      expect(result.success).toBe(false)
    })

    it('rejects RegExp objects', () => {
      const result = schema.safeParse(/pattern/)
      expect(result.success).toBe(false)
    })

    it('rejects Error objects', () => {
      const result = schema.safeParse(new Error('test'))
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

    it('rejects class instances', () => {
      class CustomClass {
        text = 'Hello'
      }
      const result = schema.safeParse(new CustomClass())
      expect(result.success).toBe(false)
    })
  })

  describe('integration with all property types', () => {
    const fullSchema = new TypedObjectSchema(
      'app.bsky.test#full',
      new ObjectSchema({
        required: new StringSchema({}),
        optional: new OptionalSchema(new StringSchema({})),
        nullable: new NullableSchema(new StringSchema({})),
        optionalNullable: new OptionalSchema(
          new NullableSchema(new StringSchema({})),
        ),
      }),
    )

    it('validates with all properties present', () => {
      const result = fullSchema.safeParse({
        required: 'value',
        optional: 'value',
        nullable: 'value',
        optionalNullable: 'value',
      })
      expect(result.success).toBe(true)
    })

    it('validates with only required property and nullable', () => {
      const result = fullSchema.safeParse({
        required: 'value',
        nullable: 'value',
      })
      expect(result.success).toBe(true)
    })

    it('validates with nullable property set to null', () => {
      const result = fullSchema.safeParse({
        required: 'value',
        nullable: null,
      })
      expect(result.success).toBe(true)
    })

    it('validates with required nullable and optional nullable set to null', () => {
      const result = fullSchema.safeParse({
        required: 'value',
        nullable: 'value',
        optionalNullable: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects when required property is missing', () => {
      const result = fullSchema.safeParse({
        optional: 'value',
        nullable: 'value',
      })
      expect(result.success).toBe(false)
    })

    it('rejects when required property is null', () => {
      const result = fullSchema.safeParse({
        required: null,
      })
      expect(result.success).toBe(false)
    })

    it('rejects when required property is undefined', () => {
      const result = fullSchema.safeParse({
        required: undefined,
      })
      expect(result.success).toBe(false)
    })

    it('validates with $type and all properties', () => {
      const result = fullSchema.safeParse({
        $type: 'app.bsky.test#full',
        required: 'value',
        optional: 'value',
        nullable: null,
        optionalNullable: 'value',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('comparison with plain ObjectSchema', () => {
    const plainSchema = new ObjectSchema({
      text: new StringSchema({}),
      likes: new OptionalSchema(new IntegerSchema({})),
    })

    it('typed schema accepts same input as plain schema', () => {
      const input = { text: 'Hello', likes: 5 }
      const typedResult = schema.safeParse(input)
      const plainResult = plainSchema.safeParse(input)
      expect(typedResult.success).toBe(plainResult.success)
    })

    it('typed schema adds $type enforcement', () => {
      const input = { $type: 'wrong.type', text: 'Hello' }
      const typedResult = schema.safeParse(input)
      const plainResult = plainSchema.safeParse(input)
      expect(typedResult.success).toBe(false)
      expect(plainResult.success).toBe(true)
    })

    it('both schemas reject invalid types', () => {
      const input = { text: 123 }
      const typedResult = schema.safeParse(input)
      const plainResult = plainSchema.safeParse(input)
      expect(typedResult.success).toBe(false)
      expect(plainResult.success).toBe(false)
    })

    it('typed schema accepts matching $type', () => {
      const input = { $type: 'app.bsky.feed.post#main', text: 'Hello' }
      const typedResult = schema.safeParse(input)
      expect(typedResult.success).toBe(true)
    })
  })
})
