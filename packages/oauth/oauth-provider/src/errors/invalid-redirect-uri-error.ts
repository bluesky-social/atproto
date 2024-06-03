import { OAuthError } from './oauth-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2 | RFC7591}
 *
 * The value of one or more redirection URIs is invalid.
 */
export class InvalidRedirectUriError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_redirect_uri', error_description, 400, cause)
  }

  static from(cause?: unknown): InvalidRedirectUriError {
    if (cause instanceof InvalidRedirectUriError) return cause
    return new InvalidRedirectUriError('Invalid redirect URI', cause)
  }
}
