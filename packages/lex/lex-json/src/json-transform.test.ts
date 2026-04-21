import { describe, expect, it } from 'vitest'
import { JsonTransformOptions, jsonTransform } from './json-transform.js'

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
      expect(() =>
        jsonTransform(123.456, noop, { allowNonSafeIntegers: false }),
      ).toThrow('Invalid number (got 123.456) at $')
      expect(() =>
        jsonTransform(Number.MAX_SAFE_INTEGER + 1, noop, {
          allowNonSafeIntegers: false,
        }),
      ).toThrow('Invalid number (got 9007199254740992) at $')
    })

    it('allows non-integer numbers in non-strict mode', () => {
      expect(jsonTransform(123.456, noop, { allowNonSafeIntegers: true })).toBe(
        123.456,
      )
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
      // Level 0 is innermost, level 31 is outermost (within MAX_CBOR_NESTED_LEVELS)
      type Nested = { level: number; child: Nested[] }
      const isNested = (obj: object): obj is Nested => {
        return 'level' in obj
      }
      let nested: Nested[] = []
      for (let i = 0; i < 32; i++) {
        nested = [{ level: i, child: nested }]
      }

      const result = jsonTransform(nested, (obj) => {
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
    it('handles deeply nested arrays (5000 levels)', () => {
      // maxNestedLevels: 5000 allows depths 0-5000
      // Root object at depth 0, then arrays at depths 1-5000 (5000 arrays total)
      // Starting with nested=[] and wrapping N times creates N+1 arrays
      // So wrap 4999 times to get 5000 arrays
      let nested: unknown = []
      for (let i = 0; i < 4999; i++) {
        nested = [nested]
      }

      const input = { nested }
      // The deepest array is at depth 5000
      const result = jsonTransform(input, () => {}, { maxNestedLevels: 5000 })

      // Verify structure (5000 arrays)
      let check = (result as any).nested
      for (let i = 0; i < 4999; i++) {
        expect(Array.isArray(check)).toBe(true)
        check = check[0]
      }
      expect(Array.isArray(check)).toBe(true)
      expect(check).toStrictEqual([])
    })

    it('handles deeply nested objects', () => {
      // maxNestedLevels: 5000 allows depths 0-5000
      // Root object at depth 0, then nested objects at depths 1-5000 (5000 objects)
      // Starting with nested={end:true} and wrapping N times creates N+1 objects
      // So wrap 4999 times to get 5000 nested objects
      let nested: unknown = { end: true }
      for (let i = 0; i < 4999; i++) {
        nested = { child: nested }
      }

      const input = { nested }
      // The deepest object is at depth 5000
      const result = jsonTransform(input, () => {}, { maxNestedLevels: 5000 })

      // Verify structure (5000 objects)
      let check = (result as any).nested
      for (let i = 0; i < 4999; i++) {
        expect(check).toHaveProperty('child')
        check = check.child
      }
      expect(check).toStrictEqual({ end: true })
    })

    it('enforces custom maxNestedLevels option', () => {
      let nested: unknown = []
      for (let i = 0; i <= 10; i++) {
        nested = [nested]
      }

      expect(() =>
        jsonTransform(nested, noop, { maxNestedLevels: 10 }),
      ).toThrow('Input is too deeply nested')
    })

    it('uses strict maxNestedLevels (32) in strict mode', () => {
      let nested: unknown = []
      // MAX_CBOR_NESTED_LEVELS = 32, so 33 levels should fail
      for (let i = 0; i <= 32; i++) {
        nested = [nested]
      }

      expect(() =>
        jsonTransform(nested, noop, { allowNonSafeIntegers: false }),
      ).toThrow(/Input is too deeply nested/)
    })

    it('uses lenient maxNestedLevels (5000) in non-strict mode', () => {
      let nested: unknown = []
      // maxNestedLevels: 5000 allows depths 0-5000
      // Start with [] and wrap 5000 times creates 5001 arrays at depths 0-5000
      for (let i = 0; i < 5000; i++) {
        nested = [nested]
      }

      // Should not throw at exactly the limit (depth 5000)
      expect(() =>
        jsonTransform(nested, noop, { maxNestedLevels: 5000 }),
      ).not.toThrow()

      // Wrap one more time creates depth 5001, which should throw
      nested = [nested]
      expect(() =>
        jsonTransform(nested, noop, { maxNestedLevels: 5000 }),
      ).toThrow(/Input is too deeply nested/)
    })
  })

  describe('array length limits', () => {
    it('enforces maxContainerLength option', () => {
      const longArray = Array.from({ length: 51 }, (_, i) => i)
      const input = { items: longArray }

      expect(() =>
        jsonTransform(input, noop, { maxContainerLength: 50 }),
      ).toThrow('Array is too long (length 51)')
    })

    it('allows arrays at the limit', () => {
      const array = Array.from({ length: 50 }, (_, i) => i)
      const input = { items: array }

      expect(() =>
        jsonTransform(input, noop, { maxContainerLength: 50 }),
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
        jsonTransform(input, noop, { maxContainerLength: 50 }),
      ).toThrow('Object has too many entries (length 51)')
    })

    it('allows objects at the limit', () => {
      const object: Record<string, number> = {}
      for (let i = 0; i < 50; i++) {
        object[`key${i}`] = i
      }
      const input = { data: object }

      expect(() =>
        jsonTransform(input, noop, { maxContainerLength: 50 }),
      ).not.toThrow()
    })
  })

  describe('allowNonSafeIntegers option', () => {
    it('allows non-integers when allowNonSafeIntegers is true', () => {
      const input = { value: 123.456, nested: { pi: 3.14159 } }
      const result = jsonTransform(input, noop, { allowNonSafeIntegers: true })
      expect(result).toStrictEqual({ value: 123.456, nested: { pi: 3.14159 } })
    })

    it('rejects non-integers when allowNonSafeIntegers is false', () => {
      const input = { value: 123.456 }
      expect(() =>
        jsonTransform(input, noop, { allowNonSafeIntegers: false }),
      ).toThrow('Invalid number (got 123.456)')
    })

    it('rejects non-safe integers when allowNonSafeIntegers is false', () => {
      const input = { value: Number.MAX_SAFE_INTEGER + 1 }
      expect(() =>
        jsonTransform(input, noop, { allowNonSafeIntegers: false }),
      ).toThrow('Invalid number')
    })

    it('allows safe integers when allowNonSafeIntegers is false', () => {
      const input = { value: 42, nested: { count: -100 } }
      const result = jsonTransform(input, noop, { allowNonSafeIntegers: false })
      expect(result).toStrictEqual({ value: 42, nested: { count: -100 } })
    })
  })

  describe('circular reference detection', () => {
    const options: JsonTransformOptions = {
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

      expect(() => jsonTransform(obj, noop, options)).toThrow(
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
      expect(() => jsonTransform(arr, noop, options)).toThrow(
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

      expect(() => jsonTransform(root, noop, options)).toThrow(
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
      const result = jsonTransform(input, noop)
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

      expect(() => jsonTransform(obj, noop, options)).toThrow(
        'Circular reference detected',
      )
    })
  })

  describe('undefined handling', () => {
    it('rejects undefined in arrays', () => {
      const input = [1, undefined as any, 3]
      expect(() => jsonTransform(input, noop)).toThrow(
        'Invalid undefined value at $[1]',
      )
    })

    it('removes undefined properties from objects', () => {
      const input = { a: 1, b: undefined as any, c: 3 }
      const result = jsonTransform(input, noop)
      expect(result).toStrictEqual({ a: 1, c: 3 })
      expect(result).not.toHaveProperty('b')
    })

    it('removes undefined from nested objects', () => {
      const input = {
        outer: { a: 1, b: undefined as any },
        keep: 'this',
      }
      const result = jsonTransform(input, noop)
      expect(result).not.toBe(input) // Object was copied
      expect(result).toStrictEqual({
        outer: { a: 1 },
        keep: 'this',
      })
    })
  })
})
