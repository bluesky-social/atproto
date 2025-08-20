import type { LexPermissionSet } from '@atproto/lexicon'
import type { Session } from '@atproto/oauth-provider-api'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { Client } from '../client/client.js'
import type { RequestUri } from '../request/request-uri.js'

export type AuthorizationResultAuthorizePage = {
  issuer: string
  client: Client
  parameters: OAuthAuthorizationRequestParameters
  permissionSets: Map<string, LexPermissionSet>

  requestUri: RequestUri
  sessions: readonly Session[]
}
