import { LexError, XrpcFailure } from '@atproto/lex-client'

export class LexAuthFactorError extends LexError {
  name = 'LexAuthFactorError'

  constructor(readonly cause: XrpcFailure) {
    super(cause.error, cause.message ?? 'Auth factor token required', { cause })
  }

  override toResponse(): Response {
    return Response.json({ error: 'InternalServerError' }, { status: 500 })
  }
}
