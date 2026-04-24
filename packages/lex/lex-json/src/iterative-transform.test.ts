import { assert, describe, expect, it } from 'vitest'
import { MAX_CBOR_NESTED_LEVELS } from '@atproto/lex-data'
import {
  IterativeTransformOptions,
  iterativeTransform,
} from './iterative-transform.js'

const noop = () => {}

describe(iterativeTransform, () => {
  describe('noop transform', () => {
    it('handles primitives', () => {
      expect(iterativeTransform(null, noop)).toBe(null)
      expect(iterativeTransform(true, noop)).toBe(true)
      expect(iterativeTransform(false, noop)).toBe(false)
      expect(iterativeTransform('hello', noop)).toBe('hello')
      expect(iterativeTransform(123, noop)).toBe(123)
    })

    it('handles empty arrays', () => {
      const input: unknown[] = []
      const result = iterativeTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual([])
    })

    it('handles empty objects', () => {
      const input = {}
      const result = iterativeTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual({})
    })

    it('handles arrays with primitives', () => {
      const input = [1, 2, 3]
      const result = iterativeTransform(input, noop)
      // No copy
      expect(result).toBe(input)
      // No transformation
      expect(result).toStrictEqual([1, 2, 3])
    })

    it('handles objects with primitives', () => {
      const input = { a: 1, b: 'hello', c: true }
      const result = iterativeTransform(input, noop)
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

      const result = iterativeTransform(input, noop)
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
      expect(() => iterativeTransform(undefined, noop)).toThrow(
        'Invalid undefined value',
      )
    })

    it('rejects functions', () => {
      expect(() => iterativeTransform(() => {}, noop)).toThrow(
        'Invalid function',
      )
    })

    it('rejects symbols', () => {
      expect(() => iterativeTransform(Symbol('test'), noop)).toThrow(
        'Invalid symbol',
      )
    })
  })

  describe('strict mode', () => {
    it('rejects invalid numbers in strict mode', () => {
      expect(() =>
        iterativeTransform(123.456, noop, { allowNonSafeIntegers: false }),
      ).toThrow('Invalid number (got 123.456)')
      expect(() =>
        iterativeTransform(Number.MAX_SAFE_INTEGER + 1, noop, {
          allowNonSafeIntegers: false,
        }),
      ).toThrow('Invalid number (got 9007199254740992)')
    })

    it('allows non-integer numbers in non-strict mode', () => {
      expect(
        iterativeTransform(123.456, noop, { allowNonSafeIntegers: true }),
      ).toBe(123.456)
    })
  })

  describe('transformation', () => {
    it('applies transformation to root object', () => {
      const input = { type: 'test', value: 123 }
      const result = iterativeTransform(input, (obj) => {
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
      const result = iterativeTransform(input, (obj) => {
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

      const result = iterativeTransform(input, (obj) => {
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

      const result = iterativeTransform(input, (obj) => {
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
      // Level 0 is innermost, level 31 is outermost (within MAX_CBOR_NESTED_LEVELS)
      type Nested = { level: number; child: Nested[] }
      const isNested = (obj: object): obj is Nested => {
        return 'level' in obj
      }
      let nested: Nested[] = []
      for (let i = 0; i < 32; i++) {
        nested = [{ level: i, child: nested }]
      }

      const result = iterativeTransform(nested, (obj) => {
        if (isNested(obj) && obj.level === 15) {
          return { transformed: true, child: obj.child }
        }
      })

      // Find the transformed level - level 15 is 16 layers from the outside
      let check: any = result
      for (let i = 31; i > 15; i--) {
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

      const result = iterativeTransform(input, (obj) => {
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
      const result = iterativeTransform(input, (obj) => {
        if ('type' in obj && obj.type === 'number') {
          return 42 as any
        }
      })
      expect(result).toStrictEqual({ wrapper: 42 })
    })

    it('does not transform arrays themselves', () => {
      const input = [1, 2, 3]
      let transformCalled = false

      const result = iterativeTransform(input, () => {
        transformCalled = true
        return { should: 'not happen' }
      })

      expect(transformCalled).toBe(false)
      expect(result).toBe(input)
    })
  })

  describe('depth limits', () => {
    it('handles deeply nested objects', () => {
      const LIMIT = 5000

      // maxNestedLevels: LIMIT allows depths [0;LIMIT]. Starting with nested=[]
      // and wrapping N times creates N+1 arrays, so wrapping LIMIT-1 times to
      // get LIMIT nesting levels in total
      type Nested = { nested: Nested } | { end: boolean }
      let nested: Nested = { end: true }
      for (let i = 0; i <= LIMIT - 1; i++) {
        nested = { nested }
      }

      const result = iterativeTransform(
        nested,
        (val) => {
          // Transform the innermost object
          if ('end' in val) return { end: false }
        },
        { maxNestedLevels: LIMIT },
      ) as { nested: Nested }

      // Object was copied due to transformation
      assert(result !== nested)

      // This should throw due to exceeding maxNestedLevels (we are wrapping one
      // more time to get depth = LIMIT + 1)
      expect(() =>
        iterativeTransform({ nested }, noop, { maxNestedLevels: LIMIT }),
      ).toThrow('Input is too deeply nested')

      // unwrap result to check the transformation was applied correctly
      let check: Nested = result
      for (let i = 0; i < LIMIT; i++) {
        assert('nested' in check)
        check = check.nested
      }
      expect(check).toStrictEqual({ end: false })

      // Original input should be unchanged
      for (let i = 0; i < LIMIT; i++) {
        assert('nested' in nested)
        nested = nested.nested
      }
      expect(nested).toStrictEqual({ end: true })
    })

    it('uses MAX_CBOR_NESTED_LEVELS by default', () => {
      const LIMIT = MAX_CBOR_NESTED_LEVELS

      let nested: unknown = []
      for (let i = 0; i <= LIMIT - 1; i++) nested = [nested]

      expect(() => iterativeTransform(nested, noop)).not.toThrow()

      nested = [nested]

      expect(() => iterativeTransform(nested, noop)).toThrow(
        'Input is too deeply nested',
      )
    })

    it('enforces custom maxNestedLevels option', () => {
      const LIMIT = 10

      type Nested = [Nested] | []
      let nested: Nested = []
      for (let i = 0; i <= LIMIT - 1; i++) nested = [nested]

      expect(() =>
        iterativeTransform(nested, noop, { maxNestedLevels: LIMIT }),
      ).not.toThrow()

      nested = [nested]

      expect(() =>
        iterativeTransform(nested, noop, { maxNestedLevels: LIMIT }),
      ).toThrow('Input is too deeply nested')
    })

    it('enforces very deep nesting limits', () => {
      const LIMIT = 1_000_000

      type Nested = [Nested] | []
      let nested: Nested = []
      for (let i = 0; i <= LIMIT - 1; i++) nested = [nested]

      expect(() =>
        iterativeTransform(nested, noop, { maxNestedLevels: LIMIT }),
      ).not.toThrow()

      // Wrap one more time creates depth = LIMIT + 1
      nested = [nested]

      expect(() =>
        iterativeTransform(nested, noop, { maxNestedLevels: LIMIT }),
      ).toThrow('Input is too deeply nested')
    })
  })

  describe('array length limits', () => {
    it('enforces maxContainerLength option', () => {
      const longArray = Array.from({ length: 51 }, (_, i) => i)
      const input = { items: longArray }

      expect(() =>
        iterativeTransform(input, noop, { maxContainerLength: 50 }),
      ).toThrow('Array is too long (length 51)')
    })

    it('allows arrays at the limit', () => {
      const array = Array.from({ length: 50 }, (_, i) => i)
      const input = { items: array }

      expect(() =>
        iterativeTransform(input, noop, { maxContainerLength: 50 }),
      ).not.toThrow()
    })
  })

  describe('object entry limits', () => {
    it('enforces maxContainerLength option', () => {
      const largeObject: Record<string, number> = {}
      for (let i = 0; i < 51; i++) {
        largeObject[`key${i}`] = i
      }
      const input = { data: largeObject }

      expect(() =>
        iterativeTransform(input, noop, { maxContainerLength: 50 }),
      ).toThrow('Object has too many entries (length 51)')
    })

    it('allows objects at the limit', () => {
      const object: Record<string, number> = {}
      for (let i = 0; i < 50; i++) {
        object[`key${i}`] = i
      }
      const input = { data: object }

      expect(() =>
        iterativeTransform(input, noop, { maxContainerLength: 50 }),
      ).not.toThrow()
    })
  })

  describe('allowNonSafeIntegers option', () => {
    it('allows non-integers when allowNonSafeIntegers is true', () => {
      const input = { value: 123.456, nested: { pi: 3.14159 } }
      const result = iterativeTransform(input, noop, {
        allowNonSafeIntegers: true,
      })
      expect(result).toStrictEqual({ value: 123.456, nested: { pi: 3.14159 } })
    })

    it('rejects non-integers when allowNonSafeIntegers is false', () => {
      const input = { value: 123.456 }
      expect(() =>
        iterativeTransform(input, noop, { allowNonSafeIntegers: false }),
      ).toThrow('Invalid number (got 123.456)')
    })

    it('rejects non-safe integers when allowNonSafeIntegers is false', () => {
      const input = { value: Number.MAX_SAFE_INTEGER + 1 }
      expect(() =>
        iterativeTransform(input, noop, { allowNonSafeIntegers: false }),
      ).toThrow('Invalid number')
    })

    it('allows safe integers when allowNonSafeIntegers is false', () => {
      const input = { value: 42, nested: { count: -100 } }
      const result = iterativeTransform(input, noop, {
        allowNonSafeIntegers: false,
      })
      expect(result).toStrictEqual({ value: 42, nested: { count: -100 } })
    })
  })

  describe('circular reference detection', () => {
    const options: IterativeTransformOptions = {
      maxNestedLevels: Infinity,
    }

    it('detects circular references in objects at depth 50', () => {
      const obj: any = { value: 1 }

      // Build a chain of 50 nested objects
      let current = obj
      for (let i = 0; i < 50; i++) {
        current.next = { value: i }
        current = current.next
      }
      // Create circular reference
      current.next = obj

      expect(() => iterativeTransform(obj, noop, options)).toThrow(
        'Circular reference detected',
      )
    })

    it('detects circular references in arrays at depth 50', () => {
      const arr: any[] = [1]

      // Build a chain of 50 nested arrays
      let current = arr
      for (let i = 0; i < 50; i++) {
        const next = [i]
        current.push(next)
        current = next
      }
      // Create circular reference
      current.push(arr)
      expect(() => iterativeTransform(arr, noop, options)).toThrow(
        'Circular reference detected',
      )
    })

    it('detects circular reference to intermediate parent', () => {
      const root: any = { level: 0 }
      let current = root

      // Build chain of 50 levels
      for (let i = 1; i <= 50; i++) {
        current.child = { level: i }
        current = current.child
      }

      // Reference an intermediate parent (level 25)
      let intermediate = root
      for (let i = 0; i < 25; i++) {
        intermediate = intermediate.child
      }
      current.circular = intermediate

      expect(() => iterativeTransform(root, noop, options)).toThrow(
        'Circular reference detected',
      )
    })

    it('allows repeated references to same object (not circular)', () => {
      const shared = { shared: 'value' }
      const input = {
        ref1: shared,
        ref2: shared,
        nested: { ref3: shared },
      }

      // This should not throw - it's not a circular reference
      const result = iterativeTransform(input, noop)
      expect(result).toStrictEqual({
        ref1: { shared: 'value' },
        ref2: { shared: 'value' },
        nested: { ref3: { shared: 'value' } },
      })
    })

    it('reports path in circular reference error', () => {
      const obj: any = { data: { value: 1 } }
      let current = obj.data

      for (let i = 0; i < 50; i++) {
        current.next = { value: i }
        current = current.next
      }
      current.circular = obj.data

      expect(() => iterativeTransform(obj, noop, options)).toThrow(
        'Circular reference detected',
      )
    })
  })

  describe('undefined handling', () => {
    it('rejects undefined in arrays', () => {
      const input = [1, undefined as any, 3]
      expect(() => iterativeTransform(input, noop)).toThrow(
        'Invalid undefined value',
      )
    })

    it('removes undefined properties from objects', () => {
      const input = { a: 1, b: undefined as any, c: 3 }
      const result = iterativeTransform(input, noop)
      expect(result).toStrictEqual({ a: 1, c: 3 })
      expect(result).not.toHaveProperty('b')
    })

    it('removes undefined from nested objects', () => {
      const input = {
        outer: { a: 1, b: undefined as any },
        keep: 'this',
      }
      const result = iterativeTransform(input, noop)
      expect(result).not.toBe(input) // Object was copied
      expect(result).toStrictEqual({
        outer: { a: 1 },
        keep: 'this',
      })
    })
  })
})
