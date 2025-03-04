import { OAuthError } from './oauth-error.js'

export class HandleUnavailableError extends OAuthError {
  constructor(
    readonly reason: 'syntax' | 'domain' | 'slur' | 'taken',
    details: string = 'That handle is not available',
    cause?: unknown,
  ) {
    super('handle_unavailable', details, 400, cause)
  }

  toJSON() {
    return {
      ...super.toJSON(),
      reason: this.reason,
    } as const
  }
}
