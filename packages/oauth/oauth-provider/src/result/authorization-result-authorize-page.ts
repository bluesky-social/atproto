import type { LexiconPermissionSet, LexiconSpace } from '@atproto/lex-document'
import type { Account, Session } from '@atproto/oauth-provider-api'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { Client } from '../client/client.js'
import type { RequestUri } from '../request/request-uri.js'

export type AuthorizationResultAuthorizePage = {
  issuer: string
  client: Client
  parameters: OAuthAuthorizationRequestParameters
  permissionSets: Map<string, LexiconPermissionSet>
  spaces: Map<string, LexiconSpace>
  /** Verified handles keyed by community-owner DID, for `space:` scopes. */
  communityHandles: Map<string, string>

  requestUri: RequestUri
  sessions: readonly Session[]
  selectedDid?: Account['did']
}
