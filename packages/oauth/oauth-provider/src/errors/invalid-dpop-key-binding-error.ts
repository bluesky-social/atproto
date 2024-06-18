import { WWWAuthenticateError } from './www-authenticate-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6750#section-3.1 | RFC6750 - The WWW-Authenticate Response Header Field}
 *
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc9449#name-the-dpop-authentication-sch | RFC9449 - The DPoP Authentication Scheme}
 */
export class InvalidDpopKeyBindingError extends WWWAuthenticateError {
  constructor(cause?: unknown) {
    const error = 'invalid_token'
    const error_description = 'Invalid DPoP key binding'
    super(
      error,
      error_description,
      { DPoP: { error, error_description } },
      cause,
    )
  }
}
