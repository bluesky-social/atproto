import { OAuthError } from './oauth-error.js'

export class ConsentRequiredError extends OAuthError {
  constructor(error_description = 'User consent required', cause?: unknown) {
    super('consent_required', error_description, 401, cause)
  }
}
