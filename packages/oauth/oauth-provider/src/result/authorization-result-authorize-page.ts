import type { LexiconPermissionSet } from '@atproto/lex-document'
import type { Session } from '@atproto/oauth-provider-api'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { Client } from '../client/client.js'
import type { RequestUri } from '../request/request-uri.js'

export type AuthorizationResultAuthorizePage = {
  issuer: string
  client: Client
  parameters: OAuthAuthorizationRequestParameters
  permissionSets: Map<string, LexiconPermissionSet>

  requestUri: RequestUri
  sessions: readonly Session[]
}
