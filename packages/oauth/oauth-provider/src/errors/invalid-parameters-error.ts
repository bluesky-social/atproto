import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AccessDeniedError } from './access-denied-error.js'

export class InvalidParametersError extends AccessDeniedError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description: string,
    cause?: unknown,
  ) {
    super(parameters, error_description, 'invalid_request', cause)
  }
}
