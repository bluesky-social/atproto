import { JOSEError } from 'jose/errors'
import { ZodError } from 'zod'

import { UnauthorizedError, WWWAuthenticate } from './unauthorized-error.js'

export class InvalidTokenError extends UnauthorizedError {
  static from(
    err: unknown,
    wwwAuthenticate: WWWAuthenticate,
    fallbackMessage = 'Invalid token',
  ): InvalidTokenError {
    if (err instanceof JOSEError) {
      throw new InvalidTokenError(err.message, wwwAuthenticate, err)
    }

    if (err instanceof ZodError) {
      throw new InvalidTokenError(err.message, wwwAuthenticate, err)
    }

    throw new InvalidTokenError(fallbackMessage, wwwAuthenticate, err)
  }

  constructor(
    error_description: string,
    wwwAuthenticate: WWWAuthenticate,
    cause?: unknown,
  ) {
    super(error_description, wwwAuthenticate, cause)
  }
}
