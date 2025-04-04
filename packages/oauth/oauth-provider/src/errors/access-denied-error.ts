import {
  OAuthAuthenticationErrorResponse,
  OAuthAuthorizationRequestParameters,
  OidcAuthenticationErrorResponse,
} from '@atproto/oauth-types'
import { buildErrorPayload } from './error-parser.js'
import { OAuthError } from './oauth-error.js'

export type AuthenticationErrorResponse =
  | OAuthAuthenticationErrorResponse
  // OIDC authentication error response are not part of the ATproto flavoured
  // OAuth but we allow them because they provide better feedback to the client
  // (in particular when SSO is used).
  | OidcAuthenticationErrorResponse
  // This error is defined by rfc9396 (not part of the OAuth 2.1 or OIDC). But
  // since, in ATproto flavoured OAuth, client registration is a dynamic part of
  // the authorization process, we allow it.
  | 'invalid_authorization_details'

export class AccessDeniedError extends OAuthError {
  constructor(
    public readonly parameters: OAuthAuthorizationRequestParameters,
    error_description: string,
    error: AuthenticationErrorResponse = 'access_denied',
    cause?: unknown,
  ) {
    super(error, error_description, 400, cause)
  }

  static from(
    parameters: OAuthAuthorizationRequestParameters,
    cause: unknown,
    error: AuthenticationErrorResponse,
  ): AccessDeniedError {
    if (cause instanceof AccessDeniedError) return cause
    const { error_description } = buildErrorPayload(cause)
    return new AccessDeniedError(parameters, error_description, error, cause)
  }
}
