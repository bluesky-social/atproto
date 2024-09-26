import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AccessDeniedError } from './access-denied-error.js'

export class ConsentRequiredError extends AccessDeniedError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description = 'User consent required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'consent_required', cause)
  }
}
