import {
  WWWAuthenticate,
  WWWAuthenticateParams,
  WWWAuthenticateError,
} from './www-authenticate-error.js'

export type { WWWAuthenticate, WWWAuthenticateParams }

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc6750.html}
 * @see {@link https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1}
 */
export class UnauthorizedError extends WWWAuthenticateError {
  constructor(
    error_description: string,
    wwwAuthenticate: WWWAuthenticate,
    cause?: unknown,
  ) {
    super('unauthorized', error_description, 401, wwwAuthenticate, cause)
  }
}
