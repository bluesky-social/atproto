import { OAuthScope } from '@atproto/oauth-types'
import { ClientId } from '../client/client-id.js'
import { TokenId } from './token-id.js'

/**
 * The access token claims that will be set by the {@link TokenManager} and that
 * will be passed to the "onCreateToken" hook.
 *
 * @note "iss" is missing here because it cannot be altered and will always be
 * set to the Authorization Server's identifier.
 */
export type TokenClaims = {
  jti: TokenId
  sub: string
  iat: number
  exp: number
  aud: string | [string, ...string[]]
  cnf?: { jkt: string }
  scope?: OAuthScope
  client_id: ClientId
}
