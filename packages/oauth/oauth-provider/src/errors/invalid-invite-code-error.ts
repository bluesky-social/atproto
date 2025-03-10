import { InvalidRequestError } from './invalid-request-error'

export class InvalidInviteCodeError extends InvalidRequestError {
  constructor(details?: string, cause?: unknown) {
    super(
      'This invite code is invalid.' + (details ? ` ${details}` : ''),
      cause,
    )
  }
}
