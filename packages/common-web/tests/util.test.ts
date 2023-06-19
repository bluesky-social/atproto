import { util } from '../src/index'

describe('util', () => {
  describe('noUndefinedVals', () => {
    it('removes undefined top-level keys', () => {
      const obj: Record<string, unknown> = {
        foo: 123,
        bar: undefined,
      }

      const result = util.noUndefinedVals(obj)

      expect(result).toBe(obj)
      expect(result).toEqual({
        foo: 123,
      })
    })

    it('handles empty objects', () => {
      expect(util.noUndefinedVals({})).toEqual({})
    })

    it('leaves deep values intact', () => {
      const obj: Record<string, unknown> = {
        foo: 123,
        bar: {
          baz: undefined,
        },
      }
      const result = util.noUndefinedVals(obj)

      expect(result).toEqual({
        foo: 123,
        bar: {
          baz: undefined,
        },
      })
    })
  })

  describe('flattenUint8Arrays', () => {
    it('flattens to single array of values', () => {
      const arr = [new Uint8Array([0xa, 0xb]), new Uint8Array([0xc, 0xd])]

      const flat = util.flattenUint8Arrays(arr)

      expect([...flat]).toEqual([0xa, 0xb, 0xc, 0xd])
    })

    it('flattens empty arrays', () => {
      const arr = [new Uint8Array(0), new Uint8Array(0)]
      const flat = util.flattenUint8Arrays(arr)

      expect(flat.length).toBe(0)
    })
  })

  describe('streamToBuffer', () => {
    it('reads iterable into array', async () => {
      const iterable: AsyncIterable<Uint8Array> = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([0xa, 0xb])
          yield new Uint8Array([0xc, 0xd])
        },
      }
      const buffer = await util.streamToBuffer(iterable)

      expect([...buffer]).toEqual([0xa, 0xb, 0xc, 0xd])
    })
  })

  describe('asyncFilter', () => {
    it('filters array values', async () => {
      const result = await util.asyncFilter([0, 1, 2], (n) =>
        Promise.resolve(n === 0),
      )

      expect(result).toEqual([0])
    })
  })

  describe('range', () => {
    it('generates numeric range', () => {
      expect(util.range(4)).toEqual([0, 1, 2, 3])
    })
  })

  describe('dedupeStrs', () => {
    it('removes duplicates', () => {
      expect(util.dedupeStrs(['a', 'a', 'b'])).toEqual(['a', 'b'])
    })
  })

  describe('parseIntWithFallback', () => {
    it('accepts undefined', () => {
      expect(util.parseIntWithFallback(undefined, -10)).toBe(-10)
    })

    it('parses numbers', () => {
      expect(util.parseIntWithFallback('100', -10)).toBe(100)
    })

    it('supports non-numeric fallbacks', () => {
      expect(util.parseIntWithFallback(undefined, 'foo')).toBe('foo')
    })
  })
})
