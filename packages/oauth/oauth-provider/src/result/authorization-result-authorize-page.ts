import type { LexiconPermissionSet } from '@atproto/lex-document'
import type { Account, Session } from '@atproto/oauth-provider-api'
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
  selectedDid?: Account['did']

  /**
   * User-facing value of the `login_hint` parameter. Same as
   * `parameters.login_hint`, except that a DID hint is resolved to the
   * account's handle when the account is known to this server.
   */
  loginHint?: string
}
