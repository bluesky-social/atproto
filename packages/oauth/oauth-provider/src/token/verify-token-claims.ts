import { OAuthTokenType } from '@atproto/oauth-types'
import { InvalidTokenError } from '../oauth-errors.js'
import { AccessTokenPayload } from '../signer/access-token-payload.js'

export type VerifyTokenClaimsOptions = {
  /** One of these audience must be included in the token audience(s) */
  audience?: [string, ...string[]]
  /** One of these scope must be included in the token scope(s) */
  scope?: [string, ...string[]]
}

export function verifyTokenClaims(
  tokenType: OAuthTokenType,
  tokenClaims: AccessTokenPayload,
  options?: VerifyTokenClaimsOptions,
): void {
  if (options?.audience) {
    const { aud } = tokenClaims
    const hasMatch =
      aud != null &&
      (Array.isArray(aud)
        ? options.audience.some(includedIn, aud)
        : options.audience.includes(aud))
    if (!hasMatch) {
      throw new InvalidTokenError(tokenType, `Invalid audience`)
    }
  }

  if (options?.scope) {
    const scopes = tokenClaims.scope?.split(' ')
    if (!scopes || !options.scope.some(includedIn, scopes)) {
      throw new InvalidTokenError(tokenType, `Invalid scope`)
    }
  }

  if (tokenClaims.exp != null && tokenClaims.exp * 1000 <= Date.now()) {
    throw new InvalidTokenError(tokenType, `Token expired`)
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
