import { describe, expect, it } from 'vitest'
import { TokenSchema } from './token.js'

describe('TokenSchema', () => {
  describe('basic validation', () => {
    const schema = new TokenSchema('mytoken')

    it('validates exact token match', () => {
      const result = schema.safeParse('mytoken')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('mytoken')
      }
    })

    it('rejects different strings', () => {
      const result = schema.safeParse('othertoken')
      expect(result.success).toBe(false)
    })

    it('rejects similar strings with different case', () => {
      const result = schema.safeParse('MyToken')
      expect(result.success).toBe(false)
    })

    it('rejects partial matches', () => {
      const result = schema.safeParse('my')
      expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('TokenSchema instance validation', () => {
    const schema = new TokenSchema('mytoken')

    it('accepts TokenSchema instance with same value', () => {
      const otherInstance = new TokenSchema('mytoken')
      const result = schema.safeParse(otherInstance)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('mytoken')
      }
    })

    it('rejects TokenSchema instance with different value', () => {
      const otherInstance = new TokenSchema('othertoken')
      const result = schema.safeParse(otherInstance)
      expect(result.success).toBe(false)
    })

    it('accepts itself as input', () => {
      const result = schema.safeParse(schema)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('mytoken')
      }
    })
  })

  describe('type validation', () => {
    const schema = new TokenSchema('mytoken')

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects numbers', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects objects', () => {
      const result = schema.safeParse({ token: 'mytoken' })
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['mytoken'])
      expect(result.success).toBe(false)
    })

    it('rejects String objects', () => {
      const result = schema.safeParse(new String('mytoken'))
      expect(result.success).toBe(false)
    })
  })

  describe('special token values', () => {
    it('validates token with spaces', () => {
      const schema = new TokenSchema('my token')
      expect(schema.safeParse('my token').success).toBe(true)
    })

    it('validates token with special characters', () => {
      const schema = new TokenSchema('token-with-dashes')
      expect(schema.safeParse('token-with-dashes').success).toBe(true)
    })

    it('validates token with underscores', () => {
      const schema = new TokenSchema('token_with_underscores')
      expect(schema.safeParse('token_with_underscores').success).toBe(true)
    })

    it('validates token with dots', () => {
      const schema = new TokenSchema('token.with.dots')
      expect(schema.safeParse('token.with.dots').success).toBe(true)
    })

    it('validates token with numbers', () => {
      const schema = new TokenSchema('token123')
      expect(schema.safeParse('token123').success).toBe(true)
    })

    it('validates token with unicode characters', () => {
      const schema = new TokenSchema('token世界')
      expect(schema.safeParse('token世界').success).toBe(true)
    })

    it('validates token with emoji', () => {
      const schema = new TokenSchema('token🚀')
      expect(schema.safeParse('token🚀').success).toBe(true)
    })

    it('validates token with newlines', () => {
      const schema = new TokenSchema('token\nwith\nnewlines')
      expect(schema.safeParse('token\nwith\nnewlines').success).toBe(true)
      expect(schema.safeParse('token with newlines').success).toBe(false)
    })

    it('validates token with tabs', () => {
      const schema = new TokenSchema('token\twith\ttabs')
      expect(schema.safeParse('token\twith\ttabs').success).toBe(true)
    })

    it('validates very long token', () => {
      const longToken = 'token'.repeat(200)
      const schema = new TokenSchema(longToken)
      expect(schema.safeParse(longToken).success).toBe(true)
      expect(schema.safeParse(longToken + 'x').success).toBe(false)
    })
  })

  describe('empty token', () => {
    const schema = new TokenSchema('')

    it('validates empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('')
      }
    })

    it('rejects non-empty strings', () => {
      const result = schema.safeParse('anything')
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

    it('accepts TokenSchema instance with empty value', () => {
      const otherInstance = new TokenSchema('')
      const result = schema.safeParse(otherInstance)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('')
      }
    })
  })

  describe('whitespace handling', () => {
    it('treats whitespace as significant', () => {
      const schema = new TokenSchema('  token  ')
      expect(schema.safeParse('  token  ').success).toBe(true)
      expect(schema.safeParse('token').success).toBe(false)
      expect(schema.safeParse('  token').success).toBe(false)
      expect(schema.safeParse('token  ').success).toBe(false)
    })

    it('distinguishes between different whitespace', () => {
      const schema = new TokenSchema('token ')
      expect(schema.safeParse('token ').success).toBe(true)
      expect(schema.safeParse('token').success).toBe(false)
      expect(schema.safeParse('token  ').success).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    const schema = new TokenSchema('Token')

    it('is case sensitive', () => {
      expect(schema.safeParse('Token').success).toBe(true)
      expect(schema.safeParse('token').success).toBe(false)
      expect(schema.safeParse('TOKEN').success).toBe(false)
      expect(schema.safeParse('ToKeN').success).toBe(false)
    })

    it('handles case-sensitive TokenSchema instances', () => {
      expect(schema.safeParse(new TokenSchema('Token')).success).toBe(true)
      expect(schema.safeParse(new TokenSchema('token')).success).toBe(false)
    })
  })

  describe('common token patterns', () => {
    it('validates namespace-style tokens', () => {
      const schema = new TokenSchema('com.example.record')
      expect(schema.safeParse('com.example.record').success).toBe(true)
    })

    it('validates URL-like tokens', () => {
      const schema = new TokenSchema('https://example.com/path')
      expect(schema.safeParse('https://example.com/path').success).toBe(true)
    })

    it('validates version-like tokens', () => {
      const schema = new TokenSchema('v1.0.0')
      expect(schema.safeParse('v1.0.0').success).toBe(true)
    })

    it('validates hash-like tokens', () => {
      const schema = new TokenSchema('#token')
      expect(schema.safeParse('#token').success).toBe(true)
    })

    it('validates type discriminator tokens', () => {
      const schema = new TokenSchema('#post')
      expect(schema.safeParse('#post').success).toBe(true)
      expect(schema.safeParse('#comment').success).toBe(false)
    })
  })

  describe('serialization methods', () => {
    const schema = new TokenSchema('mytoken')

    it('toJSON returns the token value', () => {
      expect(schema.toJSON()).toBe('mytoken')
    })

    it('toString returns the token value', () => {
      expect(schema.toString()).toBe('mytoken')
    })

    it('toJSON and toString return the same value', () => {
      expect(schema.toJSON()).toBe(schema.toString())
    })

    it('handles empty token serialization', () => {
      const emptySchema = new TokenSchema('')
      expect(emptySchema.toJSON()).toBe('')
      expect(emptySchema.toString()).toBe('')
    })

    it('handles special characters in serialization', () => {
      const specialSchema = new TokenSchema('token\nwith\tspecial')
      expect(specialSchema.toJSON()).toBe('token\nwith\tspecial')
      expect(specialSchema.toString()).toBe('token\nwith\tspecial')
    })

    it('serializes to primitive string in JSON', () => {
      const schema = new TokenSchema('mytoken')
      const obj = { token: schema }
      expect(JSON.stringify(obj)).toBe('{"token":"mytoken"}')
    })
  })

  describe('value property', () => {
    const schema = new TokenSchema('mytoken')

    it('exposes the token value through serialization', () => {
      // value is protected, so we verify it through toString/toJSON
      expect(schema.toString()).toBe('mytoken')
      expect(schema.toJSON()).toBe('mytoken')
    })
  })

  describe('multiple token instances', () => {
    const schema1 = new TokenSchema('token1')
    const schema2 = new TokenSchema('token2')
    const schema3 = new TokenSchema('token1')

    it('different instances with same value validate each other', () => {
      expect(schema1.safeParse(schema3).success).toBe(true)
      expect(schema3.safeParse(schema1).success).toBe(true)
    })

    it('different instances with different values reject each other', () => {
      expect(schema1.safeParse(schema2).success).toBe(false)
      expect(schema2.safeParse(schema1).success).toBe(false)
    })

    it('validates string values correctly', () => {
      expect(schema1.safeParse('token1').success).toBe(true)
      expect(schema1.safeParse('token2').success).toBe(false)
      expect(schema2.safeParse('token2').success).toBe(true)
      expect(schema2.safeParse('token1').success).toBe(false)
    })
  })

  describe('type safety', () => {
    it('preserves token type in TypeScript', () => {
      const schema = new TokenSchema('specific' as const)
      const result = schema.safeParse('specific')
      expect(result.success).toBe(true)
      if (result.success) {
        // TypeScript should infer result.value as the literal type 'specific'
        expect(result.value).toBe('specific')
      }
    })

    it('handles generic token types', () => {
      const schema: TokenSchema<'a' | 'b'> = new TokenSchema('a')
      expect(schema.safeParse('a').success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles tokens that look like numbers', () => {
      const schema = new TokenSchema('123')
      expect(schema.safeParse('123').success).toBe(true)
      expect(schema.safeParse(123).success).toBe(false)
    })

    it('handles tokens that look like booleans', () => {
      const schema = new TokenSchema('true')
      expect(schema.safeParse('true').success).toBe(true)
      expect(schema.safeParse(true).success).toBe(false)
    })

    it('handles tokens that look like null', () => {
      const schema = new TokenSchema('null')
      expect(schema.safeParse('null').success).toBe(true)
      expect(schema.safeParse(null).success).toBe(false)
    })

    it('handles tokens that look like undefined', () => {
      const schema = new TokenSchema('undefined')
      expect(schema.safeParse('undefined').success).toBe(true)
      expect(schema.safeParse(undefined).success).toBe(false)
    })

    it('handles tokens with only whitespace', () => {
      const schema = new TokenSchema('   ')
      expect(schema.safeParse('   ').success).toBe(true)
      expect(schema.safeParse('  ').success).toBe(false)
      expect(schema.safeParse('    ').success).toBe(false)
    })

    it('handles single character tokens', () => {
      const schema = new TokenSchema('x')
      expect(schema.safeParse('x').success).toBe(true)
      expect(schema.safeParse('X').success).toBe(false)
      expect(schema.safeParse('').success).toBe(false)
    })

    it('rejects symbols', () => {
      const schema = new TokenSchema('mytoken')
      const result = schema.safeParse(Symbol('mytoken'))
      expect(result.success).toBe(false)
    })

    it('rejects functions', () => {
      const schema = new TokenSchema('mytoken')
      const result = schema.safeParse(() => 'mytoken')
      expect(result.success).toBe(false)
    })

    it('rejects dates', () => {
      const schema = new TokenSchema('mytoken')
      const result = schema.safeParse(new Date())
      expect(result.success).toBe(false)
    })

    it('rejects regular expressions', () => {
      const schema = new TokenSchema('mytoken')
      const result = schema.safeParse(/mytoken/)
      expect(result.success).toBe(false)
    })
  })

  describe('comparison with similar schemas', () => {
    it('behaves like a string literal validator', () => {
      const schema = new TokenSchema('literal')

      // Should only accept the exact string
      expect(schema.safeParse('literal').success).toBe(true)
      expect(schema.safeParse('other').success).toBe(false)
      expect(schema.safeParse('').success).toBe(false)
    })

    it('differs from enum by accepting only one value', () => {
      const schema = new TokenSchema('option1')

      // Only accepts the single token value
      expect(schema.safeParse('option1').success).toBe(true)
      expect(schema.safeParse('option2').success).toBe(false)
    })

    it('differs from string schema by accepting only specific value', () => {
      const schema = new TokenSchema('specific')

      // Only accepts the exact token
      expect(schema.safeParse('specific').success).toBe(true)
      expect(schema.safeParse('any other string').success).toBe(false)
    })
  })
})
