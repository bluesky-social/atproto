import { LexError, LexErrorCode } from '@atproto/lex-data'

export type WWWAuthenticate = {
  [authScheme in string]?:
    | string // token68
    | { [authParam in string]?: string }
}

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
    return Object.entries(this.wwwAuthenticate)
      .map(([authScheme, authParams]) => {
        if (authParams === undefined) return null
        const paramsEnc =
          typeof authParams === 'string'
            ? [authParams]
            : Object.entries(authParams)
                .filter(([_, val]) => val != null)
                .map(([name, val]) => `${name}=${JSON.stringify(val)}`)
        const authChallenge = paramsEnc?.length
          ? `${authScheme} ${paramsEnc.join(', ')}`
          : authScheme
        return authChallenge
      })
      .filter(Boolean)
      .join(', ')
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
