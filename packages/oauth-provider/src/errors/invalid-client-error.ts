import { OAuthError } from './oauth-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.2 | RFC6749 - Issuing an Access Token }
 *
 * Client authentication failed (e.g., unknown client, no client authentication
 * included, or unsupported authentication method). The authorization server MAY
 * return an HTTP 401 (Unauthorized) status code to indicate which HTTP
 * authentication schemes are supported.  If the client attempted to
 * authenticate via the "Authorization" request header field, the authorization
 * server MUST respond with an HTTP 401 (Unauthorized) status code and include
 * the "WWW-Authenticate" response header field matching the authentication
 * scheme used by the client.
 */
export class InvalidClientError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_client', error_description, 400, cause)
  }
}
