import { ClientMetadata, Session } from './types'

// This is injected by the backend in the HTML template
declare const __backendData: {
  clientId: string
  clientMetadata: ClientMetadata
  requestUri: string
  csrfCookie: string
  sessions: readonly Session[]
  consentRequired: boolean
  loginHint?: string
}

export const backendData = __backendData

export type BackendData = typeof __backendData
