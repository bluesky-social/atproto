import { OAuthError } from './oauth-error.js'

export class UnknownAtprotoAccountError extends OAuthError {
  constructor(
    public readonly identifier: string,
    public readonly issuer: string | undefined,
    cause?: unknown,
  ) {
    super(
      'unknown_atproto_account_error',
      issuer
        ? `Atmosphere account ${identifier} is hosted on ${issuer}`
        : `Unknown Atmosphere identity ${identifier}`,
      404,
      cause,
    )
  }

  toJSON() {
    return {
      ...super.toJSON(),
      identifier: this.identifier,
      issuer: this.issuer,
    } as const
  }
}
