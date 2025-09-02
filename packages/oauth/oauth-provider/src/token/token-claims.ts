import type { Account } from '@atproto/oauth-provider-api'
import {
  OAuthAuthorizationRequestParameters,
  OAuthScope,
} from '@atproto/oauth-types'
import { AccessTokenMode } from '../access-token/access-token-mode.js'
import { ClientId } from '../client/client-id.js'
import { dateToEpoch } from '../lib/util/date.js'
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

export function buildTokenClaims(
  tokenId: TokenId,
  clientId: ClientId,
  account: Account,
  parameters: OAuthAuthorizationRequestParameters,
  issuedAt: Date,
  expiresAt: Date,
  scope: OAuthScope | null,
  mode: AccessTokenMode,
): TokenClaims {
  return {
    jti: tokenId,
    sub: account.sub,
    iat: dateToEpoch(issuedAt),
    exp: dateToEpoch(expiresAt),

    ...(parameters.dpop_jkt && {
      cnf: { jkt: parameters.dpop_jkt },
    }),

    ...(mode === AccessTokenMode.stateless && {
      aud: account.aud,
      scope: scope ?? parameters.scope,
      // https://datatracker.ietf.org/doc/html/rfc8693#section-4.3
      client_id: clientId,
    }),
  }
}
