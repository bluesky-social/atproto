import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { AccessDeniedError } from './access-denied-error.js'

export class ConsentRequiredError extends AccessDeniedError {
  constructor(
    parameters: AuthorizationParameters,
    error_description = 'User consent required',
    cause?: unknown,
  ) {
    super(parameters, error_description, 'consent_required', cause)
  }
}
