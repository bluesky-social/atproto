import { OAuthError } from './oauth-error.js'

export class LoginRequiredError extends OAuthError {
  constructor(error_description = 'Login is required', cause?: unknown) {
    super('login_required', error_description, 401, cause)
  }
}
