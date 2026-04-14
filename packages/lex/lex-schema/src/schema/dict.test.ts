import { describe, expect, it } from 'vitest'
import { boolean } from './boolean.js'
import { dict } from './dict.js'
import { enumSchema } from './enum.js'
import { integer } from './integer.js'
import { string } from './string.js'

describe('DictSchema', () => {
  const schema = dict(string(), integer())

  it('validates plain objects with valid keys and values', () => {
    const result = schema.safeParse({
      count: 42,
      total: 100,
      score: 85,
    })
    expect(result.success).toBe(true)
  })

  it('validates empty objects', () => {
    const result = schema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects non-objects', () => {
    const result = schema.safeParse('not an object')
    expect(result.success).toBe(false)
  })

  it('rejects arrays', () => {
    const result = schema.safeParse([1, 2, 3])
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

  it('rejects invalid value types', () => {
    const result = schema.safeParse({
      count: 'not a number',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when one value is invalid', () => {
    const result = schema.safeParse({
      count: 42,
      invalid: 'string',
      total: 100,
    })
    expect(result.success).toBe(false)
  })

  it('validates with enum key schema', () => {
    const enumKeySchema = dict(enumSchema(['tag1', 'tag2', 'tag3']), boolean())

    const result = enumKeySchema.safeParse({
      tag1: true,
      tag2: false,
      tag3: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid keys with enum key schema', () => {
    const enumKeySchema = dict(enumSchema(['tag1', 'tag2']), boolean())

    const result = enumKeySchema.safeParse({
      tag1: true,
      invalidTag: false,
    })
    expect(result.success).toBe(false)
  })

  it('validates nested dict schemas', () => {
    const nestedSchema = dict(string(), dict(string(), integer()))

    const result = nestedSchema.safeParse({
      group1: { count: 10, total: 20 },
      group2: { score: 85 },
    })
    expect(result.success).toBe(true)
  })

  it('validates with string key schema constraints', () => {
    const constrainedKeySchema = dict(
      string({ minLength: 3, maxLength: 10 }),
      integer(),
    )

    const result = constrainedKeySchema.safeParse({
      abc: 1,
      defghij: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects keys that do not meet key schema constraints', () => {
    const constrainedKeySchema = dict(string({ minLength: 3 }), integer())

    const result = constrainedKeySchema.safeParse({
      ab: 1, // too short
    })
    expect(result.success).toBe(false)
  })

  it('validates with value schema constraints', () => {
    const constrainedValueSchema = dict(
      string(),
      integer({ minimum: 0, maximum: 100 }),
    )

    const result = constrainedValueSchema.safeParse({
      score: 50,
      total: 100,
    })
    expect(result.success).toBe(true)
  })

  it('rejects values that do not meet value schema constraints', () => {
    const constrainedValueSchema = dict(
      string(),
      integer({ minimum: 0, maximum: 100 }),
    )

    const result = constrainedValueSchema.safeParse({
      score: 150, // too high
    })
    expect(result.success).toBe(false)
  })

  it('validates dict with string values', () => {
    const stringValueSchema = dict(string(), string())

    const result = stringValueSchema.safeParse({
      name: 'Alice',
      city: 'New York',
      country: 'USA',
    })
    expect(result.success).toBe(true)
  })

  it('validates dict with boolean values', () => {
    const booleanValueSchema = dict(string(), boolean())

    const result = booleanValueSchema.safeParse({
      enabled: true,
      visible: false,
      active: true,
    })
    expect(result.success).toBe(true)
  })

  it('handles objects with numeric string keys', () => {
    const result = schema.safeParse({
      '0': 1,
      '1': 2,
      '2': 3,
    })
    expect(result.success).toBe(true)
  })

  it('preserves the original object when no transformations occur', () => {
    const input = { count: 42, total: 100 }
    const result = schema.safeParse(input)

    if (result.success) {
      // The implementation returns the same object if no changes are needed
      expect(result.value).toBe(input)
    } else {
      throw new Error('Expected validation to succeed')
    }
  })
})
