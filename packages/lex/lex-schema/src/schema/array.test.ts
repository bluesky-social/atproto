import { describe, expect, it } from 'vitest'
import { array } from './array.js'
import { integer } from './integer.js'
import { object } from './object.js'
import { string } from './string.js'

describe('ArraySchema', () => {
  describe('validation', () => {
    it('validates arrays with string items', () => {
      const schema = array(string())
      const result = schema.safeValidate(['hello', 'world'])
      expect(result).toMatchObject({ success: true })
    })

    it('validates arrays with integer items', () => {
      const schema = array(integer())
      const result = schema.safeValidate([1, 2, 3])
      expect(result).toMatchObject({ success: true })
    })

    it('validates arrays with object items', () => {
      const schema = array(
        object({
          name: string(),
          age: integer(),
        }),
      )
      const result = schema.safeValidate([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
      expect(result).toMatchObject({ success: true })
    })

    it('validates empty arrays', () => {
      const schema = array(string())
      const result = schema.safeValidate([])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects non-array values', () => {
      const schema = array(string())
      const result = schema.safeValidate('not an array')
      expect(result).toMatchObject({ success: false })
    })

    it('rejects null values', () => {
      const schema = array(string())
      const result = schema.safeValidate(null)
      expect(result).toMatchObject({ success: false })
    })

    it('rejects undefined values', () => {
      const schema = array(string())
      const result = schema.safeValidate(undefined)
      expect(result).toMatchObject({ success: false })
    })

    it('rejects objects that look like arrays', () => {
      const schema = array(string())
      const result = schema.safeValidate({ 0: 'a', 1: 'b', length: 2 })
      expect(result).toMatchObject({ success: false })
    })

    it('rejects arrays with invalid items', () => {
      const schema = array(integer())
      const result = schema.safeValidate([1, 2, 'three'])
      expect(result).toMatchObject({ success: false })
    })

    it('rejects arrays with some invalid items', () => {
      const schema = array(string())
      const result = schema.safeValidate(['valid', null, 'also valid'])
      expect(result).toMatchObject({ success: false })
    })

    it('rejects single values', () => {
      const schema = array(string())
      const result = schema.safeValidate(3)
      expect(result).toEqual({
        success: false,
        reason: expect.objectContaining({
          message: expect.stringContaining(
            'Expected array value type at $ (got integer)',
          ),
        }),
      })
    })
  })

  describe('minLength constraint', () => {
    it('validates arrays meeting minLength', () => {
      const schema = array(string(), { minLength: 2 })
      const result = schema.safeParse(['a', 'b'])
      expect(result).toMatchObject({ success: true })
    })

    it('validates arrays exceeding minLength', () => {
      const schema = array(string(), { minLength: 2 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects arrays below minLength', () => {
      const schema = array(string(), { minLength: 3 })
      const result = schema.safeParse(['a', 'b'])
      expect(result).toMatchObject({ success: false })
    })

    it('rejects empty arrays when minLength is set', () => {
      const schema = array(string(), { minLength: 1 })
      const result = schema.safeParse([])
      expect(result).toMatchObject({ success: false })
    })

    it('validates empty arrays when minLength is 0', () => {
      const schema = array(string(), { minLength: 0 })
      const result = schema.safeParse([])
      expect(result).toMatchObject({ success: true })
    })
  })

  describe('maxLength constraint', () => {
    it('validates arrays meeting maxLength', () => {
      const schema = array(string(), { maxLength: 3 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result).toMatchObject({ success: true })
    })

    it('validates arrays below maxLength', () => {
      const schema = array(string(), { maxLength: 3 })
      const result = schema.safeParse(['a', 'b'])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects arrays exceeding maxLength', () => {
      const schema = array(string(), { maxLength: 2 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result).toMatchObject({ success: false })
    })

    it('validates empty arrays with maxLength', () => {
      const schema = array(string(), { maxLength: 5 })
      const result = schema.safeParse([])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects empty arrays when maxLength is 0', () => {
      const schema = array(string(), { maxLength: 0 })
      const result = schema.safeParse(['a'])
      expect(result).toMatchObject({ success: false })
    })

    it('validates empty arrays when maxLength is 0', () => {
      const schema = array(string(), { maxLength: 0 })
      const result = schema.safeParse([])
      expect(result).toMatchObject({ success: true })
    })
  })

  describe('minLength and maxLength together', () => {
    it('validates arrays within range', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result).toMatchObject({ success: true })
    })

    it('validates arrays at min boundary', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b'])
      expect(result).toMatchObject({ success: true })
    })

    it('validates arrays at max boundary', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c', 'd'])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects arrays below minLength', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a'])
      expect(result).toMatchObject({ success: false })
    })

    it('rejects arrays above maxLength', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c', 'd', 'e'])
      expect(result).toMatchObject({ success: false })
    })

    it('validates single-length range', () => {
      const schema = array(string(), {
        minLength: 3,
        maxLength: 3,
      })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects arrays not matching exact length', () => {
      const schema = array(string(), {
        minLength: 3,
        maxLength: 3,
      })
      const result = schema.safeParse(['a', 'b'])
      expect(result).toMatchObject({ success: false })
    })
  })

  describe('nested arrays', () => {
    it('validates arrays of arrays', () => {
      const schema = array(array(string()))
      const result = schema.safeParse([
        ['a', 'b'],
        ['c', 'd'],
      ])
      expect(result).toMatchObject({ success: true })
    })

    it('rejects invalid nested arrays', () => {
      const schema = array(array(integer()))
      const result = schema.safeParse([
        [1, 2],
        [3, 'four'],
      ])
      expect(result).toMatchObject({ success: false })
    })

    it('validates deeply nested arrays', () => {
      const schema = array(array(array(integer())))
      const result = schema.safeParse([[[1, 2], [3]], [[4, 5, 6]]])
      expect(result).toMatchObject({ success: true })
    })
  })
})
