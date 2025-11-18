import { Jwks } from '@atproto/jwk'
import type { Account } from '@atproto/oauth-provider-api'
import {
  OAuthAccessToken,
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
  OAuthClientMetadata,
  OAuthTokenResponse,
  OAuthTokenType,
} from '@atproto/oauth-types'
import {
  ResetPasswordConfirmInput,
  ResetPasswordRequestInput,
  SignUpData,
} from './account/account-store.js'
import { SignInData } from './account/sign-in-data.js'
import { SignUpInput } from './account/sign-up-input.js'
import { ClientAuth } from './client/client-auth.js'
import { ClientId } from './client/client-id.js'
import { ClientInfo } from './client/client-info.js'
import { Client } from './client/client.js'
import { DeviceId } from './device/device-id.js'
import { DpopProof } from './dpop/dpop-proof.js'
import { AccessDeniedError } from './errors/access-denied-error.js'
import { AuthorizationError } from './errors/authorization-error.js'
import { InvalidRequestError } from './errors/invalid-request-error.js'
import { OAuthError } from './errors/oauth-error.js'
import {
  HcaptchaClientTokens,
  HcaptchaConfig,
  HcaptchaVerifyResult,
} from './lib/hcaptcha.js'
import { RequestMetadata } from './lib/http/request.js'
import { Awaitable, OmitKey } from './lib/util/type.js'
import { RequestId } from './request/request-id.js'
import { AccessTokenPayload } from './signer/access-token-payload.js'
import { TokenClaims } from './token/token-claims.js'

// Make sure all types needed to implement the OAuthHooks are exported
export {
  AccessDeniedError,
  type AccessTokenPayload,
  type Account,
  AuthorizationError,
  type Awaitable,
  Client,
  type ClientAuth,
  type ClientId,
  type ClientInfo,
  type DeviceId,
  type DpopProof,
  type HcaptchaClientTokens,
  type HcaptchaConfig,
  type HcaptchaVerifyResult,
  InvalidRequestError,
  type Jwks,
  type OAuthAccessToken,
  type OAuthAuthorizationDetails,
  type OAuthAuthorizationRequestParameters,
  type OAuthClientMetadata,
  OAuthError,
  type OAuthTokenResponse,
  type OAuthTokenType,
  type RequestMetadata,
  type ResetPasswordConfirmInput,
  type ResetPasswordRequestInput,
  type SignInData,
  type SignUpData,
  type SignUpInput,
  type TokenClaims,
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
   * This hook is called when a user attempts to sign up, after every validation
   * has passed (including hcaptcha).
   */
  onSignUpAttempt?: (data: {
    input: SignUpInput
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * This hook is called when a user attempts to sign up, after the hcaptcha
   * `/siteverify` request has been made (and before the result is validated).
   */
  onHcaptchaResult?: (data: {
    input: SignUpInput
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    tokens: HcaptchaClientTokens
    result: HcaptchaVerifyResult
  }) => Awaitable<void>

  /**
   * This hook is called when a user requests a password reset, before the
   * reset password request is triggered on the account store.
   */
  onResetPasswordRequest?: (data: {
    input: ResetPasswordRequestInput
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * This hook is called when a user requests a password reset, before the
   * reset password request is triggered on the account store.
   */
  onResetPasswordRequested?: (data: {
    input: ResetPasswordRequestInput
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    account: Account
  }) => Awaitable<void>

  /**
   * This hook is called when a user confirms a password reset, before the
   * password is actually reset on the account store.
   */
  onResetPasswordConfirm?: (data: {
    input: ResetPasswordConfirmInput
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * This hook is called after a user confirms a password reset, and the
   * password was successfully reset on the account store.
   */
  onResetPasswordConfirmed?: (data: {
    input: ResetPasswordConfirmInput
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
    account: Account
  }) => Awaitable<void>

  /**
   * This hook is called when a user successfully signs up.
   *
   * @throws {AccessDeniedError} to deny the sign-up
   */
  onSignedUp?: (data: {
    data: SignUpData
    account: Account
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  onSignInAttempt?: (data: {
    data: SignInData
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
    account: Account
    deviceId: DeviceId
    deviceMetadata: RequestMetadata
  }) => Awaitable<void>

  /**
   * Allows validating an authorization request (typically the requested scopes)
   * before it is created. Note that the validity against the client metadata is
   * already enforced by the OAuth provider.
   *
   * @throws {AuthorizationError}
   */
  onAuthorizationRequest?: (data: {
    client: Client
    clientAuth: null | ClientAuth
    parameters: Readonly<OAuthAuthorizationRequestParameters>
  }) => Awaitable<void>

  /**
   * This hook is called when a client is authorized.
   *
   * @throws {AuthorizationError} to deny the authorization request and redirect
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
    requestId: RequestId
  }) => Awaitable<void>

  /**
   * This hook is called whenever a token is about to be created. You can use
   * it to modify the token claims or perform additional validation.
   *
   * This hook should never throw an error.
   */
  onCreateToken?: (data: {
    client: Client
    account: Account
    parameters: OAuthAuthorizationRequestParameters
    claims: TokenClaims
  }) => Awaitable<void | OmitKey<AccessTokenPayload, 'iss'>>

  /**
   * This hook is called whenever a token was just decoded, and basic validation
   * was performed (signature, expiration, not-before).
   *
   * It can be used to modify the payload (e.g., to add custom claims), or to
   * perform additional validation.
   *
   * This hook is called when authenticating requests through the
   * `authenticateRequest()` method in `OAuthVerifier` and `OAuthProvider`.
   *
   * Any error thrown here will be propagated.
   */
  onDecodeToken?: (data: {
    tokenType: OAuthTokenType
    token: OAuthAccessToken
    payload: AccessTokenPayload
    dpopProof: null | DpopProof
  }) => Promise<AccessTokenPayload | void>

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
  }) => Awaitable<void>
}
