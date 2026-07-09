import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { AuthorizationRedirectParameters } from './authorization-redirect-parameters.js'

export type AuthorizationResultRedirect = {
  issuer: string
  parameters: OAuthAuthorizationRequestParameters
  redirect: AuthorizationRedirectParameters
}
