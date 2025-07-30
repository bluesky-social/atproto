import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AuthorizationError } from './authorization-error.js'

export class ConsentRequiredError extends AuthorizationError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description = 'User consent required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'consent_required', cause)
  }
}
