import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { AccessDeniedError } from './access-denied-error.js'

export class ConsentRequiredError extends AccessDeniedError {
  constructor(
    parameters: OAuthAuthenticationRequestParameters,
    error_description = 'User consent required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'consent_required', cause)
  }
}
