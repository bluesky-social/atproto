import { describe, expect, it } from 'vitest'
import { Infer, Unknown$Type, Unknown$TypedObject } from '../core.js'
import { enumSchema } from './enum.js'
import { integer } from './integer.js'
import { nullable } from './nullable.js'
import { object } from './object.js'
import { optional } from './optional.js'
import { string } from './string.js'
import { typedObject } from './typed-object.js'

describe('TypedObjectSchema', () => {
  const schema = typedObject(
    'app.bsky.feed.post',
    'main',
    object({
      text: string(),
      likes: optional(integer()),
    }),
  )
  type Schema = Infer<typeof schema>

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
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
        likes: 5,
      })
      expect(result.success).toBe(true)
    })

    it('rejects objects with non-matching $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.like',
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
        $type: { type: 'app.bsky.feed.post' },
        text: 'Hello world',
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-normalized $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post#main',
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
      const obj = { $type: 'app.bsky.feed.post', text: 'Hello' }
      expect(schema.isTypeOf(obj)).toBe(true)
    })

    it('returns false for objects with non-matching $type', () => {
      const obj = { $type: 'app.bsky.feed.like', text: 'Hello' }
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

    it('properly discriminates Unknown$TypeObject', () => {
      function foo(value: Unknown$TypedObject | Schema) {
        if (schema.isTypeOf(value)) {
          value.text
        } else {
          // @ts-expect-error
          value.text
        }
      }

      foo({
        $type: 'app.bsky.feed.post',
        text: 'aze',
        // @ts-expect-error
        unknownProperty: 'should not be allowed !',
      })

      foo({
        $type: 'blah' as Unknown$Type,
        // @ts-expect-error
        unknownProperty: 'should not be allowed !',
      })
    })
  })

  describe('$isTypeOf method', () => {
    it('returns true for objects without $type', () => {
      const obj = { text: 'Hello' }
      expect(schema.$isTypeOf(obj)).toBe(true)
    })

    it('returns true for objects with matching $type', () => {
      const obj = { $type: 'app.bsky.feed.post', text: 'Hello' }
      expect(schema.$isTypeOf(obj)).toBe(true)
    })

    it('returns false for objects with non-matching $type', () => {
      const obj = { $type: 'app.bsky.feed.like', text: 'Hello' }
      expect(schema.$isTypeOf(obj)).toBe(false)
    })

    it('behaves identically to isTypeOf', () => {
      const obj1 = { text: 'Hello' }
      const obj2 = { $type: 'app.bsky.feed.post', text: 'Hello' }
      const obj3 = { $type: 'app.bsky.feed.like', text: 'Hello' }

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
        $type: 'app.bsky.feed.post',
      })
    })

    it('adds $type to object with only required properties', () => {
      const input = { text: 'Hello world' }
      const result = schema.build(input)
      expect(result).toEqual({
        text: 'Hello world',
        $type: 'app.bsky.feed.post',
      })
    })

    it('preserves existing properties', () => {
      const input = { text: 'Hello', likes: 10, extra: 'value' } as any
      const result = schema.build(input)
      expect(result).toEqual({
        text: 'Hello',
        likes: 10,
        extra: 'value',
        $type: 'app.bsky.feed.post',
      })
    })

    it('does not mutate the input object', () => {
      const input = { text: 'Hello world', likes: 5 }
      const inputCopy = { ...input }
      schema.build(input)
      expect(input).toEqual(inputCopy)
    })

    it('adds $type to empty object', () => {
      const emptySchema = typedObject('app.bsky.test', 'main', object({}))
      const input = {}
      const result = emptySchema.build(input)
      expect(result).toEqual({ $type: 'app.bsky.test' })
    })
  })

  describe('$build method', () => {
    it('adds $type to object without $type', () => {
      const input = { text: 'Hello world', likes: 5 }
      const result = schema.$build(input)
      expect(result).toEqual({
        text: 'Hello world',
        likes: 5,
        $type: 'app.bsky.feed.post',
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
    const complexSchema = typedObject(
      'app.bsky.actor.profile',
      'main',
      object({
        displayName: string(),
        bio: optional(string({ maxLength: 256 })),
        followerCount: optional(integer({ minimum: 0 })),
        verified: optional(nullable(enumSchema([true, false]))),
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
        $type: 'app.bsky.actor.profile',
        displayName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })

    it('rejects with non-matching $type', () => {
      const result = complexSchema.safeParse({
        $type: 'app.bsky.feed.post',
        displayName: 'John Doe',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with different $type formats', () => {
    it('validates with main type', () => {
      const mainSchema = typedObject(
        'app.bsky.feed.post',
        'main',
        object({ text: string() }),
      )
      const result = mainSchema.safeParse({ text: 'Hello' })
      expect(result.success).toBe(true)
    })

    it('validates with custom fragment', () => {
      const fragmentSchema = typedObject(
        'app.bsky.feed.post',
        'reply',
        object({ text: string() }),
      )
      const result = fragmentSchema.safeParse({
        $type: 'app.bsky.feed.post#reply',
        text: 'Hello',
      })
      expect(result.success).toBe(true)
    })

    it('distinguishes between different fragments', () => {
      const replySchema = typedObject(
        'app.bsky.feed.post',
        'reply',
        object({ text: string() }),
      )
      const result = replySchema.safeParse({
        $type: 'app.bsky.feed.post#quote',
        text: 'Hello',
      })
      expect(result.success).toBe(false)
    })

    it('validates with long NSID', () => {
      const longSchema = typedObject(
        'com.example.app.feature.action.detail',
        'variant',
        object({ value: string() }),
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
      const minimalSchema = typedObject('app.bsky.test', 'main', object({}))
      const result = minimalSchema.safeParse({
        extra1: 'value1',
        extra2: 'value2',
      })
      expect(result.success).toBe(true)
    })

    it('validates empty object with no required properties', () => {
      const minimalSchema = typedObject('app.bsky.test', 'main', object({}))
      const result = minimalSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('validates with $type as only property', () => {
      const minimalSchema = typedObject('app.bsky.test', 'main', object({}))
      const result = minimalSchema.safeParse({
        $type: 'app.bsky.test',
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
    const fullSchema = typedObject(
      'app.bsky.test',
      'full',
      object({
        required: string(),
        optional: optional(string()),
        nullable: nullable(string()),
        optionalNullable: optional(nullable(string())),
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
    const plainSchema = object({
      text: string(),
      likes: optional(integer()),
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
      const input = { $type: 'app.bsky.feed.post', text: 'Hello' }
      const typedResult = schema.safeParse(input)
      expect(typedResult.success).toBe(true)
    })
  })
})
