import { OAuthAccessToken, OAuthTokenType } from '@atproto/oauth-types'

import { InvalidDpopKeyBindingError } from '../errors/invalid-dpop-key-binding-error.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { asArray } from '../lib/util/cast.js'
import { InvalidTokenError } from '../oauth-errors.js'
import { TokenClaims } from './token-claims.js'
import { TokenId } from './token-id.js'

export type VerifyTokenClaimsOptions = {
  /** One of these audience must be included in the token audience(s) */
  audience?: [string, ...string[]]
  /** One of these scope must be included in the token scope(s) */
  scope?: [string, ...string[]]
}

export type VerifyTokenClaimsResult = {
  token: OAuthAccessToken
  tokenId: TokenId
  tokenType: OAuthTokenType
  claims: TokenClaims
}

export function verifyTokenClaims(
  token: OAuthAccessToken,
  tokenId: TokenId,
  tokenType: OAuthTokenType,
  dpopJkt: string | null,
  claims: TokenClaims,
  options?: VerifyTokenClaimsOptions,
): VerifyTokenClaimsResult {
  const dateReference = Date.now()
  const claimsJkt = claims.cnf?.jkt ?? null

  const expectedTokenType: OAuthTokenType = claimsJkt ? 'DPoP' : 'Bearer'
  if (expectedTokenType !== tokenType) {
    throw new InvalidTokenError(expectedTokenType, `Invalid token type`)
  }
  if (tokenType === 'DPoP' && !dpopJkt) {
    throw new InvalidDpopProofError(`jkt is required for DPoP tokens`)
  }
  if (claimsJkt !== dpopJkt) {
    throw new InvalidDpopKeyBindingError()
  }

  if (options?.audience) {
    const aud = asArray(claims.aud)
    if (!options.audience.some((v) => aud.includes(v))) {
      throw new InvalidTokenError(tokenType, `Invalid audience`)
    }
  }

  if (options?.scope) {
    const scopes = claims.scope?.split(' ')
    if (!scopes || !options.scope.some((v) => scopes.includes(v))) {
      throw new InvalidTokenError(tokenType, `Invalid scope`)
    }
  }

  if (claims.exp && claims.exp * 1000 <= dateReference) {
    throw new InvalidTokenError(tokenType, `Token expired`)
  }

  return { token, tokenId, tokenType, claims }
}
