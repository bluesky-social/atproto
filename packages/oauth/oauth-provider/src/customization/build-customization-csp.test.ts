import { describe, expect, it } from 'vitest'
import type { CspConfig, CspValue } from '../lib/csp/index.js'
import { buildCustomizationCsp } from './build-customization-csp.js'

describe(buildCustomizationCsp, () => {
  it('returns undefined when nothing relevant is configured', () => {
    expect(buildCustomizationCsp({})).toBeUndefined()
    expect(buildCustomizationCsp({ branding: {} })).toBeUndefined()
    expect(buildCustomizationCsp({ branding: { name: 'PDS' } })).toBeUndefined()
  })

  describe('branding images', () => {
    it('allow-lists http(s) images by their exact origin', () => {
      const csp = buildCustomizationCsp({
        branding: { logo: 'https://example.com/logo.png' },
      })
      expect(extractImgSrc(csp)).toEqual(['https://example.com/logo.png'])

      const httpCsp = buildCustomizationCsp({
        branding: { logo: 'http://localhost:1234/logo.png' },
      })
      expect(extractImgSrc(httpCsp)).toEqual(['http://localhost:1234/logo.png'])
    })

    it('allow-lists the `data:` scheme (not a hash) for data uri images', () => {
      // CSP hash sources do not authorize image fetches, so a `data:` image can
      // only be allowed via the `data:` scheme source.
      const csp = buildCustomizationCsp({
        branding: { logo: 'data:image/png;base64,AAAA' },
      })
      expect(extractImgSrc(csp)).toEqual(['data:'])
    })

    it('emits `data:` only once regardless of how many data uris are used', () => {
      const csp = buildCustomizationCsp({
        branding: {
          logo: 'data:image/png;base64,AAAA',
          background: {
            light: 'data:image/svg+xml,<svg/>',
            dark: 'data:image/png;base64,BBBB',
          },
        },
      })
      expect(extractImgSrc(csp)).toEqual(['data:'])
    })

    it('combines exact origins and the `data:` scheme when both are used', () => {
      const csp = buildCustomizationCsp({
        branding: {
          logo: 'https://example.com/logo.png',
          background: { light: 'data:image/png;base64,AAAA' },
        },
      })
      expect(extractImgSrc(csp)).toEqual(
        expect.arrayContaining(['https://example.com/logo.png', 'data:']),
      )
      expect(extractImgSrc(csp)).toHaveLength(2)
    })

    it('throws on unsupported uri schemes', () => {
      expect(() =>
        buildCustomizationCsp({ branding: { logo: 'ftp://example.com/x' } }),
      ).toThrow('Unsupported URI format')
    })

    it('combines exact origins and the `data:` scheme for multiple image sources', () => {
      const csp = buildCustomizationCsp({
        branding: {
          logo: 'http://localhost:1234/logo.png',
          background: {
            dark: 'data:image/png;base64,BBBB',
            light: 'https://example.com/background.png',
          },
        },
      })
      expect(extractImgSrc(csp)).toEqual([
        'http://localhost:1234/logo.png',
        'data:',
        'https://example.com/background.png',
      ])
    })
  })

  describe('hCaptcha', () => {
    it('adds the hCaptcha sources when configured', () => {
      const csp = buildCustomizationCsp({
        hcaptcha: { siteKey: 'site', secretKey: 'secret', tokenSalt: 'salt' },
      })
      expect(csp?.['script-src']).toContain('https://hcaptcha.com')
      expect(csp?.['frame-src']).toContain('https://*.hcaptcha.com')
      expect(csp?.['style-src']).toContain('https://hcaptcha.com')
      expect(csp?.['connect-src']).toContain('https://*.hcaptcha.com')
      expect(extractImgSrc(csp)).toEqual([])
    })

    it('combines with branding images', () => {
      const csp = buildCustomizationCsp({
        hcaptcha: { siteKey: 'site', secretKey: 'secret', tokenSalt: 'salt' },
        branding: { logo: 'data:image/png;base64,AAAA' },
      })
      expect(extractImgSrc(csp)).toEqual(['data:'])
      expect(csp?.['script-src']).toContain('https://hcaptcha.com')
    })
  })
})

function extractImgSrc(csp: CspConfig | undefined): CspValue[] {
  return [...(csp?.['img-src'] ?? [])]
}
