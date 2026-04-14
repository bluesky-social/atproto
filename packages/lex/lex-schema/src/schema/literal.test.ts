import { describe, expect, it } from 'vitest'
import { literal } from './literal.js'
import { withDefault } from './with-default.js'

describe('LiteralSchema', () => {
  describe('string literals', () => {
    const schema = literal('hello')

    it('validates exact string match', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('rejects different strings', () => {
      const result = schema.safeParse('world')
      expect(result.success).toBe(false)
    })

    it('rejects similar strings with different case', () => {
      const result = schema.safeParse('Hello')
      expect(result.success).toBe(false)
    })

    it('rejects empty string when literal is non-empty', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects objects', () => {
      const result = schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['hello'])
      expect(result.success).toBe(false)
    })
  })

  describe('empty string literal', () => {
    const schema = literal('')

    it('validates empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('')
      }
    })

    it('rejects non-empty strings', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('number literals', () => {
    const schema = literal(42)

    it('validates exact number match', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(42)
      }
    })

    it('rejects different numbers', () => {
      const result = schema.safeParse(43)
      expect(result.success).toBe(false)
    })

    it('rejects string representation of number', () => {
      const result = schema.safeParse('42')
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('zero literal', () => {
    const schema = literal(0)

    it('validates zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(0)
      }
    })

    it('rejects false', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects other numbers', () => {
      const result = schema.safeParse(1)
      expect(result.success).toBe(false)
    })
  })

  describe('negative number literals', () => {
    const schema = literal(-42)

    it('validates exact negative number match', () => {
      const result = schema.safeParse(-42)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(-42)
      }
    })

    it('rejects positive equivalent', () => {
      const result = schema.safeParse(42)
      expect(result.success).toBe(false)
    })

    it('rejects different negative numbers', () => {
      const result = schema.safeParse(-43)
      expect(result.success).toBe(false)
    })
  })

  describe('decimal number literals', () => {
    const schema = literal(3.14)

    it('validates exact decimal match', () => {
      const result = schema.safeParse(3.14)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(3.14)
      }
    })

    it('rejects different decimals', () => {
      const result = schema.safeParse(3.15)
      expect(result.success).toBe(false)
    })

    it('rejects integer equivalent', () => {
      const result = schema.safeParse(3)
      expect(result.success).toBe(false)
    })
  })

  describe('boolean literals', () => {
    describe('true literal', () => {
      const schema = literal(true)

      it('validates true', () => {
        const result = schema.safeParse(true)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(true)
        }
      })

      it('rejects false', () => {
        const result = schema.safeParse(false)
        expect(result.success).toBe(false)
      })

      it('rejects truthy values', () => {
        const result = schema.safeParse(1)
        expect(result.success).toBe(false)
      })

      it('rejects string representation', () => {
        const result = schema.safeParse('true')
        expect(result.success).toBe(false)
      })

      it('rejects null', () => {
        const result = schema.safeParse(null)
        expect(result.success).toBe(false)
      })

      it('rejects undefined', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(false)
      })
    })

    describe('false literal', () => {
      const schema = literal(false)

      it('validates false', () => {
        const result = schema.safeParse(false)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(false)
        }
      })

      it('rejects true', () => {
        const result = schema.safeParse(true)
        expect(result.success).toBe(false)
      })

      it('rejects falsy values', () => {
        const result = schema.safeParse(0)
        expect(result.success).toBe(false)
      })

      it('rejects empty string', () => {
        const result = schema.safeParse('')
        expect(result.success).toBe(false)
      })

      it('rejects null', () => {
        const result = schema.safeParse(null)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('null literal', () => {
    const schema = literal(null)

    it('validates null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(null)
      }
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects false', () => {
      const result = schema.safeParse(false)
      expect(result.success).toBe(false)
    })

    it('rejects zero', () => {
      const result = schema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects string "null"', () => {
      const result = schema.safeParse('null')
      expect(result.success).toBe(false)
    })
  })

  describe('default values', () => {
    describe('string literal with default', () => {
      const schema = withDefault(literal('hello'), 'hello')

      it('uses default value when undefined is provided', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe('hello')
        }
      })

      it('uses explicit value over default', () => {
        const result = schema.safeParse('hello')
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe('hello')
        }
      })

      it('rejects non-matching value even with default', () => {
        const result = schema.safeParse('world')
        expect(result.success).toBe(false)
      })
    })

    describe('number literal with default', () => {
      const schema = withDefault(literal(42), 42)

      it('uses default value when undefined is provided', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(42)
        }
      })

      it('uses explicit value over default', () => {
        const result = schema.safeParse(42)
        expect(result.success).toBe(true)
      })
    })

    describe('boolean literal with default', () => {
      const schema = withDefault(literal(true), true)

      it('uses default value when undefined is provided', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(true)
        }
      })

      it('uses explicit value over default', () => {
        const result = schema.safeParse(true)
        expect(result.success).toBe(true)
      })
    })

    describe('null literal with default', () => {
      const schema = withDefault(literal(null), null)

      it('uses default value when undefined is provided', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(null)
        }
      })

      it('uses explicit value over default', () => {
        const result = schema.safeParse(null)
        expect(result.success).toBe(true)
      })
    })

    describe('false literal with default', () => {
      const schema = withDefault(literal(false), false)

      it('uses default value when undefined is provided', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(false)
        }
      })

      it('does not confuse explicit false with undefined', () => {
        const result = schema.safeParse(false)
        expect(result.success).toBe(true)
      })
    })

    describe('zero literal with default', () => {
      const schema = withDefault(literal(0), 0)

      it('uses default value when undefined is provided', () => {
        const result = schema.safeParse(undefined)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.value).toBe(0)
        }
      })

      it('does not confuse explicit zero with undefined', () => {
        const result = schema.safeParse(0)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('edge cases', () => {
    it('handles special string characters', () => {
      const schema = literal('hello\nworld')
      expect(schema.safeParse('hello\nworld').success).toBe(true)
      expect(schema.safeParse('hello world').success).toBe(false)
    })

    it('handles unicode characters in strings', () => {
      const schema = literal('Hello 世界 🌍')
      expect(schema.safeParse('Hello 世界 🌍').success).toBe(true)
      expect(schema.safeParse('Hello world').success).toBe(false)
    })

    it('handles emoji literals', () => {
      const schema = literal('🚀')
      expect(schema.safeParse('🚀').success).toBe(true)
      expect(schema.safeParse('🌟').success).toBe(false)
    })

    it('handles very long string literals', () => {
      const longString = 'a'.repeat(1000)
      const schema = literal(longString)
      expect(schema.safeParse(longString).success).toBe(true)
      expect(schema.safeParse(longString + 'b').success).toBe(false)
    })

    it('handles string with whitespace', () => {
      const schema = literal('  hello  ')
      expect(schema.safeParse('  hello  ').success).toBe(true)
      expect(schema.safeParse('hello').success).toBe(false)
      expect(schema.safeParse('  hello').success).toBe(false)
    })

    it('handles Number.MAX_SAFE_INTEGER', () => {
      const schema = literal(Number.MAX_SAFE_INTEGER)
      expect(schema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true)
      expect(schema.safeParse(Number.MAX_SAFE_INTEGER - 1).success).toBe(false)
    })

    it('handles Number.MIN_SAFE_INTEGER', () => {
      const schema = literal(Number.MIN_SAFE_INTEGER)
      expect(schema.safeParse(Number.MIN_SAFE_INTEGER).success).toBe(true)
      expect(schema.safeParse(Number.MIN_SAFE_INTEGER + 1).success).toBe(false)
    })

    it('rejects NaN', () => {
      const schema = literal(42)
      expect(schema.safeParse(NaN).success).toBe(false)
    })

    it('rejects Infinity', () => {
      const schema = literal(42)
      expect(schema.safeParse(Infinity).success).toBe(false)
    })

    it('rejects -Infinity', () => {
      const schema = literal(42)
      expect(schema.safeParse(-Infinity).success).toBe(false)
    })

    it('rejects Boolean objects', () => {
      const schema = literal(true)
      expect(schema.safeParse(new Boolean(true)).success).toBe(false)
    })

    it('rejects String objects', () => {
      const schema = literal('hello')
      expect(schema.safeParse(new String('hello')).success).toBe(false)
    })

    it('rejects Number objects', () => {
      const schema = literal(42)
      expect(schema.safeParse(new Number(42)).success).toBe(false)
    })

    it('distinguishes between -0 and +0', () => {
      const schemaPositive = literal(0)
      const schemaNegative = literal(-0)
      // In JavaScript, 0 === -0, so both should validate for both schemas
      expect(schemaPositive.safeParse(0).success).toBe(true)
      expect(schemaPositive.safeParse(-0).success).toBe(true)
      expect(schemaNegative.safeParse(0).success).toBe(true)
      expect(schemaNegative.safeParse(-0).success).toBe(true)
    })

    it('handles very small decimal differences', () => {
      const schema = literal(0.1 + 0.2)
      // Note: 0.1 + 0.2 !== 0.3 in JavaScript due to floating point precision
      expect(schema.safeParse(0.1 + 0.2).success).toBe(true)
      expect(schema.safeParse(0.3).success).toBe(false)
    })
  })

  describe('type safety', () => {
    it('accepts exact literal types in TypeScript', () => {
      const schema = literal('specific' as const)
      const result = schema.safeParse('specific')
      expect(result.success).toBe(true)
    })

    it('preserves literal type in success result', () => {
      const schema = literal(42)
      const result = schema.safeParse(42)
      expect(result.success).toBe(true)
      if (result.success) {
        // TypeScript should infer result.value as the literal type 42
        expect(result.value).toBe(42)
      }
    })
  })
})
