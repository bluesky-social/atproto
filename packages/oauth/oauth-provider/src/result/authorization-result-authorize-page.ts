import type { Session } from '@atproto/oauth-provider-api'
import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { PermissionSet } from '../permission-set/permission-set.js'
import { RequestUri } from '../request/request-uri.js'

export type AuthorizationResultAuthorizePage = {
  issuer: string
  client: Client
  parameters: OAuthAuthorizationRequestParameters
  permissionSets: Record<string, PermissionSet>

  requestUri: RequestUri
  sessions: readonly Session[]
}
