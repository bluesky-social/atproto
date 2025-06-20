import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AuthorizationError } from './authorization-error.js'

export class AccountSelectionRequiredError extends AuthorizationError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description = 'Account selection required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'account_selection_required', cause)
  }
}
