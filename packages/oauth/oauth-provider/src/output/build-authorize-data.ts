import type { AuthorizeData, Session } from '@atproto/oauth-provider-api'
import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { RequestUri } from '../request/request-uri.js'

export type ScopeDetail = {
  scope: string
  description?: string
}

export type AuthorizationResultAuthorize = {
  issuer: string
  client: Client
  parameters: OAuthAuthorizationRequestParameters
  authorize: {
    uri: RequestUri
    scopeDetails?: ScopeDetail[]
    sessions: readonly Session[]
  }
}

export type { AuthorizeData, Session }

export function buildAuthorizeData(
  data: AuthorizationResultAuthorize,
): AuthorizeData {
  return {
    clientId: data.client.id,
    clientMetadata: data.client.metadata,
    clientTrusted: data.client.info.isTrusted,
    requestUri: data.authorize.uri,
    loginHint: data.parameters.login_hint,
    scopeDetails: data.authorize.scopeDetails,
    sessions: data.authorize.sessions.map(
      (session): Session => ({
        account: session.account,
        selected: session.selected,
        loginRequired: session.loginRequired,
        consentRequired: session.consentRequired,
      }),
    ),
  }
}
