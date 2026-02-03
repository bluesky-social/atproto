import { LexError, XrpcResponseError } from '@atproto/lex-client'
import { com } from './lexicons'

export class LexAuthFactorError extends LexError {
  name = 'LexAuthFactorError'

  constructor(
    readonly response: XrpcResponseError<
      typeof com.atproto.server.createSession.main
    >,
  ) {
    super(response.error, response.message, { cause: response.reason })
  }
}
