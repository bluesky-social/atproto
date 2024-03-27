import { OAuthError } from './oauth-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9396#section-14.6 | RFC 9396, Section 14.6}
 */
export class InvalidAuthorizationDetailsError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_authorization_details', error_description, 400, cause)
  }
}
