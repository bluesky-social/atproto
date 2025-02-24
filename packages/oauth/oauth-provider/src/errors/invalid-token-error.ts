import { errors } from 'jose'
import { ZodError } from 'zod'
import { JwtVerifyError } from '@atproto/jwk'
import { OAuthError } from './oauth-error.js'
import { WWWAuthenticateError } from './www-authenticate-error.js'

const { JOSEError } = errors

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc6750#section-3.1 | RFC6750 - The WWW-Authenticate Response Header Field }
 *
 * The access token provided is expired, revoked, malformed, or invalid for
 * other reasons.  The resource SHOULD respond with the HTTP 401 (Unauthorized)
 * status code.  The client MAY request a new access token and retry the
 * protected resource request.
 */
export class InvalidTokenError extends WWWAuthenticateError {
  static from(
    err: unknown,
    tokenType: string,
    fallbackMessage = 'Invalid token',
  ): InvalidTokenError {
    if (err instanceof InvalidTokenError) {
      return err
    }

    if (err instanceof OAuthError) {
      return new InvalidTokenError(tokenType, err.error_description, err)
    }

    if (err instanceof JOSEError) {
      return new InvalidTokenError(tokenType, err.message, err)
    }

    if (err instanceof JwtVerifyError) {
      return new InvalidTokenError(tokenType, err.message, err)
    }

    if (err instanceof ZodError) {
      return new InvalidTokenError(tokenType, err.message, err)
    }

    return new InvalidTokenError(tokenType, fallbackMessage, err)
  }

  constructor(
    readonly tokenType: string,
    error_description: string,
    cause?: unknown,
  ) {
    const error = 'invalid_token'
    super(
      error,
      error_description,
      { [tokenType]: { error, error_description } },
      cause,
    )
  }
}
