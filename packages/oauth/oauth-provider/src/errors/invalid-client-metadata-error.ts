import { ZodError } from 'zod'
import { FetchError } from '@atproto-labs/fetch'
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

  static from(cause: unknown, message = 'Invalid client metadata'): OAuthError {
    if (cause instanceof OAuthError) {
      return cause
    }

    if (cause instanceof FetchError) {
      throw new InvalidClientMetadataError(
        cause.expose ? `${message}: ${cause.message}` : message,
        cause,
      )
    }

    if (cause instanceof ZodError) {
      const causeMessage =
        cause.issues
          .map(
            ({ path, message }) =>
              `Validation${path.length ? ` of "${path.join('.')}"` : ''} failed with error: ${message}`,
          )
          .join(' ') || cause.message

      throw new InvalidClientMetadataError(
        causeMessage ? `${message}: ${causeMessage}` : message,
        cause,
      )
    }

    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
    ) {
      throw new InvalidClientMetadataError(
        `${message}: Self-signed certificate`,
        cause,
      )
    }

    if (cause instanceof TypeError) {
      // This method is meant to be used in the context of parsing & validating
      // a client client metadata. In that context, a TypeError would more
      // likely represent a problem with the data (e.g. invalid URL constructor
      // arg) and not a programming error.
      return new InvalidClientMetadataError(
        `${message}: ${cause.message}`,
        cause,
      )
    }

    return new InvalidClientMetadataError(message, cause)
  }
}
