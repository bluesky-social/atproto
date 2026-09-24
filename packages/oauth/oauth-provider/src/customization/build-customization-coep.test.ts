import { describe, expect, it } from 'vitest'
import { buildCustomizationCoep } from './build-customization-coep.js'

describe(buildCustomizationCoep, () => {
  it('returns undefined when hCaptcha is not configured', () => {
    expect(buildCustomizationCoep({})).toBeUndefined()
    expect(
      buildCustomizationCoep({ branding: { name: 'PDS' } }),
    ).toBeUndefined()
  })

  it('specifies COEP when hCaptcha is configured', () => {
    expect(
      buildCustomizationCoep({
        hcaptcha: {
          siteKey: 'site',
          secretKey: 'secret',
          tokenSalt: 'salt',
        },
      }),
    ).toBeDefined()
  })
})
