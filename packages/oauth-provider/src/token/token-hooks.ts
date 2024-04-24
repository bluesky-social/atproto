import {
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationDetails,
} from '@atproto/oauth-types'
import { Account } from '../account/account.js'
import { Client } from '../client/client.js'
import { Awaitable } from '../lib/util/type.js'
import { TokenResponse } from './token-response.js'

export type { TokenResponse }

export type TokenHookData = {
  client: Client
  parameters: OAuthAuthenticationRequestParameters
  account: Account
}

/**
 * Allows enriching the authorization details with additional information
 * before the tokens are issued.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9396 | RFC 9396}
 */
export type AuthorizationDetailsHook = (
  this: null,
  data: TokenHookData,
) => Awaitable<undefined | OAuthAuthorizationDetails>

/**
 * Allows altering the token response before it is sent to the client.
 */
export type TokenResponseHook = (
  this: null,
  tokenResponse: TokenResponse,
  data: TokenHookData,
) => Awaitable<void>

export type TokenHooks = {
  onAuthorizationDetails?: AuthorizationDetailsHook
  onTokenResponse?: TokenResponseHook
}
