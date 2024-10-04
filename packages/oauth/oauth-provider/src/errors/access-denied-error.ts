import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { buildErrorPayload } from '../output/build-error-payload.js'
import { OAuthError } from './oauth-error.js'

export class AccessDeniedError extends OAuthError {
  constructor(
    public readonly parameters: OAuthAuthorizationRequestParameters,
    error_description: string,
    error = 'access_denied',
    cause?: unknown,
  ) {
    super(error, error_description, 400, cause)
  }

  static from(
    parameters: OAuthAuthorizationRequestParameters,
    cause?: unknown,
    fallbackError?: string,
  ) {
    if (cause && cause instanceof AccessDeniedError) {
      return cause
    }

    const { error, error_description } = buildErrorPayload(cause)
    return new AccessDeniedError(
      parameters,
      error_description,
      fallbackError ?? error,
      cause,
    )
  }
}
