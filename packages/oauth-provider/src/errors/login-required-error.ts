import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { AccessDeniedError } from './access-denied-error.js'

export class LoginRequiredError extends AccessDeniedError {
  constructor(
    parameters: AuthorizationParameters,
    error_description = 'Login is required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'login_required', cause)
  }
}
