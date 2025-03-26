import type { ScopeDetail, Session } from '@atproto/oauth-provider-api'
import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { RequestUri } from '../request/request-uri.js'

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
