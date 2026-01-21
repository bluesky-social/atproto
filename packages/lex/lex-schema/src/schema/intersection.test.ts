import { describe, expect, it } from 'vitest'
import { boolean } from './boolean.js'
import { dict } from './dict.js'
import { enumSchema } from './enum.js'
import { intersection } from './intersection.js'
import { object } from './object.js'
import { string } from './string.js'

describe('IntersectionSchema', () => {
  const schema = intersection(
    object({
      title: string(),
    }),
    dict(enumSchema(['tag1', 'tag2']), boolean()),
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
