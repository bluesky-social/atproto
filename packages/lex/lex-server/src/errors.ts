import { LexError, LexErrorCode } from '@atproto/lex-data'
import {
  WWWAuthenticate,
  formatWWWAuthenticateHeader,
} from './lib/www-authenticate.js'

export type { WWWAuthenticate }

export class LexServerAuthError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'LexServerAuthError'

  constructor(
    error: N,
    message: string,
    readonly wwwAuthenticate: WWWAuthenticate = {},
    options?: ErrorOptions,
  ) {
    super(error, message, options)
  }

  get wwwAuthenticateHeader(): string {
    return formatWWWAuthenticateHeader(this.wwwAuthenticate)
  }

  toJSON() {
    const { cause } = this
    return cause instanceof LexError ? cause.toJSON() : super.toJSON()
  }

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
