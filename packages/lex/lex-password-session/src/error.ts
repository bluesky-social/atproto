import { LexError, LexRpcResponseError } from '@atproto/lex-client'
import { com } from './lexicons'

export type AuthFactorTokenRequiredResponse = LexRpcResponseError<
  typeof com.atproto.server.createSession.main
>

export class AuthFactorTokenError extends LexError {
  name = 'AuthFactorTokenError'

  constructor(readonly cause: AuthFactorTokenRequiredResponse) {
    super(cause.error, cause.message, { cause })
  }
}
