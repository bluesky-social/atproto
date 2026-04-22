import { describe, expect, it, test } from 'vitest'
import { MAX_CBOR_NESTED_LEVELS } from '@atproto/lex-data'
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
      const maxNestedLevels = 20_000
      const objectNesting = maxNestedLevels + 0

      type NestedObject = { level: number; nested?: NestedObject }
      const nestedObject: NestedObject = { level: 0 }
      let current: NestedObject = nestedObject
      for (let i = 1; i < objectNesting; i++) {
        current.nested = { level: i }
        current = current.nested
      }

      expect(() => JSON.stringify(nestedObject)).toThrow(RangeError)

      lexStringify(nestedObject, { maxNestedLevels })
    })

    it('throws error when structure exceeds max depth', () => {
      const maxNestedLevels = 50_000
      const objectNesting = maxNestedLevels + 1

      type NestedObject = { level: number; nested?: NestedObject }
      const nestedObject: NestedObject = { level: 0 }
      let current: NestedObject = nestedObject
      for (let i = 1; i < objectNesting; i++) {
        current.nested = { level: i }
        current = current.nested
      }

      expect(() => lexStringify(nestedObject, { maxNestedLevels })).toThrow(
        'Input is too deeply nested',
      )
    })

    it('enforces strict depth limit in strict mode', () => {
      type NestedObject = { level: number; nested?: NestedObject }
      const nestedObject: NestedObject = { level: 0 }
      let current: NestedObject = nestedObject
      for (let i = 1; i < MAX_CBOR_NESTED_LEVELS + 1; i++) {
        current.nested = { level: i }
        current = current.nested
      }

      expect(() => lexStringify(nestedObject, { strict: true })).toThrow(
        'Input is too deeply nested',
      )

      expect(() =>
        lexStringify(nestedObject, {
          maxNestedLevels: MAX_CBOR_NESTED_LEVELS + 2,
        }),
      ).not.toThrow()
    })
  })
})
