import { LexError, LexErrorCode } from '@atproto/lex-data'
import {
  WWWAuthenticate,
  formatWWWAuthenticateHeader,
} from './lib/www-authenticate.js'

export type { WWWAuthenticate }

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
 *
 * @example Converting from a LexError
 * ```typescript
 * try {
 *   await validateToken(token)
 * } catch (error) {
 *   if (error instanceof LexError) {
 *     throw LexServerAuthError.from(error, {
 *       Bearer: { error: 'InvalidToken' }
 *     })
 *   }
 *   throw error
 * }
 * ```
 */
export class LexServerAuthError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
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
    super(error, message, options)
  }

  /**
   * Gets the formatted WWW-Authenticate header value.
   *
   * @returns The formatted header string for the 401 response
   *
   * @example
   * ```typescript
   * const error = new LexServerAuthError('AuthenticationRequired', 'Token required', {
   *   Bearer: { realm: 'api.example.com', error: 'MissingToken' }
   * })
   * console.log(error.wwwAuthenticateHeader)
   * // Output: 'Bearer realm="api.example.com", error="MissingToken"'
   * ```
   */
  get wwwAuthenticateHeader(): string {
    return formatWWWAuthenticateHeader(this.wwwAuthenticate)
  }

  /**
   * Converts the error to a JSON representation suitable for response bodies.
   *
   * If the error was created from another LexError (via `from()`), returns
   * the original error's JSON representation.
   *
   * @returns JSON object with error code and message
   */
  toJSON() {
    const { cause } = this
    return cause instanceof LexError ? cause.toJSON() : super.toJSON()
  }

  /**
   * Converts the error to an HTTP 401 Response with WWW-Authenticate header.
   *
   * The response includes:
   * - Status code 401 (Unauthorized)
   * - WWW-Authenticate header (if parameters were provided)
   * - Access-Control-Expose-Headers for CORS compatibility
   * - JSON body with error details
   *
   * @returns HTTP Response object ready to be sent to the client
   */
  toResponse(): Response {
    const { wwwAuthenticateHeader } = this

    const headers = wwwAuthenticateHeader
      ? new Headers({
          'WWW-Authenticate': wwwAuthenticateHeader,
          'Access-Control-Expose-Headers': 'WWW-Authenticate', // CORS
        })
      : undefined

    return Response.json(this.toJSON(), { status: 401, headers })
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
   * @example
   * ```typescript
   * const lexError = new LexError('AuthenticationRequired', 'Token expired')
   * const authError = LexServerAuthError.from(lexError, {
   *   Bearer: { error: 'ExpiredToken' }
   * })
   * ```
   */
  static from(
    cause: LexError,
    wwwAuthenticate?: WWWAuthenticate,
  ): LexServerAuthError {
    if (cause instanceof LexServerAuthError) return cause
    return new LexServerAuthError(cause.error, cause.message, wwwAuthenticate, {
      cause,
    })
  }
}
