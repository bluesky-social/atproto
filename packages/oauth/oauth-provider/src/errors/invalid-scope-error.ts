import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AuthorizationError } from './authorization-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-4.1.2.1}
 */
export class InvalidScopeError extends AuthorizationError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description: string,
    cause?: unknown,
  ) {
    super(parameters, error_description, 'invalid_scope', cause)
  }
}
