import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AuthorizationError } from './authorization-error.js'

export class AccessDeniedError extends AuthorizationError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description = 'Access denied',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'access_denied', cause)
  }
}
