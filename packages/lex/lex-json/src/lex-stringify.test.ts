import { describe, expect, test } from 'vitest'
import { validVectors } from './lex-json.test.js'
import { lexStringify } from './lex-stringify.js'

describe('lexStringify', () => {
  describe('validVectors', () => {
    for (const { name, lex, json } of validVectors) {
      test(name, () => {
        const stringifyResult = lexStringify(lex)
        const composeResult = JSON.stringify(json)

        // Both should parse to the same value
        expect(JSON.parse(stringifyResult)).toStrictEqual(
          JSON.parse(composeResult),
        )
      })
    }
  })

  test('deeply nested structure', () => {
    type NestedObject = { level: number; nested?: NestedObject }
    const nestedObject: NestedObject = { level: 0 }
    let current: NestedObject = nestedObject
    for (let i = 1; i <= 100_000; i++) {
      current.nested = { level: i }
      current = current.nested
    }

    expect(() => JSON.stringify(nestedObject)).toThrow(RangeError)

    const stringifyResult = lexStringify(nestedObject, { maxDepth: 100_000 })
    expect(stringifyResult.length).toBeGreaterThanOrEqual(
      100_000 * `{"level":}`.length,
    )
  })
})
