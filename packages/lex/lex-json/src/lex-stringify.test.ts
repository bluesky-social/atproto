import { describe, expect, it, test } from 'vitest'
import { MAX_CBOR_NESTED_LEVELS, parseCid } from '@atproto/lex-data'
import { lexStringify } from './lex-stringify.js'

describe(lexStringify, () => {
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

    test('stringify deeply nested objects (4000 levels)', () => {
      // Create a deeply nested structure using iteration to avoid recursion
      let deepData: any = {
        value: 'leaf',
        cid: parseCid(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
      }

      for (let i = 0; i < 4000; i++) {
        deepData = { nested: deepData }
      }

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexStringify(deepData)).not.toThrow()

      const jsonString = lexStringify(deepData)
      expect(jsonString.startsWith('{"nested":')).toBe(true)
      expect(jsonString.length).toBeGreaterThan(40000)
    })

    test('stringify deeply nested arrays (4000 levels)', () => {
      // Create a deeply nested array structure using iteration
      let deepData: any = [
        'leaf',
        parseCid('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
        new Uint8Array([1, 2, 3]),
      ]

      for (let i = 0; i < 4000; i++) {
        deepData = [deepData]
      }

      // This should not throw a "Maximum call stack size exceeded" error
      expect(() => lexStringify(deepData)).not.toThrow()

      const jsonString = lexStringify(deepData)
      expect(jsonString.startsWith('[[[')).toBe(true)
    })
  })
})
