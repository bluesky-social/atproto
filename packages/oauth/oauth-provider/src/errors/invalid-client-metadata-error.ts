import { OAuthError } from './oauth-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2 | RFC7591 - Client Registration Error Response}
 *
 * The value of one of the client metadata fields is invalid and the server has
 * rejected this request.  Note that an authorization server MAY choose to
 * substitute a valid value for any requested parameter of a client's metadata.
 */
export class InvalidClientMetadataError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_client_metadata', error_description, 400, cause)
  }

  static from(
    cause: unknown,
    fallbackMessage = 'Invalid client metadata document',
  ): InvalidClientMetadataError {
    if (cause instanceof InvalidClientMetadataError) {
      return cause
    }
    if (cause instanceof TypeError) {
      // This method is meant to be used in the context of parsing & validating
      // a client client metadata. In that context, a TypeError would more
      // likely represent a problem with the data (e.g. invalid URL constructor
      // arg) and not a programming error.
      return new InvalidClientMetadataError(cause.message, cause)
    }
    return new InvalidClientMetadataError(fallbackMessage, cause)
  }
}
