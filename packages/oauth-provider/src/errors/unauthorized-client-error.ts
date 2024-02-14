import { OAuthError } from './oauth-error.js'

export class UnauthorizedClientError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('unauthorized_client', error_description, 401, cause)
  }
}
