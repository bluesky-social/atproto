import { OAuthError } from './oauth-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.2 | RFC6749 - Issuing an Access Token }
 *
 * The authenticated client is not authorized to use this authorization grant
 * type.
 *
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1 | RFC6749 - Authorization Code Grant, Authorization Request}
 *
 * The client is not authorized to request an authorization code using this
 * method.
 */
export class UnauthorizedClientError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('unauthorized_client', error_description, 400, cause)
  }
}
