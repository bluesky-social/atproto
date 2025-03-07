import { Jwks } from '@atproto/jwk'
import {
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  OAuthClientMetadata,
  OAuthTokenResponse,
} from '@atproto/oauth-types'
import { Account } from './account/account.js'
import { SignInData } from './account/sign-in-data.js'
import { SignUpData } from './account/sign-up-data.js'
import { ClientAuth } from './client/client-auth.js'
import { ClientId } from './client/client-id.js'
import { ClientInfo } from './client/client-info.js'
import { Client } from './client/client.js'
import { InvalidRequestError } from './errors/invalid-request-error.js'
import { HcaptchaConfig, HcaptchaVerifyResult } from './lib/hcaptcha.js'
import { RequestMetadata } from './lib/http/request.js'
import { Awaitable } from './lib/util/type.js'
import { AccessDeniedError, OAuthError } from './oauth-errors.js'
import { DeviceAccountInfo, DeviceId } from './oauth-store.js'

// Make sure all types needed to implement the OAuthHooks are exported
export {
  AccessDeniedError,
  type Account,
  type Awaitable,
  Client,
  type ClientAuth,
  type ClientId,
  type ClientInfo,
  type DeviceAccountInfo,
  type DeviceId,
  type HcaptchaConfig,
  type HcaptchaVerifyResult,
  InvalidRequestError,
  type Jwks,
  type OAuthAuthorizationDetails,
  type OAuthAuthorizationRequestParameters,
  type OAuthClientMetadata,
  OAuthError,
  type OAuthTokenResponse,
  type RequestMetadata,
  type SignInData,
  type SignUpData,
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
   * This hook is called whenever an hcaptcha challenge is verified
   * during sign-up (if hcaptcha is enabled).
   *
   * @throws {InvalidRequestError} to deny the sign-up
   */
  onSignupHcaptchaResult?: (data: {
    data: SignUpData
    /**
     * This indicates not only wether the hCaptcha challenge succeeded, but also
     * if the score was low enough according to the
     * {@link HcaptchaConfig.scoreThreshold}.
     *
     * @see {@link HCaptchaClient.isAllowed}
     */
    allowed: boolean
    result: HcaptchaVerifyResult
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * This hook is called when a user attempts to sign up, after every validation
   * has passed (including hcaptcha).
   */
  onSignupAttempt?: (data: {
    data: SignUpData
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    hcaptchaResult?: HcaptchaVerifyResult
  }) => Awaitable<void>

  /**
   * This hook is called when a user successfully signs up.
   *
   * @throws {AccessDeniedError} to deny the sign-up
   */
  onSignedUp?: (data: {
    data: SignUpData
    info: DeviceAccountInfo
    account: Account
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * This hook is called when a user successfully signs in.
   *
   * @throws {InvalidRequestError} when the sing-in should be denied
   */
  onSignedIn?: (data: {
    data: SignInData
    info: DeviceAccountInfo
    account: Account
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

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
