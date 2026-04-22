import { describe, expect, it, test } from 'vitest'
import { validVectors } from './fixtures.test.js'
import { lexStringify } from './lex-stringify.js'

describe(lexStringify, () => {
  describe('validVectors', () => {
    for (const { name, lex, json } of validVectors) {
      test(name, () => {
        const stringifyResult = lexStringify(lex)
        const composeResult = JSON.stringify(json)

        // Both should parse to the similar value (ignoring whitespace
        // differences, object key order, etc.)
        expect(JSON.parse(stringifyResult)).toStrictEqual(
          JSON.parse(composeResult),
        )
      })
    }
  })

  describe('deeply nested structure', () => {
    it('handles deeply nested structures without throwing', () => {
      type NestedObject = { level: number; nested?: NestedObject }
      const nestedObject: NestedObject = { level: 0 }
      let current: NestedObject = nestedObject
      for (let i = 1; i < 20_000; i++) {
        current.nested = { level: i }
        current = current.nested
      }

      expect(() => JSON.stringify(nestedObject)).toThrow(RangeError)

      lexStringify(nestedObject, {
        maxNestedLevels: 20_000,
      })
    })

    it('throws error when structure exceeds max depth', () => {
      const maxNestedLevels = 50_000
      type NestedObject = { level: number; nested?: NestedObject }
      const nestedObject: NestedObject = { level: 0 }
      let current: NestedObject = nestedObject
      for (let i = 1; i <= maxNestedLevels + 1; i++) {
        current.nested = { level: i }
        current = current.nested
      }

      expect(() => lexStringify(nestedObject, { maxNestedLevels })).toThrow(
        'Input is too deeply nested',
      )
    })

    it('enforces depth limit in strict mode', () => {
      type NestedObject = { level: number; nested?: NestedObject }
      const nestedObject: NestedObject = { level: 0 }
      let current: NestedObject = nestedObject
      for (let i = 1; i <= 100; i++) {
        current.nested = { level: i }
        current = current.nested
      }

      expect(() => lexStringify(nestedObject, { strict: true })).toThrow(
        'Input is too deeply nested',
      )
    })
  })
})
