import type { ClientMetadata, Session } from './types'

// This is injected by the backend in the HTML template
declare const __backendData:
  | Readonly<{
      clientId: string
      clientMetadata: Readonly<ClientMetadata>
      requestUri: string
      csrfCookie: string
      sessions: readonly Readonly<Session>[]
      consentRequired: boolean
      loginHint?: string
    }>
  | Readonly<{
      error: string
      error_description: string
    }>

export const backendData = __backendData

export type BackendData = typeof __backendData
