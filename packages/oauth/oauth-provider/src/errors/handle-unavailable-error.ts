import type { HandleUnavailableReason } from '@atproto/oauth-provider-api'
import { OAuthError } from './oauth-error.js'

// @TODO this is *not* and "OAuthError" error but rather an ApiError.

export type { HandleUnavailableReason }

export class HandleUnavailableError extends OAuthError {
  constructor(
    readonly reason: HandleUnavailableReason,
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
