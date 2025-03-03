import type { OAuthClientMetadata } from '@atproto/oauth-types'

// TODO: Find a way to share these types with the backend code

export type Account = {
  sub: string
  aud: string

  email?: string
  name?: string
  preferred_username?: string
  picture?: string
}

export type Session = {
  account: Account
  info?: never // Prevent relying on this in the frontend

  selected: boolean
  loginRequired: boolean
  consentRequired: boolean
}

export type LinkDefinition = {
  title: string
  href: string
  rel?: string
}

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

export type ScopeDetail = {
  scope: string
  description?: string
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
