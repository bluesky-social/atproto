import { OAuthError } from './oauth-error.js'

export class AccountSelectionRequiredError extends OAuthError {
  constructor(
    error_description = 'Account selection required',
    cause?: unknown,
  ) {
    super('account_selection_required', error_description, 401, cause)
  }
}
