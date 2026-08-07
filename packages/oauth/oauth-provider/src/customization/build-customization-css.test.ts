import { describe, expect, it } from 'vitest'
import { buildCustomizationCss } from './build-customization-css.js'

describe('buildCustomizationCss', () => {
  it('returns undefined when nothing is configured', () => {
    expect(buildCustomizationCss({})).toBeUndefined()
    expect(buildCustomizationCss({ branding: {} })).toBeUndefined()
    expect(buildCustomizationCss({ branding: { name: 'PDS' } })).toBeUndefined()
  })

  describe('background', () => {
    it('emits a per-mode image wrapped in url()', () => {
      const css = buildCustomizationCss({
        branding: {
          background: {
            light: 'https://example.com/light.png',
            dark: 'https://example.com/dark.png',
          },
        },
      })

      expect(css).toContain(
        '--branding-background-light-image: url("https://example.com/light.png");',
      )
      expect(css).toContain(
        '--branding-background-dark-image: url("https://example.com/dark.png");',
      )
    })

    it('escapes quotes and backslashes in the image url', () => {
      const css = buildCustomizationCss({
        branding: {
          background: { light: 'https://example.com/a"b\\c.png' },
        },
      })

      expect(css).toContain(
        '--branding-background-light-image: url("https://example.com/a\\"b\\\\c.png");',
      )
    })

    it('omits modes that are not configured', () => {
      const css = buildCustomizationCss({
        branding: {
          background: { light: 'https://example.com/light.png' },
        },
      })

      expect(css).toContain('--branding-background-light-image:')
      expect(css).not.toContain('--branding-background-dark-image:')
    })

    it('can be configured on its own, without brand colours', () => {
      const css = buildCustomizationCss({
        branding: { background: { light: 'https://example.com/light.png' } },
      })

      expect(css).toMatch(/^:root \{.*\}$/s)
      expect(css).not.toContain('--branding-color-')
    })
  })
})
