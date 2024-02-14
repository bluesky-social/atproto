import { AccessToken } from '../access-token/access-token.js'
import { InvalidDpopKeyBindingError } from '../errors/invalid-dpop-key-binding.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { UnauthorizedError } from '../errors/unauthorized-error.js'
import { asArray } from '../util/cast.js'
import { TokenClaims } from './token-claims.js'
import { TokenId } from './token-id.js'
import { TokenType } from './token-type.js'

export type VerifyTokenClaimsOptions = {
  /** One of these audience must be included in the token audience(s) */
  audience?: [string, ...string[]]
  /** One of these scope must be included in the token scope(s) */
  scope?: [string, ...string[]]
}

export type VerifyTokenClaimsResult = {
  token: AccessToken
  tokenId: TokenId
  tokenType: TokenType
  claims: TokenClaims
}

export function verifyTokenClaims(
  token: AccessToken,
  tokenId: TokenId,
  tokenType: TokenType,
  dpopJkt: string | null,
  claims: TokenClaims,
  options?: VerifyTokenClaimsOptions,
): VerifyTokenClaimsResult {
  const claimsJkt = claims.cnf?.jkt ?? null

  const expectedTokenType: TokenType = claimsJkt ? 'DPoP' : 'Bearer'
  if (expectedTokenType !== tokenType) {
    throw new UnauthorizedError(`Invalid token type`, {
      [expectedTokenType]: {},
    })
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
      throw new UnauthorizedError(`Invalid audience`, {
        [tokenType]: {},
      })
    }
  }

  if (options?.scope) {
    const scopes = claims.scope?.split(' ')
    if (!scopes || !options.scope.some((v) => scopes.includes(v))) {
      throw new UnauthorizedError(`Invalid scope`, {
        [tokenType]: {},
      })
    }
  }

  return { token, tokenId, tokenType, claims }
}
