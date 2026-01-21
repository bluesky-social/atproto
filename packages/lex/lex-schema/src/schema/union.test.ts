import { describe, expect, it } from 'vitest'
import { boolean } from './boolean.js'
import { integer } from './integer.js'
import { object } from './object.js'
import { string } from './string.js'
import { union } from './union.js'

describe('UnionSchema', () => {
  const stringOrNumber = union([string(), integer()])

  it('validates string input', () => {
    const result = stringOrNumber.safeParse('hello')
    expect(result.success).toBe(true)
  })

  it('validates number input', () => {
    const result = stringOrNumber.safeParse(42)
    expect(result.success).toBe(true)
  })

  it('rejects boolean input', () => {
    const result = stringOrNumber.safeParse(true)
    expect(result.success).toBe(false)
  })

  it('rejects null input', () => {
    const result = stringOrNumber.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects undefined input', () => {
    const result = stringOrNumber.safeParse(undefined)
    expect(result.success).toBe(false)
  })

  it('rejects object input when not in union', () => {
    const result = stringOrNumber.safeParse({ key: 'value' })
    expect(result.success).toBe(false)
  })

  it('rejects array input when not in union', () => {
    const result = stringOrNumber.safeParse([1, 2, 3])
    expect(result.success).toBe(false)
  })

  describe('with object types', () => {
    const schema = union([
      object({
        type: string(),
        name: string(),
      }),
      object({
        type: string(),
        age: integer(),
      }),
    ])

    it('validates first object variant', () => {
      const result = schema.safeParse({
        type: 'person',
        name: 'Alice',
      })
      expect(result.success).toBe(true)
    })

    it('validates second object variant', () => {
      const result = schema.safeParse({
        type: 'record',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('rejects object missing required properties', () => {
      const result = schema.safeParse({
        type: 'person',
      })
      expect(result.success).toBe(false)
    })

    it('rejects object with invalid property types', () => {
      const result = schema.safeParse({
        type: 'record',
        age: 'thirty',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('with three types', () => {
    const schema = union([string(), integer(), boolean()])

    it('validates string input', () => {
      const result = schema.safeParse('text')
      expect(result.success).toBe(true)
    })

    it('validates number input', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(true)
    })

    it('validates boolean input', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(true)
    })

    it('rejects null input', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects array input', () => {
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })
  })

  describe('with constrained types', () => {
    const schema = union([string({ minLength: 5 }), integer({ minimum: 100 })])

    it('validates string meeting constraint', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates number meeting constraint', () => {
      const result = schema.safeParse(150)
      expect(result.success).toBe(true)
    })

    it('rejects string not meeting constraint', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('rejects number not meeting constraint', () => {
      const result = schema.safeParse(50)
      expect(result.success).toBe(false)
    })

    it('validates first matching type even if later types could match', () => {
      const result = schema.safeParse('valid')
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('validates with single type in union', () => {
      const schema = union([string()])
      const result = schema.safeParse('test')
      expect(result.success).toBe(true)
    })

    it('rejects when single type in union does not match', () => {
      const schema = union([string()])
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('validates empty string', () => {
      const result = stringOrNumber.safeParse('')
      expect(result.success).toBe(true)
    })

    it('validates zero', () => {
      const result = stringOrNumber.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates negative numbers', () => {
      const result = stringOrNumber.safeParse(-42)
      expect(result.success).toBe(true)
    })

    it('rejects NaN', () => {
      const result = stringOrNumber.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('rejects Infinity', () => {
      const result = stringOrNumber.safeParse(Infinity)
      expect(result.success).toBe(false)
    })

    it('rejects -Infinity', () => {
      const result = stringOrNumber.safeParse(-Infinity)
      expect(result.success).toBe(false)
    })
  })
})
