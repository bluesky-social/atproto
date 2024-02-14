import { OAuthError } from './oauth-error.js'

export class AccessDeniedError extends OAuthError {
  constructor(error_description: string, cause?: unknown) {
    super('access_denied', error_description, 400, cause)
  }
}
