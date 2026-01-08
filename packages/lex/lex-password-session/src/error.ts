import { LexError, LexRpcResponseError } from '@atproto/lex-client'
import { com } from './lexicons'

export class LexAuthFactorError extends LexError {
  name = 'LexAuthFactorError'

  constructor(
    readonly response: LexRpcResponseError<
      typeof com.atproto.server.createSession.main
    >,
  ) {
    super(response.error, response.message, { cause: response.reason })
  }
}
