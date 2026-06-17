import { describe, expect, it } from 'vitest'
import { token } from './token.js'

describe('TokenSchema', () => {
  describe('basic validation', () => {
    const schema = token('my.to.ken')

    it('validates exact token match', () => {
      expect(schema.safeParse('my.to.ken')).toMatchObject({
        success: true,
        value: 'my.to.ken',
      })
    })

    it('rejects different strings', () => {
      const result = schema.safeParse('other.to.ken')
      expect(result.success).toBe(false)
    })

    it('rejects similar strings with different case', () => {
      const result = schema.safeParse('My.To.Ken')
      expect(result.success).toBe(false)
    })

    it('rejects partial matches', () => {
      const result = schema.safeParse('my.to')
      expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('rejects symbols', () => {
      const result = schema.safeParse(Symbol.for(schema.toString()))
      expect(result.success).toBe(false)
    })

    it('rejects functions', () => {
      const result = schema.safeParse(() => schema)
      expect(result.success).toBe(false)
    })

    it('rejects dates', () => {
      const result = schema.safeParse(new Date())
      expect(result.success).toBe(false)
    })

    it('rejects regular expressions', () => {
      const result = schema.safeParse(/mytoken/)
      expect(result.success).toBe(false)
    })
  })

  describe('TokenSchema instance validation', () => {
    const schema = token('my.to.ken')

    it('accepts TokenSchema instance with same value', () => {
      const otherInstance = token('my.to.ken')
      const result = schema.safeParse(otherInstance)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('my.to.ken')
      }
    })

    it('rejects TokenSchema instance with different value', () => {
      const otherInstance = token('other.to.ken')
      const result = schema.safeParse(otherInstance)
      expect(result.success).toBe(false)
    })

    it('accepts itself as input', () => {
      expect(schema.safeParse(schema)).toMatchObject({
        success: true,
        value: 'my.to.ken',
      })
    })
  })

  describe('type validation', () => {
    const schema = token('my.to.ken')

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

  describe('serialization methods', () => {
    const schema = token('my.to.ken', 'foo')

    it('toJSON returns the token value', () => {
      expect(schema.toJSON()).toBe('my.to.ken#foo')
    })

    it('toString returns the token value', () => {
      expect(schema.toString()).toBe('my.to.ken#foo')
    })

    it('toJSON and toString return the same value', () => {
      expect(schema.toJSON()).toBe(schema.toString())
    })

    it('serializes to primitive string in JSON', () => {
      expect(JSON.stringify({ token: schema })).toBe(
        '{"token":"my.to.ken#foo"}',
      )
    })
  })

  describe('value property', () => {
    const schema = token('my.to.ken')

    it('exposes the token value through serialization', () => {
      // value is protected, so we verify it through toString/toJSON
      expect(schema.toString()).toBe('my.to.ken')
      expect(schema.toJSON()).toBe('my.to.ken')
    })
  })
})
