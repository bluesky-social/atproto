import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { AccessDeniedError } from './access-denied-error.js'

export class LoginRequiredError extends AccessDeniedError {
  constructor(
    parameters: OAuthAuthenticationRequestParameters,
    error_description = 'Login is required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'login_required', cause)
  }
}
