import { Jwks } from '@atproto/jwk'
import {
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  OAuthClientMetadata,
  OAuthTokenResponse,
} from '@atproto/oauth-types'

import { Account } from './account/account.js'
import { ClientAuth } from './client/client-auth.js'
import { ClientId } from './client/client-id.js'
import { ClientInfo } from './client/client-info.js'
import { Client } from './client/client.js'
import { InvalidAuthorizationDetailsError } from './errors/invalid-authorization-details-error.js'
import { Awaitable } from './lib/util/type.js'

// Make sure all types needed to implement the OAuthHooks are exported
export type {
  Account,
  Client,
  ClientAuth,
  ClientId,
  ClientInfo,
  InvalidAuthorizationDetailsError,
  Jwks,
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  OAuthClientMetadata,
  OAuthTokenResponse,
}

export type OAuthHooks = {
  /**
   * Use this to alter, override or validate the client metadata & jwks returned
   * by the client store.
   *
   * @throws {InvalidClientMetadataError} if the metadata is invalid
   * @see {@link InvalidClientMetadataError}
   */
  onClientInfo?: (
    clientId: ClientId,
    data: { metadata: OAuthClientMetadata; jwks?: Jwks },
  ) => Awaitable<void | undefined | Partial<ClientInfo>>

  /**
   * Allows enriching the authorization details with additional information
   * when the tokens are issued.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9396 | RFC 9396}
   */
  onAuthorizationDetails?: (data: {
    client: Client
    parameters: OAuthAuthorizationRequestParameters
    account: Account
  }) => Awaitable<undefined | OAuthAuthorizationDetails>
}
