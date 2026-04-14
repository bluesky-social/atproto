import { describe, expect, it } from 'vitest'
import { enumSchema } from './enum.js'
import { integer } from './integer.js'
import { nullable } from './nullable.js'
import { object } from './object.js'
import { optional } from './optional.js'
import { string } from './string.js'

describe('ObjectSchema', () => {
  const schema = object({
    name: string(),
    age: optional(integer()),
    gender: optional(nullable(enumSchema(['male', 'female']))),
  })

  it('validates plain objects', () => {
    const result = schema.safeParse({
      name: 'Alice',
      age: 30,
      gender: 'female',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-objects', () => {
    const result = schema.safeParse('not an object')
    expect(result.success).toBe(false)
  })

  it('rejects missing properties', () => {
    const result = schema.safeParse({
      age: 30,
      gender: 'female',
    })
    expect(result.success).toBe(false)
  })

  it('validates optional properties', () => {
    const result = schema.safeParse({
      name: 'Alice',
    })
    expect(result.success).toBe(true)
  })

  it('validates nullable properties', () => {
    const result = schema.safeParse({
      name: 'Alice',
      gender: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid property types', () => {
    const result = schema.safeParse({
      name: 'Alice',
      age: 'thirty',
    })
    expect(result.success).toBe(false)
  })

  it('ignores extra properties', () => {
    const result = schema.safeParse({
      name: 'Alice',
      age: 30,
      extra: 'value',
    })
    expect(result.success).toBe(true)
  })
})
