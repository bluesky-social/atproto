import type { CustomizationData, Session } from '@atproto/oauth-provider-api'
import type { LexiconPermissionSet } from '@atproto/oauth-scopes'
import type { OAuthClientMetadata, OAuthPromptMode } from '@atproto/oauth-types'

export type PermissionSet = LexiconPermissionSet
export type PermissionSets = Record<string, undefined | PermissionSet>

export type AuthorizeData = {
  requestUri: string

  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  clientFirstParty: boolean

  scope?: string
  loginHint?: string
  uiLocales?: string
  promptMode?: OAuthPromptMode
  permissionSets: PermissionSets
}

export type ErrorData = {
  error: string
  error_description: string
}

export type HydrationData = {
  /**
   * Matches the variables needed by `authorization-page.tsx`
   */
  'authorization-page': {
    __customizationData: CustomizationData
    __authorizeData: AuthorizeData
    __sessions: readonly Session[]
  }
  /**
   * Matches the variables needed by `error-page.tsx`
   */
  'error-page': {
    __customizationData: CustomizationData
    __errorData: ErrorData
  }
  /**
   * Matches the variables needed by `cookie-error-page.tsx`
   */
  'cookie-error-page': {
    __customizationData: CustomizationData
    __continueUrl: string
  }
}
