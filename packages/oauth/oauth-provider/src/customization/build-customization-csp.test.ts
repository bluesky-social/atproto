import { describe, expect, it } from 'vitest'
import { mergeCsp } from '../lib/csp/index.js'
import { buildCustomizationCsp } from './build-customization-csp.js'
import type { Customization } from './customization.ts'

describe(buildCustomizationCsp, () => {
  it('returns undefined when nothing relevant is configured', () => {
    expect(buildCsp({})).toEqual({})
    expect(buildCsp({ branding: {} })).toEqual({})
    expect(buildCsp({ branding: { name: 'PDS' } })).toEqual({})
  })

  describe('branding images', () => {
    it('allow-lists http(s) images by their exact origin', () => {
      const csp = buildCsp({
        branding: { logo: 'https://example.com/logo.png' },
      })
      expect(csp).toEqual({
        'img-src': ['https://example.com/logo.png'],
      })

      const httpCsp = buildCsp({
        branding: { logo: 'http://localhost:1234/logo.png' },
      })
      expect(httpCsp).toEqual({
        'img-src': ['http://localhost:1234/logo.png'],
      })
    })

    it('allow-lists the `data:` scheme (not a hash) for data uri images', () => {
      // CSP hash sources do not authorize image fetches, so a `data:` image can
      // only be allowed via the `data:` scheme source.
      const csp = buildCsp({
        branding: { logo: 'data:image/png;base64,AAAA' },
      })
      expect(csp).toEqual({ 'img-src': ['data:'] })
    })

    it('emits `data:` only once regardless of how many data uris are used', () => {
      const csp = buildCsp({
        branding: {
          logo: 'data:image/png;base64,AAAA',
          background: {
            light: 'data:image/svg+xml,<svg/>',
            dark: 'data:image/png;base64,BBBB',
          },
        },
      })
      expect(csp).toEqual({ 'img-src': ['data:'] })
    })

    it('combines exact origins and the `data:` scheme when both are used', () => {
      const csp = buildCsp({
        branding: {
          logo: 'https://example.com/logo.png',
          background: { light: 'data:image/png;base64,AAAA' },
        },
      })
      expect(csp).toEqual({
        'img-src': ['https://example.com/logo.png', 'data:'],
      })
    })

    it('throws on unsupported uri schemes', () => {
      expect(() =>
        // @ts-expect-error Unsupported URI scheme
        buildCsp({ branding: { logo: 'ftp://example.com/x' } }),
      ).toThrow('Unsupported URI format')
    })

    it('combines exact origins and the `data:` scheme for multiple image sources', () => {
      const csp = buildCsp({
        branding: {
          logo: 'http://localhost:1234/logo.png',
          background: {
            dark: 'data:image/png;base64,BBBB',
            light: 'https://example.com/background.png',
          },
        },
      })
      expect(csp).toEqual({
        'img-src': [
          'http://localhost:1234/logo.png',
          'data:',
          'https://example.com/background.png',
        ],
      })
    })
  })

  describe('hCaptcha', () => {
    it('adds the hCaptcha sources when configured', () => {
      const csp = buildCsp({
        hcaptcha: { siteKey: 'site', secretKey: 'secret', tokenSalt: 'salt' },
      })
      expect(csp).toEqual({
        'connect-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
        'frame-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
        'script-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
        'style-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
      })
    })

    it('combines with branding images', () => {
      const csp = buildCsp({
        hcaptcha: { siteKey: 'site', secretKey: 'secret', tokenSalt: 'salt' },
        branding: { logo: 'data:image/png;base64,AAAA' },
      })
      expect(csp).toEqual({
        'img-src': ['data:'],
        'connect-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
        'frame-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
        'script-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
        'style-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
      })
    })
  })
})

function buildCsp(customization: Customization) {
  return mergeCsp({}, ...buildCustomizationCsp(customization))
}
