import type { LexiconPermissionSet, LexiconSpace } from '@atproto/lex-document'
import type { Account, DidString, Session } from '@atproto/oauth-provider-api'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import type { HandleString } from '@atproto/syntax'
import type { Client } from '../client/client.js'
import type { RequestUri } from '../request/request-uri.js'

export type AuthorizationResultAuthorizePage = {
  issuer: string
  client: Client
  parameters: OAuthAuthorizationRequestParameters
  permissionSets: Map<string, LexiconPermissionSet>
  spaces: Map<string, LexiconSpace>
  /** Verified handles keyed by space-authority DID, for `space:` scopes. */
  spaceHandles: Map<DidString, HandleString>

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
