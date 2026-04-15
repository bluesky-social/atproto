import { describe, expect, test } from 'vitest'
import { lexTransform } from './lex-transform.js'

describe('lexTransform', () => {
  test('handles primitives', () => {
    expect(lexTransform(null, () => {})).toBe(null)
    expect(lexTransform(true, () => {})).toBe(true)
    expect(lexTransform(false, () => {})).toBe(false)
    expect(lexTransform('hello', () => {})).toBe('hello')
    expect(lexTransform(123, () => {})).toBe(123)
  })

  test('rejects invalid numbers in strict mode', () => {
    expect(() => lexTransform(123.456, () => {}, true)).toThrow(
      'Invalid number',
    )
    expect(() =>
      lexTransform(Number.MAX_SAFE_INTEGER + 1, () => {}, true),
    ).toThrow('Invalid number')
  })

  test('allows non-integer numbers in non-strict mode', () => {
    expect(lexTransform(123.456, () => {}, false)).toBe(123.456)
  })

  test('handles empty arrays', () => {
    const input: unknown[] = []
    const result = lexTransform(input, () => {})
    expect(result).toBe(input) // No copy needed
  })

  test('handles empty objects', () => {
    const input = {}
    const result = lexTransform(input, () => {})
    expect(result).toBe(input) // No copy needed
  })

  test('handles arrays with primitives', () => {
    const input = [1, 2, 3]
    const result = lexTransform(input, () => {})
    expect(result).toBe(input) // No transformation, no copy
  })

  test('handles objects with primitives', () => {
    const input = { a: 1, b: 'hello', c: true }
    const result = lexTransform(input, () => {})
    expect(result).toBe(input) // No transformation, no copy
  })

  test('applies transformation to root object', () => {
    const input = { type: 'test', value: 123 }
    const result = lexTransform(input, (obj) => {
      if ('type' in obj && obj.type === 'test') {
        return { transformed: true }
      }
    })
    expect(result).toStrictEqual({ transformed: true })
  })

  test('transforms nested objects', () => {
    const input = {
      outer: { type: 'special', value: 1 },
      regular: 'data',
    }
    const result = lexTransform(input, (obj) => {
      if ('type' in obj && obj.type === 'special') {
        return { replaced: true }
      }
    })
    expect(result).toStrictEqual({
      outer: { replaced: true },
      regular: 'data',
    })
  })

  test('lazy copies arrays only when needed', () => {
    const inner = { value: 1 }
    const input = [inner, { value: 2 }, { value: 3 }]

    const result = lexTransform(input, (obj) => {
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

  test('lazy copies objects only when needed', () => {
    const unchanged = { value: 1 }
    const input = {
      unchanged,
      toChange: { type: 'special' },
    }

    const result = lexTransform(input, (obj) => {
      if ('type' in obj && obj.type === 'special') {
        return { changed: true }
      }
    })

    expect(result).not.toBe(input) // Object was copied
    expect((result as any).unchanged).toBe(unchanged) // Unchanged property not copied
    expect((result as any).toChange).toStrictEqual({ changed: true })
  })

  test('handles deeply nested arrays (4000+ levels)', () => {
    // Create deeply nested structure
    let nested: unknown = []
    for (let i = 0; i < 4000; i++) {
      nested = [nested]
    }

    const input = { nested }
    const result = lexTransform(input, () => {})

    // Verify structure
    let check = (result as any).nested
    for (let i = 0; i < 4000; i++) {
      expect(Array.isArray(check)).toBe(true)
      check = check[0]
    }
  })

  test('handles deeply nested objects', () => {
    // Create deeply nested structure
    let nested: unknown = { end: true }
    for (let i = 0; i < 1000; i++) {
      nested = { child: nested }
    }

    const input = { nested }
    const result = lexTransform(input, () => {})

    // Verify structure
    let check = (result as any).nested
    for (let i = 0; i < 1000; i++) {
      expect(check).toHaveProperty('child')
      check = check.child
    }
    expect(check).toStrictEqual({ end: true })
  })

  test('transforms deeply nested structures', () => {
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

    const result = lexTransform(nested, (obj) => {
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

  test('handles mixed array and object nesting', () => {
    const input = {
      arrays: [
        [1, 2],
        [3, 4],
      ],
      objects: {
        nested: { value: 1 },
      },
    }

    const result = lexTransform(input, () => {})
    expect(result).toBe(input) // No transformation
  })

  test('handles transformation that returns primitives', () => {
    const input = { wrapper: { type: 'number', value: 42 } }
    const result = lexTransform(input, (obj) => {
      if ('type' in obj && obj.type === 'number') {
        return 42 as any
      }
    })
    expect(result).toStrictEqual({ wrapper: 42 })
  })

  test('does not transform arrays themselves', () => {
    const input = [1, 2, 3]
    let transformCalled = false

    const result = lexTransform(input, () => {
      transformCalled = true
      return { should: 'not happen' }
    })

    expect(transformCalled).toBe(false)
    expect(result).toBe(input)
  })

  test('handles nested arrays in objects', () => {
    const input = {
      items: [{ id: 1 }, { id: 2 }],
    }

    const result = lexTransform(input, (obj) => {
      if ('id' in obj && obj.id === 1) {
        return { id: 1, transformed: true }
      }
    })

    expect(result).toStrictEqual({
      items: [{ id: 1, transformed: true }, { id: 2 }],
    })
  })
})
