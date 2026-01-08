import { LexError, LexRpcResponseError } from '@atproto/lex-client'
import { com } from './lexicons'

export class AuthFactorTokenError extends LexError {
  name = 'AuthFactorTokenError'

  constructor(
    readonly response: LexRpcResponseError<
      typeof com.atproto.server.createSession.main
    >,
  ) {
    super(response.error, response.message, { cause: response.reason })
  }
}
