import { describe, expect, it } from 'vitest'
import { paramSchema, paramsSchema } from './_parameters.js'

describe('paramSchema', () => {
  describe('scalar values', () => {
    it('validates boolean values', () => {
      const result = paramSchema.safeParse(true)
      expect(result.success).toBe(true)
    })

    it('validates integer values', () => {
      const result = paramSchema.safeParse(42)
      expect(result.success).toBe(true)
    })

    it('validates string values', () => {
      const result = paramSchema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates empty strings', () => {
      const result = paramSchema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('validates zero', () => {
      const result = paramSchema.safeParse(0)
      expect(result.success).toBe(true)
    })

    it('validates negative integers', () => {
      const result = paramSchema.safeParse(-50)
      expect(result.success).toBe(true)
    })

    it('validates false boolean', () => {
      const result = paramSchema.safeParse(false)
      expect(result.success).toBe(true)
    })
  })

  describe('array values', () => {
    it('validates arrays of booleans', () => {
      const result = paramSchema.safeParse([true, false, true])
      expect(result.success).toBe(true)
    })

    it('validates arrays of integers', () => {
      const result = paramSchema.safeParse([1, 2, 3, 4])
      expect(result.success).toBe(true)
    })

    it('validates arrays of strings', () => {
      const result = paramSchema.safeParse(['foo', 'bar', 'baz'])
      expect(result.success).toBe(true)
    })

    it('validates empty arrays', () => {
      const result = paramSchema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('validates arrays with single element', () => {
      const result = paramSchema.safeParse(['single'])
      expect(result.success).toBe(true)
    })

    it('validates arrays with mixed scalar types', () => {
      const result = paramSchema.safeParse([true, 42, 'text'])
      expect(result.success).toBe(true)
    })

    it('validates arrays with negative integers', () => {
      const result = paramSchema.safeParse([-1, -2, -3])
      expect(result.success).toBe(true)
    })

    it('validates arrays with empty strings', () => {
      const result = paramSchema.safeParse(['', 'non-empty', ''])
      expect(result.success).toBe(true)
    })

    it('validates arrays with zero', () => {
      const result = paramSchema.safeParse([0, 1, 2])
      expect(result.success).toBe(true)
    })

    it('rejects nested arrays', () => {
      const result = paramSchema.safeParse([
        [1, 2],
        [3, 4],
      ])
      expect(result.success).toBe(false)
    })

    it('rejects arrays with null values', () => {
      const result = paramSchema.safeParse([1, null, 3])
      expect(result.success).toBe(false)
    })

    it('rejects arrays with undefined values', () => {
      const result = paramSchema.safeParse([1, undefined, 3])
      expect(result.success).toBe(false)
    })

    it('rejects arrays with object values', () => {
      const result = paramSchema.safeParse([1, { key: 'value' }, 3])
      expect(result.success).toBe(false)
    })

    it('rejects arrays with floating point numbers', () => {
      const result = paramSchema.safeParse([1, 2.5, 3])
      expect(result.success).toBe(false)
    })

    it('rejects arrays with NaN', () => {
      const result = paramSchema.safeParse([1, NaN, 3])
      expect(result.success).toBe(false)
    })

    it('rejects arrays with Infinity', () => {
      const result = paramSchema.safeParse([1, Infinity, 3])
      expect(result.success).toBe(false)
    })
  })

  describe('invalid values', () => {
    it('rejects null values', () => {
      const result = paramSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined values', () => {
      const result = paramSchema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects object values', () => {
      const result = paramSchema.safeParse({ key: 'value' })
      expect(result.success).toBe(false)
    })

    it('rejects floating point numbers', () => {
      const result = paramSchema.safeParse(3.14)
      expect(result.success).toBe(false)
    })

    it('rejects NaN', () => {
      const result = paramSchema.safeParse(NaN)
      expect(result.success).toBe(false)
    })

    it('rejects Infinity', () => {
      const result = paramSchema.safeParse(Infinity)
      expect(result.success).toBe(false)
    })

    it('rejects -Infinity', () => {
      const result = paramSchema.safeParse(-Infinity)
      expect(result.success).toBe(false)
    })
  })
})

describe('paramsSchema', () => {
  it('validates empty object', () => {
    const result = paramsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('validates object with boolean parameters', () => {
    const result = paramsSchema.safeParse({
      enabled: true,
      disabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('validates object with integer parameters', () => {
    const result = paramsSchema.safeParse({
      limit: 10,
      offset: 0,
      count: 100,
    })
    expect(result.success).toBe(true)
  })

  it('validates object with string parameters', () => {
    const result = paramsSchema.safeParse({
      name: 'Alice',
      query: 'search term',
      cursor: 'abc123',
    })
    expect(result.success).toBe(true)
  })

  it('validates object with array parameters', () => {
    const result = paramsSchema.safeParse({
      tags: ['tag1', 'tag2', 'tag3'],
      ids: [1, 2, 3, 4],
      flags: [true, false, true],
    })
    expect(result.success).toBe(true)
  })

  it('validates object with mixed parameter types', () => {
    const result = paramsSchema.safeParse({
      name: 'Alice',
      age: 30,
      active: true,
      tags: ['user', 'admin'],
      limit: 50,
    })
    expect(result.success).toBe(true)
  })

  it('validates object with empty string parameters', () => {
    const result = paramsSchema.safeParse({
      query: '',
      cursor: '',
    })
    expect(result.success).toBe(true)
  })

  it('validates object with negative integer parameters', () => {
    const result = paramsSchema.safeParse({
      offset: -10,
      delta: -5,
    })
    expect(result.success).toBe(true)
  })

  it('validates object with empty array parameters', () => {
    const result = paramsSchema.safeParse({
      tags: [],
      ids: [],
    })
    expect(result.success).toBe(true)
  })

  it('validates object with arrays of mixed scalar types', () => {
    const result = paramsSchema.safeParse({
      values: [true, 42, 'text'],
    })
    expect(result.success).toBe(true)
  })

  it('validates object with numeric string keys', () => {
    const result = paramsSchema.safeParse({
      '0': 'value0',
      '1': 'value1',
      '2': 'value2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-object values', () => {
    const result = paramsSchema.safeParse('not an object')
    expect(result.success).toBe(false)
  })

  it('rejects null values', () => {
    const result = paramsSchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects undefined values', () => {
    const result = paramsSchema.safeParse(undefined)
    expect(result.success).toBe(false)
  })

  it('rejects arrays', () => {
    const result = paramsSchema.safeParse([1, 2, 3])
    expect(result.success).toBe(false)
  })

  it('rejects object with null parameter values', () => {
    const result = paramsSchema.safeParse({
      name: 'Alice',
      invalid: null,
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with floating point parameter values', () => {
    const result = paramsSchema.safeParse({
      value: 3.14,
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with NaN parameter values', () => {
    const result = paramsSchema.safeParse({
      value: NaN,
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with Infinity parameter values', () => {
    const result = paramsSchema.safeParse({
      value: Infinity,
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with object parameter values', () => {
    const result = paramsSchema.safeParse({
      nested: { key: 'value' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with nested array parameter values', () => {
    const result = paramsSchema.safeParse({
      nested: [
        [1, 2],
        [3, 4],
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with arrays containing invalid values', () => {
    const result = paramsSchema.safeParse({
      tags: ['valid', null, 'also valid'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with arrays containing objects', () => {
    const result = paramsSchema.safeParse({
      items: [1, { key: 'value' }, 3],
    })
    expect(result.success).toBe(false)
  })

  it('rejects object with arrays containing floating point numbers', () => {
    const result = paramsSchema.safeParse({
      values: [1, 2.5, 3],
    })
    expect(result.success).toBe(false)
  })

  it('rejects when one parameter is invalid', () => {
    const result = paramsSchema.safeParse({
      valid1: 'string',
      valid2: 42,
      invalid: null,
      valid3: true,
    })
    expect(result.success).toBe(false)
  })

  describe('edge cases', () => {
    it('validates single parameter', () => {
      const result = paramsSchema.safeParse({
        single: 'value',
      })
      expect(result.success).toBe(true)
    })

    it('validates many parameters', () => {
      const manyParams: Record<string, string> = {}
      for (let i = 0; i < 100; i++) {
        manyParams[`param${i}`] = `value${i}`
      }
      const result = paramsSchema.safeParse(manyParams)
      expect(result.success).toBe(true)
    })

    it('validates parameters with long string values', () => {
      const result = paramsSchema.safeParse({
        longString: 'a'.repeat(1000),
      })
      expect(result.success).toBe(true)
    })

    it('validates parameters with large integer values', () => {
      const result = paramsSchema.safeParse({
        largeInt: 2147483647,
        negativeInt: -2147483648,
      })
      expect(result.success).toBe(true)
    })

    it('validates parameters with long arrays', () => {
      const result = paramsSchema.safeParse({
        longArray: Array.from({ length: 100 }, (_, i) => i),
      })
      expect(result.success).toBe(true)
    })

    it('validates parameters with special characters in keys', () => {
      const result = paramsSchema.safeParse({
        'key-with-dashes': 'value',
        key_with_underscores: 'value',
        'key.with.dots': 'value',
      })
      expect(result.success).toBe(true)
    })

    it('preserves original object when no transformations occur', () => {
      const input = {
        name: 'Alice',
        age: 30,
        tags: ['user'],
      }
      const result = paramsSchema.safeParse(input)

      if (result.success) {
        expect(result.value).toBe(input)
      } else {
        throw new Error('Expected validation to succeed')
      }
    })
  })
})
