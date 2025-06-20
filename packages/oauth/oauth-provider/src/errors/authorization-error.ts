import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import {
  AuthorizationResponseError,
  isAuthorizationResponseError,
} from '../types/authorization-response-error.js'
import { buildErrorPayload } from './error-parser.js'
import { OAuthError } from './oauth-error.js'

export type { AuthorizationResponseError, OAuthAuthorizationRequestParameters }

export class AuthorizationError extends OAuthError {
  constructor(
    public readonly parameters: OAuthAuthorizationRequestParameters,
    error_description: string,
    error: AuthorizationResponseError = 'invalid_request',
    cause?: unknown,
  ) {
    super(error, error_description, 400, cause)
  }

  static from(
    parameters: OAuthAuthorizationRequestParameters,
    cause: unknown,
  ): AuthorizationError {
    if (cause instanceof AuthorizationError) return cause
    const payload = buildErrorPayload(cause)
    return new AuthorizationError(
      parameters,
      payload.error_description,
      isAuthorizationResponseError(payload.error)
        ? payload.error // Propagate "error" derived from the cause
        : rootCause(cause) instanceof OAuthError
          ? 'invalid_request'
          : 'server_error',
      cause,
    )
  }
}

function rootCause(err: unknown): unknown {
  while (err instanceof Error && err.cause != null) {
    err = err.cause
  }
  return err
}
