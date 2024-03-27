import { OAuthError } from './oauth-error.js'

export class InvalidRequestError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('invalid_request', error_description, 400, cause)
  }
}
