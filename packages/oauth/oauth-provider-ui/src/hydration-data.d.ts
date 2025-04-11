import type {
  CustomizationData,
  ScopeDetail,
  Session,
} from '@atproto/oauth-provider-api'
import type { OAuthClientMetadata } from '@atproto/oauth-types'

export type AuthorizeData = {
  requestUri: string

  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean

  scopeDetails?: ScopeDetail[]

  loginHint?: string
  uiLocales?: string
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
  'error-page': {
    /**
     * Matches the variables needed by `error-page.tsx`
     */
    __customizationData: CustomizationData
    __errorData: ErrorData
  }
}
