import { describe, expect, it } from 'vitest'
import { array } from './array.js'
import { integer } from './integer.js'
import { object } from './object.js'
import { string } from './string.js'

describe('ArraySchema', () => {
  it('validates arrays with string items', () => {
    const schema = array(string())
    const result = schema.safeParse(['hello', 'world'])
    expect(result.success).toBe(true)
  })

  it('validates arrays with integer items', () => {
    const schema = array(integer())
    const result = schema.safeParse([1, 2, 3])
    expect(result.success).toBe(true)
  })

  it('validates arrays with object items', () => {
    const schema = array(
      object({
        name: string(),
        age: integer(),
      }),
    )
    const result = schema.safeParse([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ])
    expect(result.success).toBe(true)
  })

  it('validates empty arrays', () => {
    const schema = array(string())
    const result = schema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('rejects non-array values', () => {
    const schema = array(string())
    const result = schema.safeParse('not an array')
    expect(result.success).toBe(false)
  })

  it('rejects null values', () => {
    const schema = array(string())
    const result = schema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects undefined values', () => {
    const schema = array(string())
    const result = schema.safeParse(undefined)
    expect(result.success).toBe(false)
  })

  it('rejects objects that look like arrays', () => {
    const schema = array(string())
    const result = schema.safeParse({ 0: 'a', 1: 'b', length: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects arrays with invalid items', () => {
    const schema = array(integer())
    const result = schema.safeParse([1, 2, 'three'])
    expect(result.success).toBe(false)
  })

  it('rejects arrays with some invalid items', () => {
    const schema = array(string())
    const result = schema.safeParse(['valid', null, 'also valid'])
    expect(result.success).toBe(false)
  })

  describe('minLength constraint', () => {
    it('validates arrays meeting minLength', () => {
      const schema = array(string(), { minLength: 2 })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(true)
    })

    it('validates arrays exceeding minLength', () => {
      const schema = array(string(), { minLength: 2 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays below minLength', () => {
      const schema = array(string(), { minLength: 3 })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(false)
    })

    it('rejects empty arrays when minLength is set', () => {
      const schema = array(string(), { minLength: 1 })
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('validates empty arrays when minLength is 0', () => {
      const schema = array(string(), { minLength: 0 })
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
    })
  })

  describe('maxLength constraint', () => {
    it('validates arrays meeting maxLength', () => {
      const schema = array(string(), { maxLength: 3 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('validates arrays below maxLength', () => {
      const schema = array(string(), { maxLength: 3 })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays exceeding maxLength', () => {
      const schema = array(string(), { maxLength: 2 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(false)
    })

    it('validates empty arrays with maxLength', () => {
      const schema = array(string(), { maxLength: 5 })
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('rejects empty arrays when maxLength is 0', () => {
      const schema = array(string(), { maxLength: 0 })
      const result = schema.safeParse(['a'])
      expect(result.success).toBe(false)
    })

    it('validates empty arrays when maxLength is 0', () => {
      const schema = array(string(), { maxLength: 0 })
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
    })
  })

  describe('minLength and maxLength together', () => {
    it('validates arrays within range', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('validates arrays at min boundary', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(true)
    })

    it('validates arrays at max boundary', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c', 'd'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays below minLength', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a'])
      expect(result.success).toBe(false)
    })

    it('rejects arrays above maxLength', () => {
      const schema = array(string(), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c', 'd', 'e'])
      expect(result.success).toBe(false)
    })

    it('validates single-length range', () => {
      const schema = array(string(), {
        minLength: 3,
        maxLength: 3,
      })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays not matching exact length', () => {
      const schema = array(string(), {
        minLength: 3,
        maxLength: 3,
      })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(false)
    })
  })

  describe('nested arrays', () => {
    it('validates arrays of arrays', () => {
      const schema = array(array(string()))
      const result = schema.safeParse([
        ['a', 'b'],
        ['c', 'd'],
      ])
      expect(result.success).toBe(true)
    })

    it('rejects invalid nested arrays', () => {
      const schema = array(array(integer()))
      const result = schema.safeParse([
        [1, 2],
        [3, 'four'],
      ])
      expect(result.success).toBe(false)
    })

    it('validates deeply nested arrays', () => {
      const schema = array(array(array(integer())))
      const result = schema.safeParse([[[1, 2], [3]], [[4, 5, 6]]])
      expect(result.success).toBe(true)
    })
  })
})
