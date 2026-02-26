import { XrpcError } from '@atproto/lex-client'
import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import { LexValidationError } from '@atproto/lex-schema'
import {
  WWWAuthenticate,
  formatWWWAuthenticateHeader,
} from './lib/www-authenticate.js'

export { LexError }
export type { LexErrorCode, LexErrorData, WWWAuthenticate }

/**
 * Base error class for representing errors that should be converted to XRPC
 * error responses.
 */
export class LexServerError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'LexServerError'

  readonly headers?: Headers

  constructor(
    readonly status: number,
    readonly body: LexErrorData<N>,
    headers?: HeadersInit,
    options?: ErrorOptions,
  ) {
    super(body.error, body.message, options)
    this.headers = headers ? new Headers(headers) : undefined
  }

  override toJSON(): LexErrorData<N> {
    return this.body
  }

  public toResponse(): Response {
    const { status, headers } = this
    // @NOTE using this.toJSON() instead of this.body to allow overrides in subclasses
    return Response.json(this.toJSON(), { status, headers })
  }

  static from(cause: unknown): LexServerError {
    if (cause instanceof LexServerError) {
      return cause
    }

    // Convert @atproto/lex-client errors to downstream LexServerError
    if (cause instanceof XrpcError) {
      const { status, body, headers } = cause.toDownstreamError()
      return new LexServerError(status, body, headers, { cause })
    }

    // Convert @atproto/lex-schema validation errors to 400 Bad Request
    if (cause instanceof LexValidationError) {
      return new LexServerError(400, cause.toJSON(), undefined, {
        cause,
      })
    }

    // Any other error is treated as a generic 500 Internal Server Error
    if (cause instanceof LexError) {
      return new LexServerError(500, cause.toJSON(), undefined, {
        cause,
      })
    }

    return new LexServerError(
      500,
      { error: 'InternalError', message: 'An internal error occurred' },
      undefined,
      { cause },
    )
  }
}

/**
 * Error class for authentication failures in XRPC server handlers.
 *
 * Extends {@link LexError} to include WWW-Authenticate header support,
 * which is required by HTTP authentication standards (RFC 7235).
 * The error automatically generates the appropriate 401 response with
 * the WWW-Authenticate header when converted to a Response.
 *
 * @typeParam N - The Lexicon error code type
 *
 * @example Throwing an auth error
 * ```typescript
 * import { LexServerAuthError } from '@atproto/lex-server'
 *
 * throw new LexServerAuthError(
 *   'AuthenticationRequired',
 *   'Invalid or expired token',
 *   { Bearer: { error: 'InvalidToken', realm: 'api.example.com' } }
 * )
 * ```
 */
export class LexServerAuthError<
  N extends LexErrorCode = LexErrorCode,
> extends LexServerError<N> {
  name = 'LexServerAuthError'

  /**
   * Creates a new authentication error.
   *
   * @param error - The Lexicon error code (e.g., 'AuthenticationRequired')
   * @param message - Human-readable error message
   * @param wwwAuthenticate - WWW-Authenticate header parameters
   * @param options - Standard Error options including `cause`
   */
  constructor(
    error: N,
    message: string,
    readonly wwwAuthenticate: WWWAuthenticate = {},
    options?: ErrorOptions,
  ) {
    const headers = new Headers({
      'WWW-Authenticate': formatWWWAuthenticateHeader(wwwAuthenticate),
      'Access-Control-Expose-Headers': 'WWW-Authenticate', // CORS
    })
    super(401, { error, message }, headers, options)
  }

  /**
   * Creates a LexServerAuthError from an existing LexError.
   *
   * If the input is already a LexServerAuthError, returns it unchanged.
   * Otherwise, wraps the error with the provided WWW-Authenticate parameters.
   *
   * @param cause - The original LexError to wrap
   * @param wwwAuthenticate - WWW-Authenticate header parameters
   * @returns A LexServerAuthError instance
   *
   * @example Converting from a LexError
   * ```typescript
   * try {
   *   await validateToken(token)
   * } catch (error) {
   *   throw LexServerAuthError.from(error, {
   *     Bearer: { error: 'InvalidToken' }
   *   })
   * }
   * ```
   */
  static from(
    cause: unknown,
    wwwAuthenticate?: WWWAuthenticate,
  ): LexServerAuthError {
    if (cause instanceof LexServerAuthError) {
      return cause
    }

    if (cause instanceof LexError) {
      return new LexServerAuthError(
        cause.error,
        cause.message,
        wwwAuthenticate,
        { cause },
      )
    }

    return new LexServerAuthError(
      'AuthenticationRequired',
      'Authentication failed',
      wwwAuthenticate,
      { cause },
    )
  }
}
