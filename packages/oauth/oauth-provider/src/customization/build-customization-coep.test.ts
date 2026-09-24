import { describe, expect, it } from 'vitest'
import { buildCustomizationCoep } from './build-customization-coep.js'

const hcaptcha = { siteKey: 'site', secretKey: 'secret', tokenSalt: 'salt' }

describe(buildCustomizationCoep, () => {
  it('returns undefined when hCaptcha is not configured', () => {
    expect(buildCustomizationCoep({})).toBeUndefined()
    expect(
      buildCustomizationCoep({ branding: { name: 'PDS' } }),
    ).toBeUndefined()
  })

  it('disables COEP when hCaptcha is configured (its COEP support is broken)', () => {
    expect(buildCustomizationCoep({ hcaptcha })).toBeDefined()
  })
})
