import { LexError, LexErrorCode, LexErrorData } from '@atproto/lex-data'
import {
  WWWAuthenticate,
  formatWWWAuthenticateHeader,
} from './lib/www-authenticate.js'

export { LexError }
export type { LexErrorCode, LexErrorData, WWWAuthenticate }

/**
 * Base error class for representing errors responses in LexRouter handlers.
 */
export class LexResponseError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'LexResponseError'

  readonly headers?: Headers

  constructor(
    readonly status: number,
    readonly body: LexErrorData<N>,
    options?: ErrorOptions & { headers?: Headers },
  ) {
    super(body.error, body.message, options)
    this.headers = options?.headers
  }

  override toJSON(): LexErrorData<N> {
    return this.body
  }

  override toDownstreamError() {
    return {
      status: this.status,
      headers: this.headers,
      data: this.toJSON(),
    }
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
> extends LexResponseError<N> {
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
    const body: LexErrorData<N> = { error, message }
    super(401, body, {
      ...options,
      headers: new Headers({
        'WWW-Authenticate': formatWWWAuthenticateHeader(wwwAuthenticate),
        'Access-Control-Expose-Headers': 'WWW-Authenticate', // CORS
      }),
    })
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
