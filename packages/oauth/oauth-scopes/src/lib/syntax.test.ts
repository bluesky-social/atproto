import { isScopeStringFor } from './syntax.js'

describe('isScopeStringFor', () => {
  describe('exact match', () => {
    it('should return true for exact match', () => {
      expect(isScopeStringFor('prefix', 'prefix')).toBe(true)
    })

    it('should return false for different prefix', () => {
      expect(isScopeStringFor('prefix', 'differentResource')).toBe(false)
    })
  })

  describe('with positional parameter', () => {
    it('should return true for exact match with positional parameter', () => {
      expect(isScopeStringFor('prefix:positional', 'prefix')).toBe(true)
    })

    it('should return false for different prefix with positional parameter', () => {
      expect(isScopeStringFor('differentResource:positional', 'prefix')).toBe(
        false,
      )
    })
  })

  describe('with named parameters', () => {
    it('should return true for exact match with named parameters', () => {
      expect(isScopeStringFor('prefix?param=value', 'prefix')).toBe(true)
    })

    it('should return false for different prefix with named parameters', () => {
      expect(isScopeStringFor('prefix', 'prefi')).toBe(false)
      expect(isScopeStringFor('prefix:pos', 'prefi')).toBe(false)
      expect(isScopeStringFor('prefix?param=value', 'prefi')).toBe(false)
      expect(isScopeStringFor('prefix', 'fix')).toBe(false)
      expect(isScopeStringFor('prefix:pos', 'fix')).toBe(false)
      expect(isScopeStringFor('prefix?param=value', 'fix')).toBe(false)
      expect(isScopeStringFor('differentResource?param=value', 'prefix')).toBe(
        false,
      )
    })
  })
})
