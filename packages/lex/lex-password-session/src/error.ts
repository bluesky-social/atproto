import { LexRpcError, LexRpcResponseError } from '@atproto/lex-client'
import { com } from './lexicons'

export type AuthFactorTokenRequiredResponse = LexRpcResponseError<
  typeof com.atproto.server.createSession.main
>

export class AuthFactorTokenRequiredError extends LexRpcError<'AuthFactorTokenRequired'> {
  name = 'AuthFactorTokenRequiredError'

  constructor(readonly cause: AuthFactorTokenRequiredResponse) {
    super('AuthFactorTokenRequired', cause.message, { cause })
  }
}
