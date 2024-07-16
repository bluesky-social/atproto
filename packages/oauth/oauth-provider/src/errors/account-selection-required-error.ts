import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { AccessDeniedError } from './access-denied-error.js'

export class AccountSelectionRequiredError extends AccessDeniedError {
  constructor(
    parameters: OAuthAuthenticationRequestParameters,
    error_description = 'Account selection required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'account_selection_required', cause)
  }
}
