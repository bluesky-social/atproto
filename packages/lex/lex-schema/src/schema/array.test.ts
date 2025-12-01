import { ArraySchema } from './array.js'
import { BooleanSchema } from './boolean.js'
import { EnumSchema } from './enum.js'
import { IntegerSchema } from './integer.js'
import { ObjectSchema } from './object.js'
import { StringSchema } from './string.js'

describe('ArraySchema', () => {
  it('validates arrays with string items', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse(['hello', 'world'])
    expect(result.success).toBe(true)
  })

  it('validates arrays with integer items', () => {
    const schema = new ArraySchema(new IntegerSchema({}))
    const result = schema.safeParse([1, 2, 3])
    expect(result.success).toBe(true)
  })

  it('validates arrays with object items', () => {
    const schema = new ArraySchema(
      new ObjectSchema({
        name: new StringSchema({}),
        age: new IntegerSchema({}),
      }),
    )
    const result = schema.safeParse([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ])
    expect(result.success).toBe(true)
  })

  it('validates empty arrays', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('rejects non-array values', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse('not an array')
    expect(result.success).toBe(false)
  })

  it('rejects null values', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects undefined values', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse(undefined)
    expect(result.success).toBe(false)
  })

  it('rejects objects that look like arrays', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse({ 0: 'a', 1: 'b', length: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects arrays with invalid items', () => {
    const schema = new ArraySchema(new IntegerSchema({}))
    const result = schema.safeParse([1, 2, 'three'])
    expect(result.success).toBe(false)
  })

  it('rejects arrays with some invalid items', () => {
    const schema = new ArraySchema(new StringSchema({}))
    const result = schema.safeParse(['valid', null, 'also valid'])
    expect(result.success).toBe(false)
  })

  it('validates enum items', () => {
    const schema = new ArraySchema(new EnumSchema(['red', 'green', 'blue']))
    const result = schema.safeParse(['red', 'blue', 'green'])
    expect(result.success).toBe(true)
  })

  it('rejects invalid enum items', () => {
    const schema = new ArraySchema(new EnumSchema(['red', 'green', 'blue']))
    const result = schema.safeParse(['red', 'yellow'])
    expect(result.success).toBe(false)
  })

  it('validates boolean items', () => {
    const schema = new ArraySchema(new BooleanSchema({}))
    const result = schema.safeParse([true, false, true])
    expect(result.success).toBe(true)
  })

  describe('minLength constraint', () => {
    it('validates arrays meeting minLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { minLength: 2 })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(true)
    })

    it('validates arrays exceeding minLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { minLength: 2 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays below minLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { minLength: 3 })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(false)
    })

    it('rejects empty arrays when minLength is set', () => {
      const schema = new ArraySchema(new StringSchema({}), { minLength: 1 })
      const result = schema.safeParse([])
      expect(result.success).toBe(false)
    })

    it('validates empty arrays when minLength is 0', () => {
      const schema = new ArraySchema(new StringSchema({}), { minLength: 0 })
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
    })
  })

  describe('maxLength constraint', () => {
    it('validates arrays meeting maxLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { maxLength: 3 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('validates arrays below maxLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { maxLength: 3 })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays exceeding maxLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { maxLength: 2 })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(false)
    })

    it('validates empty arrays with maxLength', () => {
      const schema = new ArraySchema(new StringSchema({}), { maxLength: 5 })
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('rejects empty arrays when maxLength is 0', () => {
      const schema = new ArraySchema(new StringSchema({}), { maxLength: 0 })
      const result = schema.safeParse(['a'])
      expect(result.success).toBe(false)
    })

    it('validates empty arrays when maxLength is 0', () => {
      const schema = new ArraySchema(new StringSchema({}), { maxLength: 0 })
      const result = schema.safeParse([])
      expect(result.success).toBe(true)
    })
  })

  describe('minLength and maxLength together', () => {
    it('validates arrays within range', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('validates arrays at min boundary', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(true)
    })

    it('validates arrays at max boundary', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c', 'd'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays below minLength', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a'])
      expect(result.success).toBe(false)
    })

    it('rejects arrays above maxLength', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 2,
        maxLength: 4,
      })
      const result = schema.safeParse(['a', 'b', 'c', 'd', 'e'])
      expect(result.success).toBe(false)
    })

    it('validates single-length range', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 3,
        maxLength: 3,
      })
      const result = schema.safeParse(['a', 'b', 'c'])
      expect(result.success).toBe(true)
    })

    it('rejects arrays not matching exact length', () => {
      const schema = new ArraySchema(new StringSchema({}), {
        minLength: 3,
        maxLength: 3,
      })
      const result = schema.safeParse(['a', 'b'])
      expect(result.success).toBe(false)
    })
  })

  describe('nested arrays', () => {
    it('validates arrays of arrays', () => {
      const schema = new ArraySchema(new ArraySchema(new StringSchema({})))
      const result = schema.safeParse([
        ['a', 'b'],
        ['c', 'd'],
      ])
      expect(result.success).toBe(true)
    })

    it('rejects invalid nested arrays', () => {
      const schema = new ArraySchema(new ArraySchema(new IntegerSchema({})))
      const result = schema.safeParse([
        [1, 2],
        [3, 'four'],
      ])
      expect(result.success).toBe(false)
    })

    it('validates deeply nested arrays', () => {
      const schema = new ArraySchema(
        new ArraySchema(new ArraySchema(new IntegerSchema({}))),
      )
      const result = schema.safeParse([[[1, 2], [3]], [[4, 5, 6]]])
      expect(result.success).toBe(true)
    })
  })

  describe('complex item schemas', () => {
    it('validates arrays with string length constraints', () => {
      const schema = new ArraySchema(new StringSchema({ minLength: 2 }))
      const result = schema.safeParse(['hello', 'world'])
      expect(result.success).toBe(true)
    })

    it('rejects items that violate string constraints', () => {
      const schema = new ArraySchema(new StringSchema({ minLength: 5 }))
      const result = schema.safeParse(['hello', 'hi'])
      expect(result.success).toBe(false)
    })

    it('validates arrays with integer range constraints', () => {
      const schema = new ArraySchema(
        new IntegerSchema({ minimum: 0, maximum: 100 }),
      )
      const result = schema.safeParse([10, 50, 99])
      expect(result.success).toBe(true)
    })

    it('rejects items that violate integer constraints', () => {
      const schema = new ArraySchema(
        new IntegerSchema({ minimum: 0, maximum: 100 }),
      )
      const result = schema.safeParse([10, 50, 150])
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles arrays with many items', () => {
      const schema = new ArraySchema(new IntegerSchema({}))
      const largeArray = Array.from({ length: 1000 }, (_, i) => i)
      const result = schema.safeParse(largeArray)
      expect(result.success).toBe(true)
    })

    it('validates array with single item', () => {
      const schema = new ArraySchema(new StringSchema({}))
      const result = schema.safeParse(['single'])
      expect(result.success).toBe(true)
    })

    it('stops validation at first invalid item', () => {
      const schema = new ArraySchema(new IntegerSchema({}))
      const result = schema.safeParse([1, 2, 'invalid', 4, 5])
      expect(result.success).toBe(false)
    })
  })
})
