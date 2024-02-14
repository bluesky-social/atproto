import { InvalidClientError } from './invalid-client-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2 | RFC7591}
 */
export class InvalidClientMetadataError extends InvalidClientError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_client_metadata', error_description, cause)
  }
}
