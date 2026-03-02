import { describe, expect, it } from 'vitest'
import { formatWWWAuthenticateHeader } from './www-authenticate.js'

describe(formatWWWAuthenticateHeader, () => {
  describe('single scheme with params object', () => {
    it('formats a Bearer challenge with params', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: { realm: 'api.example.com', error: 'InvalidToken' },
      })
      expect(result).toBe(
        'Bearer realm="api.example.com", error="InvalidToken"',
      )
    })

    it('omits undefined param values', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: { realm: 'api', error: undefined },
      })
      expect(result).toBe('Bearer realm="api"')
    })

    it('omits null param values', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: { realm: 'api', error: null as any },
      })
      expect(result).toBe('Bearer realm="api"')
    })

    it('outputs only the scheme when all params are undefined', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: {},
      })
      expect(result).toBe('Bearer')
    })
  })

  describe('single scheme with token68 string', () => {
    it('formats a token68 value', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: 'base64encodedvalue==',
      })
      expect(result).toBe('Bearer base64encodedvalue==')
    })
  })

  describe('multiple schemes', () => {
    it('joins multiple different schemes with a comma', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: { realm: 'api' },
        Basic: { realm: 'api' },
      })
      expect(result).toBe('Bearer realm="api", Basic realm="api"')
    })
  })

  describe('array of challenges for the same scheme (new feature)', () => {
    it('emits one challenge per array element', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: [
          { realm: 'first', error: 'TokenExpired' },
          { realm: 'second', error: 'TokenRevoked' },
        ],
      })
      expect(result).toBe(
        'Bearer realm="first", error="TokenExpired", Bearer realm="second", error="TokenRevoked"',
      )
    })

    it('handles an array mixing token68 strings and param objects', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: ['token68value', { realm: 'api', error: 'BadToken' }],
      })
      expect(result).toBe(
        'Bearer token68value, Bearer realm="api", error="BadToken"',
      )
    })

    it('handles an array of token68 strings', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: ['firstToken', 'secondToken'],
      })
      expect(result).toBe('Bearer firstToken, Bearer secondToken')
    })

    it('handles an array with a single element', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: [{ realm: 'api' }],
      })
      expect(result).toBe('Bearer realm="api"')
    })

    it('handles array challenges alongside other schemes', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: [
          { realm: 'r1', error: 'Err1' },
          { realm: 'r2', error: 'Err2' },
        ],
        Basic: { realm: 'fallback' },
      })
      expect(result).toBe(
        'Bearer realm="r1", error="Err1", Bearer realm="r2", error="Err2", Basic realm="fallback"',
      )
    })
  })

  describe('null / undefined scheme values', () => {
    it('skips schemes with null value', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: null as any,
        Basic: { realm: 'api' },
      })
      expect(result).toBe('Basic realm="api"')
    })

    it('skips schemes with undefined value', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: undefined,
        Basic: { realm: 'api' },
      })
      expect(result).toBe('Basic realm="api"')
    })

    it('returns an empty string when all schemes are null/undefined', () => {
      const result = formatWWWAuthenticateHeader({
        Bearer: undefined,
      })
      expect(result).toBe('')
    })
  })

  it('returns an empty string for an empty object', () => {
    expect(formatWWWAuthenticateHeader({})).toBe('')
  })
})
