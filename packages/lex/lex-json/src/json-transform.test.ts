import { describe, expect, it } from 'vitest'
import { jsonTransform } from './json-transform.js'

const noop = () => {}

describe(jsonTransform, () => {
  describe('noop transform', () => {
    it('handles primitives', () => {
      expect(jsonTransform(null, noop)).toBe(null)
      expect(jsonTransform(true, noop)).toBe(true)
      expect(jsonTransform(false, noop)).toBe(false)
      expect(jsonTransform('hello', noop)).toBe('hello')
      expect(jsonTransform(123, noop)).toBe(123)
    })

    it('handles empty arrays', () => {
      const input: unknown[] = []
      const result = jsonTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual([])
    })

    it('handles empty objects', () => {
      const input = {}
      const result = jsonTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual({})
    })

    it('handles arrays with primitives', () => {
      const input = [1, 2, 3]
      const result = jsonTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual([1, 2, 3])
    })

    it('handles objects with primitives', () => {
      const input = { a: 1, b: 'hello', c: true }
      const result = jsonTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual({ a: 1, b: 'hello', c: true })
    })

    it('handles mixed array and object nesting', () => {
      const input = {
        arrays: [
          [1, 2],
          [3, 4],
        ],
        objects: { nested: { value: 1 } },
      }

      const result = jsonTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual({
        arrays: [
          [1, 2],
          [3, 4],
        ],
        objects: { nested: { value: 1 } },
      })
    })

    it('rejects undefined', () => {
      expect(() => jsonTransform(undefined, noop)).toThrow(
        'Invalid undefined value at $',
      )
    })

    it('rejects functions', () => {
      expect(() => jsonTransform(() => {}, noop)).toThrow(
        'Invalid function at $',
      )
    })

    it('rejects symbols', () => {
      expect(() => jsonTransform(Symbol('test'), noop)).toThrow(
        'Invalid symbol at $',
      )
    })
  })

  describe('strict mode', () => {
    it('rejects invalid numbers in strict mode', () => {
      expect(() => jsonTransform(123.456, noop, { strict: true })).toThrow(
        'Invalid number (got 123.456) at $',
      )
      expect(() =>
        jsonTransform(Number.MAX_SAFE_INTEGER + 1, noop, {
          strict: true,
        }),
      ).toThrow('Invalid number (got 9007199254740992) at $')
    })

    it('allows non-integer numbers in non-strict mode', () => {
      expect(jsonTransform(123.456, noop, { strict: false })).toBe(123.456)
    })
  })

  describe('transformation', () => {
    it('applies transformation to root object', () => {
      const input = { type: 'test', value: 123 }
      const result = jsonTransform(input, (obj) => {
        if ('type' in obj && obj.type === 'test') {
          return { transformed: true }
        }
      })
      expect(result).toStrictEqual({ transformed: true })
    })

    it('transforms nested objects', () => {
      const input = {
        outer: { type: 'special', value: 1 },
        regular: 'data',
      }
      const result = jsonTransform(input, (obj) => {
        if ('type' in obj && obj.type === 'special') {
          return { replaced: true }
        }
      })
      expect(result).toStrictEqual({
        outer: { replaced: true },
        regular: 'data',
      })
    })

    it('lazy copies arrays only when needed', () => {
      const inner = { value: 1 }
      const input = [inner, { value: 2 }, { value: 3 }]

      const result = jsonTransform(input, (obj) => {
        if ('value' in obj && obj.value === 2) {
          return { transformed: 2 }
        }
      })

      expect(result).not.toBe(input) // Array was copied
      expect(result).toStrictEqual([
        { value: 1 },
        { transformed: 2 },
        { value: 3 },
      ])
    })

    it('lazy copies objects only when needed', () => {
      const unchanged = { value: 1 }
      const input = {
        unchanged,
        toChange: { type: 'special' },
      }

      const result = jsonTransform(input, (obj) => {
        if ('type' in obj && obj.type === 'special') {
          return { changed: true }
        }
      })

      expect(result).not.toBe(input) // Object was copied
      expect((result as any).unchanged).toBe(unchanged) // Unchanged property not copied
      expect((result as any).toChange).toStrictEqual({ changed: true })
    })

    it('transforms deeply nested structures', () => {
      // Create deeply nested structure with transformable objects
      // Level 0 is innermost, level 99 is outermost
      type Nested = { level: number; child: Nested[] }
      const isNested = (obj: object): obj is Nested => {
        return 'level' in obj
      }
      let nested: Nested[] = []
      for (let i = 0; i < 100; i++) {
        nested = [{ level: i, child: nested }]
      }

      const result = jsonTransform(nested, (obj) => {
        if (isNested(obj) && obj.level === 50) {
          return { transformed: true, child: obj.child }
        }
      })

      // Find the transformed level - level 50 is 49 layers from the outside
      let check: any = result
      for (let i = 99; i > 50; i--) {
        expect(Array.isArray(check)).toBe(true)
        expect(check[0]).toHaveProperty('level', i)
        check = check[0].child
      }
      expect(Array.isArray(check)).toBe(true)
      expect(check[0]).toStrictEqual({
        transformed: true,
        child: expect.anything(),
      })
    })

    it('handles nested arrays in objects', () => {
      const input = {
        items: [{ id: 1 }, { id: 2 }],
      }

      const result = jsonTransform(input, (obj) => {
        if ('id' in obj && obj.id === 1) {
          return { id: 1, transformed: true }
        }
      })

      expect(result).toStrictEqual({
        items: [{ id: 1, transformed: true }, { id: 2 }],
      })
    })

    it('handles transformation that returns primitives', () => {
      const input = { wrapper: { type: 'number', value: 42 } }
      const result = jsonTransform(input, (obj) => {
        if ('type' in obj && obj.type === 'number') {
          return 42 as any
        }
      })
      expect(result).toStrictEqual({ wrapper: 42 })
    })

    it('does not transform arrays themselves', () => {
      const input = [1, 2, 3]
      let transformCalled = false

      const result = jsonTransform(input, () => {
        transformCalled = true
        return { should: 'not happen' }
      })

      expect(transformCalled).toBe(false)
      expect(result).toBe(input)
    })
  })

  describe('depth limits', () => {
    it('handles deeply nested arrays (4000+ levels)', () => {
      // Create deeply nested structure
      let nested: unknown = []
      for (let i = 0; i < 4000; i++) {
        nested = [nested]
      }

      const input = { nested }
      const result = jsonTransform(input, () => {})

      // Verify structure
      let check = (result as any).nested
      for (let i = 0; i < 4000; i++) {
        expect(Array.isArray(check)).toBe(true)
        check = check[0]
      }
    })

    it('handles deeply nested objects', () => {
      // Create deeply nested structure
      let nested: unknown = { end: true }
      for (let i = 0; i < 1000; i++) {
        nested = { child: nested }
      }

      const input = { nested }
      const result = jsonTransform(input, () => {})

      // Verify structure
      let check = (result as any).nested
      for (let i = 0; i < 1000; i++) {
        expect(check).toHaveProperty('child')
        check = check.child
      }
      expect(check).toStrictEqual({ end: true })
    })
  })
})
