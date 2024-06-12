import { OAuthError } from './oauth-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2 | RFC7591 - Client Registration Error Response}
 *
 * The value of one of the client metadata fields is invalid and the server has
 * rejected this request.  Note that an authorization server MAY choose to
 * substitute a valid value for any requested parameter of a client's metadata.
 */
export class InvalidClientIdError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_client_id', error_description, 400, cause)
  }

  static from(err: unknown): InvalidClientIdError {
    if (err instanceof InvalidClientIdError) return err
    if (err instanceof TypeError) return new InvalidClientIdError(err.message)
    return new InvalidClientIdError('Invalid client identifier', err)
  }
}
