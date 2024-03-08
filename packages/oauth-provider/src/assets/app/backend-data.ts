import type { ClientMetadata, Session } from './types'

export type BrandingData = {
  logo?: string
}

export type ErrorData = {
  error: string
  error_description: string
}

export type AuthorizeData = {
  clientId: string
  clientMetadata: ClientMetadata
  requestUri: string
  csrfCookie: string
  sessions: Session[]
  consentRequired: boolean
  loginHint?: string
}

// These values are injected by the backend when it builds the
// page HTML.

export const brandingData = window['__brandingData'] as BrandingData | undefined
export const errorData = window['__errorData'] as ErrorData | undefined
export const authorizeData = window['__authorizeData'] as
  | AuthorizeData
  | undefined
