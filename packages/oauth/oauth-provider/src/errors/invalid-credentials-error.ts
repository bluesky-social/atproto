import { OAuthError } from './oauth-error.js'

/**
 * @see
 * {@link https://github.com/bluesky-social/atproto/blob/main/packages/oauth/oauth-provider-frontend/src/routes/account/_minimalLayout/sign-in.tsx#L123}
 *
 * The credentials supplied are invalid to complete authentication. This occurs when either
 * the identifier (email or handle), password, or email-based OTP code are incorrect. In the
 * case of invalid email-based OTP code, we do not inform the requester what actually
 * caused the error, as to prevent revealing information.
 */
export class InvalidCredentialsError extends OAuthError {
  constructor(cause?: unknown) {
    super('invalid_request', 'Invalid identifier or password', 400, cause)
  }

  static from(err: unknown): InvalidCredentialsError {
    return new InvalidCredentialsError(err)
  }
}
