import assert from 'node:assert'
import { describe, it } from 'vitest'
import { lexParse } from './lex-parse.js'

describe(lexParse, () => {
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

    it('allows deeply nested structures by default (non-strict mode)', () => {
      const depth = 5002
      const input = '['.repeat(depth) + ']'.repeat(depth)
      // Should not throw in non-strict mode (default)
      let result = lexParse(input)
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
      assert.throws(
        () => lexParse(input, { strict: true }),
        /Input is too deeply nested/,
      )
    })
  })
})
