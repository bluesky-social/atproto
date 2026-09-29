import { describe, expect, it } from 'vitest'
import { type CspConfig, buildCsp, mergeCsp } from './index.js'

describe(mergeCsp, () => {
  it('unions array directives across configs', () => {
    const merged = mergeCsp(
      { 'script-src': ["'self'"] },
      { 'script-src': ['https://cdn.example.com'] },
    )
    expect(merged['script-src']).toEqual(["'self'", 'https://cdn.example.com'])
  })

  it('ignores null/undefined configs', () => {
    expect(mergeCsp(undefined, { 'img-src': ['data:'] }, null)).toEqual({
      'img-src': ['data:'],
    })
  })

  describe('scheme-source deduplication', () => {
    it('drops exact https:// values when the `https:` scheme is present', () => {
      const merged = mergeCsp(
        { 'img-src': ['https:'] },
        { 'img-src': ['https://example.com/logo.png'] },
      )
      expect(merged['img-src']).toEqual(['https:'])
    })

    it('drops exact http:// values when the `http:` scheme is present', () => {
      const merged = mergeCsp(
        { 'img-src': ['http:'] },
        { 'img-src': ['http://localhost/logo.png'] },
      )
      expect(merged['img-src']).toEqual(['http:'])
    })

    it('keeps exact values when the matching scheme is absent', () => {
      const merged = mergeCsp(
        { 'img-src': ['https://a.example.com'] },
        { 'img-src': ['https://b.example.com'] },
      )
      expect(merged['img-src']).toEqual([
        'https://a.example.com',
        'https://b.example.com',
      ])
    })

    it('keeps distinct schemes side by side', () => {
      const merged = mergeCsp(
        { 'img-src': ['https:'] },
        { 'img-src': ['data:'] },
      )
      expect(merged['img-src']).toEqual(['https:', 'data:'])
    })
  })

  it("drops 'none' once other values are present", () => {
    const merged = mergeCsp(
      { 'img-src': ["'none'"] },
      { 'img-src': ["'self'"] },
    )
    expect(merged['img-src']).toEqual(["'self'"])
  })

  it('lets later boolean/string directives take precedence', () => {
    const configs: CspConfig[] = [
      { 'base-uri': "'none'", 'upgrade-insecure-requests': true },
      { 'base-uri': "'self'" },
    ]
    const merged = mergeCsp(...configs)
    expect(merged['base-uri']).toBe("'self'")
    expect(merged['upgrade-insecure-requests']).toBe(true)
  })
})

describe(buildCsp, () => {
  it('serializes directives in a stable order (booleans, strings, arrays)', () => {
    const policy = buildCsp({
      'default-src': ["'none'"],
      'img-src': ['https:', 'data:'],
      'upgrade-insecure-requests': true,
    })
    expect(policy).toBe(
      "upgrade-insecure-requests; default-src 'none'; img-src https: data:",
    )
  })

  it('deduplicates values within a directive', () => {
    const policy = buildCsp({ 'img-src': ['https:', 'https:', 'data:'] })
    expect(policy).toBe('img-src https: data:')
  })
})
