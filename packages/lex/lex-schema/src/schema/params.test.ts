import { describe, expect, it } from 'vitest'
import { ArraySchema } from './array.js'
import { BooleanSchema } from './boolean.js'
import { IntegerSchema } from './integer.js'
import { OptionalSchema } from './optional.js'
import { ParamsSchema } from './params.js'
import { StringSchema } from './string.js'

describe('ParamsSchema', () => {
  describe('basic validation', () => {
    const schema = new ParamsSchema({
      name: new StringSchema({}),
      age: new IntegerSchema({}),
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
    const schema = new ParamsSchema({
      name: new StringSchema({}),
      age: new OptionalSchema(new IntegerSchema({})),
      active: new OptionalSchema(new BooleanSchema({})),
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
    const schema = new ParamsSchema({
      name: new StringSchema({}),
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
      const schema = new ParamsSchema({
        text: new StringSchema({}),
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
      const schema = new ParamsSchema({
        count: new IntegerSchema({}),
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
      const schema = new ParamsSchema({
        flag: new BooleanSchema({}),
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
      const schema = new ParamsSchema({
        tags: new ArraySchema(new StringSchema({})),
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
    const schema = new ParamsSchema({
      name: new StringSchema({}),
      age: new OptionalSchema(new IntegerSchema({})),
      active: new OptionalSchema(new BooleanSchema({})),
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
    const schema = new ParamsSchema({
      name: new StringSchema({}),
      age: new OptionalSchema(new IntegerSchema({})),
      active: new OptionalSchema(new BooleanSchema({})),
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
      const result = schema.toURLSearchParams(undefined)
      expect(result.toString()).toBe('')
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
    const schema = new ParamsSchema({
      name: new StringSchema({}),
      age: new OptionalSchema(new IntegerSchema({})),
      active: new OptionalSchema(new BooleanSchema({})),
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
    const schema = new ParamsSchema({})

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
    const schema = new ParamsSchema({
      query: new StringSchema({ minLength: 1 }),
      limit: new OptionalSchema(
        new IntegerSchema({ minimum: 1, maximum: 100 }),
      ),
      offset: new OptionalSchema(new IntegerSchema({ minimum: 0 })),
      filters: new OptionalSchema(new ArraySchema(new StringSchema({}))),
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
    const schema = new ParamsSchema({
      name: new StringSchema({}),
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
})
