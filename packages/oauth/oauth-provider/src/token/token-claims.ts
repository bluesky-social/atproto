import { OAuthScope } from '@atproto/oauth-types'
import { ClientId } from '../client/client-id.js'
import { TokenId } from './token-id.js'

export type TokenClaims = {
  jti: TokenId
  sub: string
  iat: number
  exp: number
  cnf?: { jkt: string }
  aud?: string | [string, ...string[]]
  scope?: OAuthScope
  client_id?: ClientId
}
