import { OAuthError } from './oauth-error.js'

export class UnknownRequestError extends OAuthError {
  constructor(uri: string, cause?: unknown) {
    super('invalid_request', `Unknown request_uri "${uri}"`, 400, cause)
  }
}
