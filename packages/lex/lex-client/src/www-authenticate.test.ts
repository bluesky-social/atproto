import { describe, expect, it } from 'vitest'
import { parseWWWAuthenticateHeader } from './www-authenticate.js'

describe(parseWWWAuthenticateHeader, () => {
  describe('auth-params', () => {
    it('parses single unquoted auth param', () => {
      expect(parseWWWAuthenticateHeader('Bearer realm=example.com')).toEqual({
        Bearer: { realm: 'example.com' },
      })
    })

    it('parses single quoted auth param', () => {
      expect(parseWWWAuthenticateHeader('Bearer realm="example.com"')).toEqual({
        Bearer: { realm: 'example.com' },
      })
    })

    it('parses quoted values with spaces', () => {
      expect(parseWWWAuthenticateHeader('Bearer realm="my realm"')).toEqual({
        Bearer: { realm: 'my realm' },
      })
    })

    it('parses quoted values with escaped double quotes', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer realm="example\\"quoted\\""'),
      ).toEqual({
        Bearer: { realm: 'example"quoted"' },
      })
    })

    it('parses quoted values with escaped backslash', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer realm="path\\\\to\\\\file"'),
      ).toEqual({
        Bearer: { realm: 'path\\to\\file' },
      })
    })

    it('parses param names with hyphens', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer error-uri="https://example.com"'),
      ).toEqual({
        Bearer: { 'error-uri': 'https://example.com' },
      })
    })

    it('parses param names with underscores', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer error_description="test"'),
      ).toEqual({
        Bearer: { error_description: 'test' },
      })
    })

    it('parses param with numeric value', () => {
      expect(parseWWWAuthenticateHeader('Bearer max-age=3600')).toEqual({
        Bearer: { 'max-age': '3600' },
      })
    })

    it('parses empty quoted value', () => {
      expect(parseWWWAuthenticateHeader('Bearer realm=""')).toEqual({
        Bearer: { realm: '' },
      })
    })

    it('parses Basic auth challenge', () => {
      expect(
        parseWWWAuthenticateHeader('Basic realm="Access to staging site"'),
      ).toEqual({
        Basic: { realm: 'Access to staging site' },
      })
    })

    it('parses Bearer with realm', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer realm="https://auth.example.com"'),
      ).toEqual({
        Bearer: { realm: 'https://auth.example.com' },
      })
    })

    it('parses DPoP with algs param', () => {
      expect(parseWWWAuthenticateHeader('DPoP algs="ES256 RS256"')).toEqual({
        DPoP: { algs: 'ES256 RS256' },
      })
    })

    it('parses Digest auth challenge', () => {
      const result = parseWWWAuthenticateHeader(
        'Digest realm="digest-realm", nonce="abc123"',
      )
      expect(result).toEqual({
        Digest: { realm: 'digest-realm', nonce: 'abc123' },
      })
    })

    it('handle empty unquoted params', () => {
      const result = parseWWWAuthenticateHeader('Bearer realm=')
      expect(result).toEqual({ Bearer: { realm: '' } })
    })

    it('handle empty params', () => {
      const result = parseWWWAuthenticateHeader('Bearer realm=""')
      expect(result).toEqual({ Bearer: { realm: '' } })
    })

    it('treats scheme-only header as scheme with itself as token68', () => {
      const result = parseWWWAuthenticateHeader('Basic')
      expect(result).toEqual({ Basic: {} })
    })

    it('parses multiple challenges with commas and escaped quotes', () => {
      const result = parseWWWAuthenticateHeader(
        `Newauth realm="apps", type=1,\n\t    title="Login to \\"apps\\"", Basic realm="simple"`,
      )
      expect(result).toEqual({
        Newauth: {
          realm: 'apps',
          type: '1',
          title: 'Login to "apps"',
        },
        Basic: { realm: 'simple' },
      })
    })

    it('parses first challenge before comma', () => {
      const result = parseWWWAuthenticateHeader(
        'Basic realm="foo", Bearer realm="bar"',
      )
      expect(result).toEqual({
        Basic: { realm: 'foo' },
        Bearer: { realm: 'bar' },
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(parseWWWAuthenticateHeader('')).toEqual({})
    })

    it('handles whitespace-only string', () => {
      expect(parseWWWAuthenticateHeader('   ')).toEqual({})
    })

    it('trims whitespace from header', () => {
      expect(parseWWWAuthenticateHeader('  Bearer realm="test"  ')).toEqual({
        Bearer: { realm: 'test' },
      })
    })

    it('handles commas as quoted param value', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer realm="example, with, commas"'),
      ).toEqual({ Bearer: { realm: 'example, with, commas' } })
    })

    it('handles multiple challenges with varying whitespace', () => {
      expect(
        parseWWWAuthenticateHeader(
          '  Bearer realm="test"  ,    Basic    rr=               ',
        ),
      ).toEqual({
        Bearer: { realm: 'test' },
        Basic: { rr: '' },
      })
    })
  })

  describe('invalid challenges', () => {
    it('parses single challenge with no comma correctly', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer realm="oauth" error="invalid"'),
      ).toEqual(undefined)
    })

    it('ignores invalid challenges', () => {
      expect(parseWWWAuthenticateHeader('Bearer realm="unclosed')).toEqual(
        undefined,
      )
    })

    it('handles random text without equals sign as token68', () => {
      expect(parseWWWAuthenticateHeader('Bearer sometoken')).toEqual({
        Bearer: 'sometoken',
      })
    })

    it('ignores trailing whitespace after scheme', () => {
      expect(parseWWWAuthenticateHeader('Bearer   ')).toEqual({ Bearer: {} })
    })

    it('handles duplicate params (last wins)', () => {
      expect(
        parseWWWAuthenticateHeader('Bearer realm="first", realm="second"'),
      ).toEqual({ Bearer: { realm: 'second' } })
    })

    it('extracts valid param after invalid characters', () => {
      expect(parseWWWAuthenticateHeader('Bearer realm@foo="bar"')).toEqual({
        Bearer: { 'realm@foo': 'bar' },
      })
    })

    it('ignores param with empty name', () => {
      expect(parseWWWAuthenticateHeader('Bearer ="value"')).toEqual(undefined)
    })

    it('handles completely malformed input gracefully', () => {
      expect(parseWWWAuthenticateHeader('!@#$%')).toEqual({ '!@#$%': {} })
    })

    it('handles duplicate schemes as invalid', () => {
      expect(
        parseWWWAuthenticateHeader('Basic realm="first", Basic realm="second"'),
      ).toEqual(undefined)
    })

    it('handles params without scheme as invalid', () => {
      expect(parseWWWAuthenticateHeader('Bearer, realm="foo"')).toEqual(
        undefined,
      )
    })
  })
})
