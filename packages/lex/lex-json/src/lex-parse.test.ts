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
      assert.throws(
        () => lexParse(tooDeep),
        'Input is too deeply nested',
      )
    })
  })
})
