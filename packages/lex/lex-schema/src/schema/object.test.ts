import { describe, expect, it } from 'vitest'
import { EnumSchema } from './enum.js'
import { IntegerSchema } from './integer.js'
import { NullableSchema } from './nullable.js'
import { ObjectSchema } from './object.js'
import { OptionalSchema } from './optional.js'
import { StringSchema } from './string.js'

describe('ObjectSchema', () => {
  const schema = new ObjectSchema({
    name: new StringSchema({}),
    age: new OptionalSchema(new IntegerSchema({})),
    gender: new OptionalSchema(
      new NullableSchema(new EnumSchema(['male', 'female'])),
    ),
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
