import { describe, expect, it } from 'vitest'
import { array } from './array.js'
import { boolean } from './boolean.js'
import { integer } from './integer.js'
import { optional } from './optional.js'
import { paramSchema, params, paramsSchema } from './params.js'
import { string } from './string.js'

describe('ParamsSchema', () => {
  describe('basic validation', () => {
    const schema = params({
      name: string(),
      age: integer(),
    })

    it('validates plain objects with required params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-objects', () => {
      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })

    it('rejects null values', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined values', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['Alice', 30])
      expect(result.success).toBe(false)
    })

    it('rejects missing required properties', () => {
      const result = schema.safeParse({
        name: 'Alice',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid property types', () => {
      const result = schema.safeParse({
        name: 'Alice',
        age: 'thirty',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('optional parameters', () => {
    const schema = params({
      name: string(),
      age: optional(integer()),
      active: optional(boolean()),
    })

    it('validates with all parameters present', () => {
      const result = schema.safeParse({
        name: 'Alice',
        age: 30,
        active: true,
      })
      expect(result.success).toBe(true)
    })

    it('validates with only required parameters', () => {
      const result = schema.safeParse({
        name: 'Alice',
      })
      expect(result.success).toBe(true)
    })

    it('validates with some optional parameters', () => {
      const result = schema.safeParse({
        name: 'Alice',
        age: 30,
      })
      expect(result.success).toBe(true)
    })

    it('rejects when required parameter is missing', () => {
      const result = schema.safeParse({
        age: 30,
        active: true,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('additional unspecified parameters', () => {
    const schema = params({
      name: string(),
    })

    it('accepts string values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        extra: 'value',
      })
      expect(result.success).toBe(true)
    })

    it('accepts boolean values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        flag: true,
      })
      expect(result.success).toBe(true)
    })

    it('accepts integer values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        count: 42,
      })
      expect(result.success).toBe(true)
    })

    it('accepts array values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        tags: ['tag1', 'tag2'],
      })
      expect(result.success).toBe(true)
    })

    it('accepts multiple additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        extra1: 'value',
        extra2: 42,
        extra3: true,
      })
      expect(result.success).toBe(true)
    })

    it('rejects null values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        extra: null,
      })
      expect(result.success).toBe(false)
    })

    it('rejects object values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        extra: { nested: 'object' },
      })
      expect(result.success).toBe(false)
    })

    it('rejects undefined values in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        extra: undefined,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('parameter types', () => {
    describe('string parameters', () => {
      const schema = params({
        text: string(),
      })

      it('validates string values', () => {
        const result = schema.safeParse({ text: 'hello' })
        expect(result.success).toBe(true)
      })

      it('validates empty strings', () => {
        const result = schema.safeParse({ text: '' })
        expect(result.success).toBe(true)
      })

      it('rejects non-string values', () => {
        const result = schema.safeParse({ text: 123 })
        expect(result.success).toBe(false)
      })
    })

    describe('integer parameters', () => {
      const schema = params({
        count: integer(),
      })

      it('validates integer values', () => {
        const result = schema.safeParse({ count: 42 })
        expect(result.success).toBe(true)
      })

      it('validates zero', () => {
        const result = schema.safeParse({ count: 0 })
        expect(result.success).toBe(true)
      })

      it('validates negative integers', () => {
        const result = schema.safeParse({ count: -10 })
        expect(result.success).toBe(true)
      })

      it('rejects non-integer values', () => {
        const result = schema.safeParse({ count: 'not a number' })
        expect(result.success).toBe(false)
      })
    })

    describe('boolean parameters', () => {
      const schema = params({
        flag: boolean(),
      })

      it('validates true', () => {
        const result = schema.safeParse({ flag: true })
        expect(result.success).toBe(true)
      })

      it('validates false', () => {
        const result = schema.safeParse({ flag: false })
        expect(result.success).toBe(true)
      })

      it('rejects non-boolean values', () => {
        const result = schema.safeParse({ flag: 'true' })
        expect(result.success).toBe(false)
      })
    })

    describe('array parameters', () => {
      const schema = params({
        tags: array(string()),
      })

      it('validates string arrays', () => {
        const result = schema.safeParse({ tags: ['tag1', 'tag2'] })
        expect(result.success).toBe(true)
      })

      it('validates empty arrays', () => {
        const result = schema.safeParse({ tags: [] })
        expect(result.success).toBe(true)
      })

      it('rejects arrays with invalid items', () => {
        const result = schema.safeParse({ tags: ['tag1', 123] })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('fromURLSearchParams', () => {
    const schema = params({
      name: string(),
      age: optional(integer()),
      active: optional(boolean()),
    })

    it('parses string parameters', () => {
      const urlParams = new URLSearchParams('name=Alice')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice' })
    })

    it('parses and coerces boolean true', () => {
      const urlParams = new URLSearchParams('name=Alice&active=true')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', active: true })
    })

    it('parses and coerces boolean false', () => {
      const urlParams = new URLSearchParams('name=Alice&active=false')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', active: false })
    })

    it('parses and coerces integer values', () => {
      const urlParams = new URLSearchParams('name=Alice&age=30')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', age: 30 })
    })

    it('parses and coerces negative integers', () => {
      const urlParams = new URLSearchParams('name=Alice&age=-5')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', age: -5 })
    })

    it('does not coerce non-integer numbers', () => {
      const urlParams = new URLSearchParams('name=Alice&extra=3.14')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', extra: '3.14' })
    })

    it('keeps string values for string schema even if they look like numbers', () => {
      const urlParams = new URLSearchParams('name=123')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: '123' })
    })

    it('parses multiple values as array', () => {
      const urlParams = new URLSearchParams('name=Alice&tag=one&tag=two')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', tag: ['one', 'two'] })
    })

    it('coerces array values correctly', () => {
      const urlParams = new URLSearchParams('name=Alice&num=1&num=2&num=3')
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', num: [1, 2, 3] })
    })

    it('handles mixed types in arrays', () => {
      const urlParams = new URLSearchParams(
        'name=Alice&val=true&val=123&val=text',
      )
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({ name: 'Alice', val: [true, 123, 'text'] })
    })

    it('handles empty URLSearchParams', () => {
      const urlParams = new URLSearchParams()
      expect(() => schema.fromURLSearchParams(urlParams)).toThrow()
    })

    it('handles multiple parameters', () => {
      const urlParams = new URLSearchParams(
        'name=Alice&age=30&active=true&extra=value',
      )
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual({
        name: 'Alice',
        age: 30,
        active: true,
        extra: 'value',
      })
    })
  })

  describe('toURLSearchParams', () => {
    const schema = params({
      name: string(),
      age: optional(integer()),
      active: optional(boolean()),
    })

    it('converts string parameters', () => {
      const result = schema.toURLSearchParams({ name: 'Alice' })
      expect(result.toString()).toBe('name=Alice')
    })

    it('converts integer parameters', () => {
      const result = schema.toURLSearchParams({ name: 'Alice', age: 30 })
      expect(result.toString()).toBe('name=Alice&age=30')
    })

    it('converts boolean parameters', () => {
      const result = schema.toURLSearchParams({ name: 'Alice', active: true })
      expect(result.toString()).toBe('name=Alice&active=true')
    })

    it('converts multiple parameters', () => {
      const result = schema.toURLSearchParams({
        name: 'Alice',
        age: 30,
        active: true,
      })
      expect(result.toString()).toBe('name=Alice&age=30&active=true')
    })

    it('handles array values', () => {
      const result = schema.toURLSearchParams({
        name: 'Alice',
        // @ts-expect-error
        tags: ['tag1', 'tag2'],
      })
      expect(result.toString()).toBe('name=Alice&tags=tag1&tags=tag2')
    })

    it('skips undefined values', () => {
      const result = schema.toURLSearchParams({
        name: 'Alice',
        age: undefined,
      })
      expect(result.toString()).toBe('name=Alice')
    })

    it('handles empty arrays', () => {
      const result = schema.toURLSearchParams({
        name: 'Alice',
        // @ts-expect-error
        tags: [],
      })
      expect(result.toString()).toBe('name=Alice')
    })

    it('handles arrays with multiple types', () => {
      const result = schema.toURLSearchParams({
        name: 'Alice',
        // @ts-expect-error
        values: [1, true, 'text'],
      })
      expect(result.toString()).toBe(
        'name=Alice&values=1&values=true&values=text',
      )
    })

    it('handles undefined input', () => {
      // @ts-expect-error
      expect(() => schema.toURLSearchParams(undefined)).toThrow()
    })

    it('converts negative integers', () => {
      const result = schema.toURLSearchParams({ name: 'Alice', age: -5 })
      expect(result.toString()).toBe('name=Alice&age=-5')
    })

    it('converts zero', () => {
      const result = schema.toURLSearchParams({ name: 'Alice', age: 0 })
      expect(result.toString()).toBe('name=Alice&age=0')
    })

    it('converts false boolean', () => {
      const result = schema.toURLSearchParams({ name: 'Alice', active: false })
      expect(result.toString()).toBe('name=Alice&active=false')
    })
  })

  describe('roundtrip conversion', () => {
    const schema = params({
      name: string(),
      age: optional(integer()),
      active: optional(boolean()),
    })

    it('roundtrips simple params correctly', () => {
      const original = { name: 'Alice', age: 30, active: true }
      const urlParams = schema.toURLSearchParams(original)
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual(original)
    })

    it('roundtrips params with arrays', () => {
      const original = { name: 'Alice', tags: ['tag1', 'tag2'] }
      const urlParams = schema.toURLSearchParams(original)
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual(original)
    })

    it('roundtrips params with boolean false', () => {
      const original = { name: 'Alice', active: false }
      const urlParams = schema.toURLSearchParams(original)
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual(original)
    })

    it('roundtrips params with zero', () => {
      const original = { name: 'Alice', age: 0 }
      const urlParams = schema.toURLSearchParams(original)
      const result = schema.fromURLSearchParams(urlParams)
      expect(result).toEqual(original)
    })
  })

  describe('empty schema', () => {
    const schema = params()

    it('validates empty object', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts additional params', () => {
      const result = schema.safeParse({ extra: 'value' })
      expect(result.success).toBe(true)
    })

    it('rejects non-objects', () => {
      const result = schema.safeParse('not an object')
      expect(result.success).toBe(false)
    })
  })

  describe('complex scenarios', () => {
    const schema = params({
      query: string({ minLength: 1 }),
      limit: optional(integer({ minimum: 1, maximum: 100 })),
      offset: optional(integer({ minimum: 0 })),
      filters: optional(array(string())),
    })

    it('validates typical query parameters', () => {
      const result = schema.safeParse({
        query: 'search term',
        limit: 10,
        offset: 0,
        filters: ['filter1', 'filter2'],
      })
      expect(result.success).toBe(true)
    })

    it('validates minimal query', () => {
      const result = schema.safeParse({
        query: 'search',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty query string', () => {
      const result = schema.safeParse({
        query: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects limit out of range', () => {
      const result = schema.safeParse({
        query: 'search',
        limit: 200,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative offset', () => {
      const result = schema.safeParse({
        query: 'search',
        offset: -1,
      })
      expect(result.success).toBe(false)
    })

    it('accepts additional unspecified params', () => {
      const result = schema.safeParse({
        query: 'search',
        extra: 'value',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    const schema = params({
      name: string(),
    })

    it('rejects objects with custom prototypes', () => {
      const obj = Object.create({ inherited: 'value' })
      obj.name = 'Alice'
      const result = schema.safeParse(obj)
      expect(result.success).toBe(false)
    })

    it('validates with numeric string keys', () => {
      const result = schema.safeParse({
        name: 'Alice',
        '123': 'numeric key',
      })
      expect(result.success).toBe(true)
    })

    it('handles empty string keys in additional params', () => {
      const result = schema.safeParse({
        name: 'Alice',
        '': 'empty key',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('memoized params schema', () => {
    it('returns the same instance when no shape is provided', () => {
      expect(params()).toBe(params())
    })

    it('returns different instances when (identical) shapes are provided', () => {
      const schemaA = params({ a: string() })
      const schemaB = params({ a: string() })
      expect(schemaA).not.toBe(schemaB)
    })
  })
})

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
