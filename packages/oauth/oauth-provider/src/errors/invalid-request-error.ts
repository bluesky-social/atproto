import { OAuthError } from './oauth-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.2 | RFC6749 - Issuing an Access Token}
 * : The request is missing a required parameter, includes an unsupported
 * parameter value (other than grant type), repeats a parameter, includes
 * multiple credentials, utilizes more than one mechanism for authenticating the
 * client, or is otherwise malformed.
 *
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1 | RFC6749 - Authorization Code Grant, Authorization Request}
 * : The request is missing a required parameter, includes an invalid parameter
 * value, includes a parameter more than once, or is otherwise malformed.
 *
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6750#section-3.1 | RFC6750 - The WWW-Authenticate Response Header Field}
 * : The request is missing a required parameter, includes an unsupported
 * parameter or parameter value, repeats the same parameter, uses more than one
 * method for including an access token, or is otherwise malformed. The resource
 * server SHOULD respond with the HTTP 400 (Bad Request) status code.
 */
export class InvalidRequestError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_request', error_description, 400, cause)
  }

  static from(err: unknown, message = 'Invalid request data'): OAuthError {
    if (err instanceof OAuthError) return err
    return new InvalidRequestError(message, err)
  }
}
