import type { OAuthClientMetadata } from '@atproto/oauth-types'
import type { LinkDefinition, ScopeDetail, Session } from './types.js'

// These are the types of the variables that are injected into the HTML by the
// backend. They are used to configure the frontend.

export type AvailableLocales = readonly string[]

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

export type ErrorData = {
  error: string
  error_description: string
}

export type AuthorizeData = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  requestUri: string
  loginHint?: string
  scopeDetails?: ScopeDetail[]
  newSessionsRequireConsent: boolean
  sessions: Session[]
}
