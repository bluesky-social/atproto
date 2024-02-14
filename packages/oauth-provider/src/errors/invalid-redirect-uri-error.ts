import { InvalidClientError } from './invalid-client-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2 | RFC7591}
 */
export class InvalidRedirectUriError extends InvalidClientError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_redirect_uri', error_description, cause)
  }
}
