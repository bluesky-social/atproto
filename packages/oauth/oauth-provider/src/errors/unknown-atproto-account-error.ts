import { OAuthError } from './oauth-error.js'

export class UnknownAtprotoAccountError extends OAuthError {
  constructor(
    public readonly identifier: string,
    public readonly issuer: string | undefined,
    description: string = issuer
      ? `Atmosphere account ${identifier} is hosted on ${issuer}`
      : `Unknown Atmosphere identity ${identifier}`,
    cause?: unknown,
  ) {
    super('unknown_atproto_account_error', description, 404, cause)
  }

  toJSON() {
    return {
      ...super.toJSON(),
      identifier: this.identifier,
      issuer: this.issuer,
    } as const
  }
}
