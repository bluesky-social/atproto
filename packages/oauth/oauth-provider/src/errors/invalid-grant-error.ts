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
export class InvalidGrantError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_grant', error_description, 400, cause)
  }

  static from(err: unknown, error_description: string): InvalidGrantError {
    if (err instanceof InvalidGrantError) return err
    return new InvalidGrantError(error_description, err)
  }
}
