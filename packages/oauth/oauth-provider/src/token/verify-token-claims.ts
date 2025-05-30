import { OAuthAccessToken, OAuthTokenType } from '@atproto/oauth-types'
import { InvalidDpopKeyBindingError } from '../errors/invalid-dpop-key-binding-error.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { asArray } from '../lib/util/cast.js'
import { InvalidTokenError } from '../oauth-errors.js'
import { DpopResult } from '../oauth-verifier.js'
import { SignedTokenPayload } from '../signer/signed-token-payload.js'
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
  tokenClaims: SignedTokenPayload
  dpopResult: null | DpopResult
}

export function verifyTokenClaims(
  token: OAuthAccessToken,
  tokenId: TokenId,
  tokenType: OAuthTokenType,
  tokenClaims: SignedTokenPayload,
  dpopResult: null | DpopResult,
  options?: VerifyTokenClaimsOptions,
): VerifyTokenClaimsResult {
  const dateReference = Date.now()

  const expectedTokenType: OAuthTokenType = tokenClaims.cnf?.jkt
    ? 'DPoP'
    : 'Bearer'
  if (expectedTokenType !== tokenType) {
    throw new InvalidTokenError(expectedTokenType, `Invalid token type`)
  }
  if (tokenType === 'DPoP' && !dpopResult) {
    throw new InvalidDpopProofError(`DPoP proof required`)
  }
  if (tokenClaims.cnf?.jkt !== dpopResult?.jkt) {
    throw new InvalidDpopKeyBindingError()
  }

  if (options?.audience) {
    const aud = asArray(tokenClaims.aud)
    if (!options.audience.some((v) => aud.includes(v))) {
      throw new InvalidTokenError(tokenType, `Invalid audience`)
    }
  }

  if (options?.scope) {
    const scopes = tokenClaims.scope?.split(' ')
    if (!scopes || !options.scope.some((v) => scopes.includes(v))) {
      throw new InvalidTokenError(tokenType, `Invalid scope`)
    }
  }

  if (tokenClaims.exp != null && tokenClaims.exp * 1000 <= dateReference) {
    throw new InvalidTokenError(tokenType, `Token expired`)
  }

  return { token, tokenId, tokenType, tokenClaims, dpopResult }
}
