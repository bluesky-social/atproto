import { LexError, LexErrorCode } from '@atproto/lex-data'

export type WWWAuthenticate = { [k: string]: Record<string, string> }
export function formatWWWAuthenticate(
  wwwAuthenticate: WWWAuthenticate,
): string {
  return Object.entries(wwwAuthenticate)
    .map(([type, params]) => {
      if (!params) return null
      const paramsEnc = Object.entries(params)
        .filter(([_, val]) => val != null)
        .map(([name, val]) => `${name}=${JSON.stringify(val)}`)
      return paramsEnc?.length ? `${type} ${paramsEnc.join(', ')}` : type
    })
    .filter(Boolean)
    .join(', ')
}

export class LexAuthError<
  N extends LexErrorCode = LexErrorCode,
> extends LexError<N> {
  name = 'LexAuthError'

  constructor(
    error: N,
    message: string,
    readonly wwwAuthenticate?: WWWAuthenticate,
    options?: ErrorOptions,
  ) {
    super(error, message, options)
  }

  get wwwAuthenticateHeader(): string {
    return formatWWWAuthenticate(this.wwwAuthenticate ?? {})
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

  static from(cause: LexError): LexAuthError {
    if (cause instanceof LexAuthError) return cause
    return new LexAuthError(cause.error, cause.message, undefined, { cause })
  }
}
