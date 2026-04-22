import { assert, describe, expect, it, test } from 'vitest'
import { lexEquals } from '@atproto/lex-data'
import {
  acceptableVectors,
  invalidVectors,
  validVectors,
} from './fixtures.test.js'
import { lexParse, lexParseJsonBytes } from './lex-parse.js'

describe(lexParse, () => {
  describe('valid vectors', () => {
    describe('strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(
            lexEquals(lex, lexParse(JSON.stringify(json), { strict: true })),
          ).toBe(true)
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          expect(
            lexEquals(lex, lexParse(JSON.stringify(json), { strict: false })),
          ).toBe(true)
        })
      }
    })
  })

  describe('acceptable vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: true }),
          ).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })

  describe('invalid vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: true }),
          ).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          expect(() =>
            lexParse(JSON.stringify(json), { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })

  describe('depth limits', () => {
    it('supports very deeply nested structures', () => {
      const depth = 20000
      const input = '['.repeat(depth) + ']'.repeat(depth)
      let result = lexParse(input, { maxNestedLevels: depth })
      for (let i = 0; i < depth; i++) {
        assert(Array.isArray(result))
        result = result[0]
      }
    })

    it('allows deeply nested structures in non-strict mode', () => {
      const depth = 2000
      const input = '['.repeat(depth) + ']'.repeat(depth)
      let result = lexParse(input, { strict: false })
      for (let i = 0; i < depth; i++) {
        assert(Array.isArray(result))
        result = result[0]
      }
    })

    it('enforces depth limit in strict mode', () => {
      const depth = 2000
      const input = '['.repeat(depth) + ']'.repeat(depth)
      expect(() => lexParse(input, { strict: true })).toThrow(
        'Input is too deeply nested',
      )
    })

    it('enforces default limit (5000) in non-strict mode by default', () => {
      // Default is strict: false with maxNestedLevels: 5000
      // With the check being `parent.frame.depth >= maxNestedLevels`,
      // maxNestedLevels: 5000 allows depths 0-5000, meaning 5001 nested arrays work
      const validDepth = '['.repeat(5001) + ']'.repeat(5001)
      let result = lexParse(validDepth)
      for (let i = 0; i < 5001; i++) {
        assert(Array.isArray(result))
        result = result[0]
      }

      // Depth 5001 (5002 nested arrays) should throw
      const tooDeep = '['.repeat(5002) + ']'.repeat(5002)
      expect(() => lexParse(tooDeep)).toThrow('Input is too deeply nested')
    })
  })
})

describe(lexParseJsonBytes, () => {
  describe('valid vectors', () => {
    describe('strict mode', () => {
      describe('with pretty-printed JSON', () => {
        for (const { name, json, lex } of validVectors) {
          test(name, () => {
            const jsonBytes = Buffer.from(JSON.stringify(json, undefined, 4))
            expect(
              lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: true })),
            ).toBe(true)
          })
        }
      })
      describe('with compact JSON', () => {
        for (const { name, json, lex } of validVectors) {
          test(name, () => {
            const jsonBytes = Buffer.from(JSON.stringify(json))
            expect(
              lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: true })),
            ).toBe(true)
          })
        }
      })
    })

    describe('non-strict mode', () => {
      for (const { name, json, lex } of validVectors) {
        test(name, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(
            lexEquals(lex, lexParseJsonBytes(jsonBytes, { strict: false })),
          ).toBe(true)
        })
      }
    })
  })

  describe('acceptable vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() => lexParseJsonBytes(jsonBytes, { strict: true })).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of acceptableVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() =>
            lexParseJsonBytes(jsonBytes, { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })

  describe('invalid vectors', () => {
    describe('strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() => lexParseJsonBytes(jsonBytes, { strict: true })).toThrow()
        })
      }
    })
    describe('non-strict mode', () => {
      for (const { note, json } of invalidVectors) {
        test(note, () => {
          const jsonBytes = Buffer.from(JSON.stringify(json))
          expect(() =>
            lexParseJsonBytes(jsonBytes, { strict: false }),
          ).not.toThrow()
        })
      }
    })
  })
})
