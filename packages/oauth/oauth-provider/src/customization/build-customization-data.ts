import { CustomizationData } from '@atproto/oauth-provider-api'
import { Customization } from './customization.js'

export function buildCustomizationData({
  branding,
  availableUserDomains,
  inviteCodeRequired,
  hcaptcha,
}: Customization): CustomizationData {
  // @NOTE the front end does not need colors here as they will be injected as
  // CSS variables.
  // @NOTE We only copy the values explicitly needed to avoid leaking sensitive
  // data (in case the caller passed more than what we expect).
  return {
    availableUserDomains,
    inviteCodeRequired,
    hcaptchaSiteKey: hcaptcha?.siteKey,
    name: branding?.name,
    logo: branding?.logo,
    links: branding?.links,
  }
}
