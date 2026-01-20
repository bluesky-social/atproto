import { describe, expect, it } from 'vitest'
import { integer } from './integer.js'
import { object } from './object.js'
import { string } from './string.js'
import { typedObject } from './typed-object.js'
import { typedRef } from './typed-ref.js'
import { typedUnion } from './typed-union.js'

describe('TypedUnionSchema', () => {
  const personSchema = typedObject(
    'app.bsky.actor.person',
    'main',
    object({
      name: string(),
      age: integer(),
    }),
  )

  const postSchema = typedObject(
    'app.bsky.feed.post',
    'main',
    object({
      text: string(),
      createdAt: string(),
    }),
  )

  const commentSchema = typedObject(
    'app.bsky.feed.comment',
    'main',
    object({
      text: string(),
      parentUri: string(),
    }),
  )

  describe('closed union', () => {
    const schema = typedUnion(
      [typedRef(() => personSchema), typedRef(() => postSchema)],
      true,
    )

    it('validates first type in union', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('validates second type in union', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello world',
        createdAt: '2023-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown $type in closed union', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.like',
        subject: 'some-uri',
      })
      expect(result.success).toBe(false)
    })

    it('rejects object without $type', () => {
      const result = schema.safeParse({
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(false)
    })

    it('rejects object with invalid property for the $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 'thirty',
      })
      expect(result.success).toBe(false)
    })

    it('rejects object missing required properties', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-object input', () => {
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

    it('rejects array', () => {
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('rejects number', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(false)
    })

    it('rejects boolean', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })
  })

  describe('open union', () => {
    const schema = typedUnion(
      [typedRef(() => personSchema), typedRef(() => postSchema)],
      false,
    )

    it('validates known type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('validates unknown $type with valid structure', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.like',
        subject: 'some-uri',
        createdAt: '2023-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('accepts any properties for unknown $type', () => {
      const result = schema.safeParse({
        $type: 'unknown.nsid.type',
        anyProperty: 'any value',
        anotherProperty: 123,
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown $type with non-string $type', () => {
      const result = schema.safeParse({
        $type: 123,
        someProperty: 'value',
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown $type with null $type', () => {
      const result = schema.safeParse({
        $type: null,
        someProperty: 'value',
      })
      expect(result.success).toBe(false)
    })

    it('rejects object without $type', () => {
      const result = schema.safeParse({
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-object input', () => {
      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })

    it('validates known type with extra properties', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 30,
        extraProperty: 'extra',
      })
      expect(result.success).toBe(true)
    })

    it('rejects known type with invalid property types', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 123,
        age: 30,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with three types', () => {
    const schema = typedUnion(
      [
        typedRef(() => personSchema),
        typedRef(() => postSchema),
        typedRef(() => commentSchema),
      ],
      true,
    )

    it('validates first type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('validates second type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello',
        createdAt: '2023-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('validates third type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.comment',
        text: 'Nice post!',
        parentUri: 'at://did:plc:xyz/app.bsky.feed.post/123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.like',
        subject: 'some-uri',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with single type', () => {
    const schema = typedUnion([typedRef(() => personSchema)], true)

    it('validates the single type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('rejects different type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.feed.post',
        text: 'Hello',
        createdAt: '2023-01-01T00:00:00Z',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('$types getter', () => {
    const schema = typedUnion(
      [typedRef(() => personSchema), typedRef(() => postSchema)],
      true,
    )

    it('returns array of valid $type values', () => {
      const types = schema.$types
      expect(types).toContain('app.bsky.actor.person')
      expect(types).toContain('app.bsky.feed.post')
      expect(types.length).toBe(2)
    })
  })

  describe('refsMap getter', () => {
    const schema = typedUnion(
      [typedRef(() => personSchema), typedRef(() => postSchema)],
      true,
    )

    it('returns map of $type to ref schema', () => {
      const refsMap = schema.validatorsMap
      expect(refsMap.size).toBe(2)
      expect(refsMap.has('app.bsky.actor.person')).toBe(true)
      expect(refsMap.has('app.bsky.feed.post')).toBe(true)
    })
  })

  describe('edge cases', () => {
    const schema = typedUnion(
      [typedRef(() => personSchema), typedRef(() => postSchema)],
      true,
    )

    it('rejects object with $type as empty string in closed union', () => {
      const result = schema.safeParse({
        $type: '',
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })

    it('validates object with $type as empty string in open union', () => {
      const openSchema = typedUnion([typedRef(() => personSchema)], false)
      const result = openSchema.safeParse({
        $type: '',
        someProperty: 'value',
      })
      expect(result.success).toBe(true)
    })

    it('rejects plain object with only $type', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
      })
      expect(result.success).toBe(false)
    })

    it('handles object with $type and undefined properties', () => {
      const result = schema.safeParse({
        $type: 'app.bsky.actor.person',
        name: 'Alice',
        age: 30,
        extra: undefined,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('closed property', () => {
    it('exposes closed property as true', () => {
      const schema = typedUnion([typedRef(() => personSchema)], true)
      expect(schema.closed).toBe(true)
    })

    it('exposes closed property as false', () => {
      const schema = typedUnion([typedRef(() => personSchema)], false)
      expect(schema.closed).toBe(false)
    })
  })
})
