import { OAuthError } from './oauth-error.js'
import { WWWAuthenticateError } from './www-authenticate-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc9449#section-8 | RFC9449 - Section 8. Authorization Server-Provided Nonce}
 */
export class UseDpopNonceError extends OAuthError {
  constructor(
    error_description = 'Authorization server requires nonce in DPoP proof',
    cause?: unknown,
  ) {
    super('use_dpop_nonce', error_description, 400, cause)
  }

  /**
   * Convert this error into an error meant to be used as "Resource
   * Server-Provided Nonce" error.
   *
   * @see
   * {@link https://datatracker.ietf.org/doc/html/rfc9449#section-9 | RFC9449 - Section 9. Resource Server-Provided Nonce}
   */
  toWwwAuthenticateError(): WWWAuthenticateError {
    const { error, error_description } = this
    return new WWWAuthenticateError(
      error,
      error_description,
      { DPoP: { error, error_description } },
      this,
    )
  }
}
