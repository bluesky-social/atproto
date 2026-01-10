import { describe, expect, it } from 'vitest'
import { BooleanSchema } from './boolean.js'
import { DictSchema } from './dict.js'
import { EnumSchema } from './enum.js'
import { IntersectionSchema } from './intersection.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'

describe('IntersectionSchema', () => {
  const schema = new IntersectionSchema(
    new ObjectSchema({
      title: new StringSchema({}),
    }),
    new DictSchema(new EnumSchema(['tag1', 'tag2']), new BooleanSchema({})),
  )

  it('validates extra properties with the provided validator', () => {
    const result = schema.safeParse({
      title: 'My Post',
      tag1: true,
      tag2: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects extra properties that fail the provided validator', () => {
    const result = schema.safeParse({
      title: 'My Post',
      tag1: 'not a boolean',
    })
    expect(result.success).toBe(false)
  })
})
