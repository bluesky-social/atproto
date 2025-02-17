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
import { RequestMetadata } from './lib/http/request.js'
import { Awaitable } from './lib/util/type.js'
import { AccessDeniedError, OAuthError } from './oauth-errors.js'
import { DeviceId } from './oauth-store.js'

// Make sure all types needed to implement the OAuthHooks are exported
export {
  AccessDeniedError,
  type Account,
  type Awaitable,
  Client,
  type ClientAuth,
  type ClientId,
  type ClientInfo,
  type DeviceId,
  InvalidAuthorizationDetailsError,
  type Jwks,
  type OAuthAuthorizationDetails,
  type OAuthAuthorizationRequestParameters,
  type OAuthClientMetadata,
  OAuthError,
  type OAuthTokenResponse,
  type RequestMetadata,
}

export type OAuthHooks = {
  /**
   * Use this to alter, override or validate the client metadata & jwks returned
   * by the client store.
   *
   * @throws {InvalidClientMetadataError} if the metadata is invalid
   * @see {@link InvalidClientMetadataError}
   */
  getClientInfo?: (
    clientId: ClientId,
    data: { metadata: OAuthClientMetadata; jwks?: Jwks },
  ) => Awaitable<undefined | Partial<ClientInfo>>

  /**
   * Allows enriching the authorization details with additional information
   * when the tokens are issued.
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9396 | RFC 9396}
   */
  getAuthorizationDetails?: (data: {
    client: Client
    clientAuth: ClientAuth
    clientMetadata: RequestMetadata
    parameters: OAuthAuthorizationRequestParameters
    account: Account
  }) => Awaitable<undefined | OAuthAuthorizationDetails>

  /**
   * This hook is called when a client is authorized.
   *
   * @throws {AccessDeniedError} to deny the authorization request and redirect
   * the user to the client with an OAuth error (other errors will result in an
   * internal server error being displayed to the user)
   *
   * @note We use `deviceMetadata` instead of `clientMetadata` to make it clear
   * that this metadata is from the user device, which might be different from
   * the client metadata (because the OAuth client could live in a backend).
   */
  onAuthorized?: (data: {
    client: Client
    account: Account
    parameters: OAuthAuthorizationRequestParameters
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * This hook is called when an authorized client exchanges an authorization
   * code for an access token.
   *
   * @throws {OAuthError} to cancel the token creation and revoke the session
   */
  onTokenCreated?: (data: {
    client: Client
    clientAuth: ClientAuth
    clientMetadata: RequestMetadata
    account: Account
    parameters: OAuthAuthorizationRequestParameters
    /** null when "password grant" used (in which case {@link onAuthorized} won't have been called) */
    deviceId: null | DeviceId
  }) => Awaitable<void>

  /**
   * This hook is called when an authorized client refreshes an access token.
   *
   * @throws {OAuthError} to cancel the token refresh and revoke the session
   */
  onTokenRefreshed?: (data: {
    client: Client
    clientAuth: ClientAuth
    clientMetadata: RequestMetadata
    account: Account
    parameters: OAuthAuthorizationRequestParameters
    /** null when "password grant" used (in which case {@link onAuthorized} won't have been called) */
    deviceId: null | DeviceId
  }) => Awaitable<void>
}
