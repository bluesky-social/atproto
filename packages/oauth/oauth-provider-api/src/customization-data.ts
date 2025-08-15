import type { LinkDefinition } from './types.js'

// These are the types of the variables that are injected into the HTML by the
// backend. They are used to configure the frontend.

export type CustomizationData = {
  // Functional customization
  hcaptchaSiteKey?: string
  inviteCodeRequired?: boolean
  availableUserDomains?: string[]

  // Aesthetic customization
  name?: string
  logo?: string
  links?: LinkDefinition[]
}
