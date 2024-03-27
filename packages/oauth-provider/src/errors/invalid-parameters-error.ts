import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { AccessDeniedError } from './access-denied-error.js'

export class InvalidParametersError extends AccessDeniedError {
  constructor(
    parameters: AuthorizationParameters,
    error_description: string,
    cause?: unknown,
  ) {
    super(parameters, error_description, 'invalid_request', cause)
  }
}
