import { OAuthError } from './oauth-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.2 | RFC6749 - Issuing an Access Token }
 *
 * The provided authorization grant (e.g., authorization code, resource owner
 * credentials) or refresh token is invalid, expired, revoked, does not match
 * the redirection URI used in the authorization request, or was issued to
 * another client.
 */
export class InvalidCredentialsError extends OAuthError {
  constructor(cause?: unknown) {
    super('invalid_request', 'Invalid identifier or password', 400, cause)
  }

  static from(err: unknown): InvalidCredentialsError {
    return new InvalidCredentialsError(err)
  }
}
