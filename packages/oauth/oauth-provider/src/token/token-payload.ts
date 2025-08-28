import type { Account } from '@atproto/oauth-provider-api'
import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AccessTokenMode } from '../access-token/access-token-mode.js'
import { ClientId } from '../client/client-id.js'
import { dateToEpoch } from '../lib/util/date.js'
import { OmitKey } from '../lib/util/type.js'
import { SignedTokenPayload } from '../signer/signed-token-payload.js'
import { TokenId } from './token-id.js'

export type TokenPayload = OmitKey<SignedTokenPayload, 'iss'>

export function buildTokenPayload(
  tokenId: TokenId,
  clientId: ClientId,
  account: Account,
  parameters: OAuthAuthorizationRequestParameters,
  issuedAt: Date,
  expiresAt: Date,
  mode: AccessTokenMode,
): TokenPayload {
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
      scope: parameters.scope,
      // https://datatracker.ietf.org/doc/html/rfc8693#section-4.3
      client_id: clientId,
    }),
  }
}
