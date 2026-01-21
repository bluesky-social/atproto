import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AuthorizationError } from './authorization-error.js'

export class LoginRequiredError extends AuthorizationError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description = 'Login is required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'login_required', cause)
  }
}
