import { OAuthError } from './oauth-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2 | RFC7591}
 */
export abstract class InvalidClientError extends OAuthError {
  constructor(error: string, error_description: string, cause?: unknown) {
    super(error, error_description, 400, cause)
  }
}
