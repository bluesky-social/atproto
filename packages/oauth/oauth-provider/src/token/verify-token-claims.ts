import { OAuthAccessToken, OAuthTokenType } from '@atproto/oauth-types'
import { InvalidDpopKeyBindingError } from '../errors/invalid-dpop-key-binding-error.js'
import { InvalidDpopProofError } from '../errors/invalid-dpop-proof-error.js'
import { asArray } from '../lib/util/cast.js'
import { InvalidTokenError } from '../oauth-errors.js'
import { DpopProof } from '../oauth-verifier.js'
import { SignedTokenPayload } from '../signer/signed-token-payload.js'
import { TokenId } from './token-id.js'

const BEARER = 'Bearer' satisfies OAuthTokenType
const DPOP = 'DPoP' satisfies OAuthTokenType

export type {
  DpopProof,
  OAuthAccessToken,
  OAuthTokenType,
  SignedTokenPayload,
  TokenId,
}

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
  dpopProof: null | DpopProof
}

export function verifyTokenClaims(
  token: OAuthAccessToken,
  tokenId: TokenId,
  tokenType: OAuthTokenType,
  tokenClaims: SignedTokenPayload,
  dpopProof: null | DpopProof,
  options?: VerifyTokenClaimsOptions,
): VerifyTokenClaimsResult {
  const dateReference = Date.now()

  if (tokenClaims.cnf?.jkt) {
    // An access token with a cnf.jkt claim must be a DPoP token
    if (tokenType !== DPOP) {
      throw new InvalidTokenError(
        DPOP,
        `Access token is bound to a DPoP proof, but token type is ${tokenType}`,
      )
    }

    // DPoP token type must be used with a DPoP proof
    if (!dpopProof) {
      throw new InvalidDpopProofError(`DPoP proof required`)
    }

    // DPoP proof must be signed with the key that matches the "cnf" claim
    if (tokenClaims.cnf.jkt !== dpopProof.jkt) {
      throw new InvalidDpopKeyBindingError()
    }
  } else {
    // An access token without a cnf.jkt claim must be a Bearer token
    if (tokenType !== BEARER) {
      throw new InvalidTokenError(
        BEARER,
        `Bearer token type must be used without a DPoP proof`,
      )
    }

    // Unexpected DPoP proof received for a Bearer token
    if (dpopProof) {
      throw new InvalidTokenError(
        BEARER,
        `DPoP proof not expected for Bearer token type`,
      )
    }
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

  return { token, tokenId, tokenType, tokenClaims, dpopProof }
}
