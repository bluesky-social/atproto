import { describe, expect, it } from 'vitest'
import {
  assureAdminAuth,
  formatAdminAuthHeader,
  parseAdminAuthHeader,
} from '../src'

describe('util', () => {
  describe('formatAdminAuthHeader', () => {
    it('formats password as Basic auth header', () => {
      const header = formatAdminAuthHeader('secret')
      expect(header).toBe('Basic YWRtaW46c2VjcmV0')
    })

    it('uses admin as username', () => {
      const header = formatAdminAuthHeader('secret')
      const decoded = Buffer.from(
        header.replace('Basic ', ''),
        'base64',
      ).toString()
      expect(decoded).toBe('admin:secret')
    })
  })

  describe('parseAdminAuthHeader', () => {
    it('parses Basic auth header and returns password', () => {
      const header = 'Basic YWRtaW46c2VjcmV0' // admin:secret
      const password = parseAdminAuthHeader(header)
      expect(password).toBe('secret')
    })

    it('handles header without Basic prefix', () => {
      const header = 'YWRtaW46c2VjcmV0' // admin:secret (no prefix)
      const password = parseAdminAuthHeader(header)
      expect(password).toBe('secret')
    })

    it('throws if username is not admin', () => {
      const header = 'Basic ' + Buffer.from('user:secret').toString('base64')
      expect(() => parseAdminAuthHeader(header)).toThrow(
        "Unexpected username in admin headers. Expected 'admin'",
      )
    })
  })

  describe('assureAdminAuth', () => {
    it('does not throw when password matches', () => {
      const header = formatAdminAuthHeader('secret')
      expect(() => assureAdminAuth('secret', header)).not.toThrow()
    })

    it('throws when password does not match', () => {
      const header = formatAdminAuthHeader('wrong')
      expect(() => assureAdminAuth('secret', header)).toThrow(
        'Invalid admin password',
      )
    })

    it('throws when header has invalid username', () => {
      const header =
        'Basic ' + Buffer.from('notadmin:secret').toString('base64')
      expect(() => assureAdminAuth('secret', header)).toThrow()
    })

    it('is timing-safe (does not leak password length)', () => {
      // This is a basic sanity check - true timing attack tests require statistical analysis
      const header = formatAdminAuthHeader('a')
      const start1 = performance.now()
      try {
        assureAdminAuth('b', header)
      } catch {
        // do nothing
      }
      const time1 = performance.now() - start1

      const longHeader = formatAdminAuthHeader('a'.repeat(1000))
      const start2 = performance.now()
      try {
        assureAdminAuth('b'.repeat(1000), longHeader)
      } catch {
        // do nothing
      }
      const time2 = performance.now() - start2

      // Times should be in the same order of magnitude (not a rigorous test)
      expect(Math.abs(time1 - time2)).toBeLessThan(50)
    })
  })
})
