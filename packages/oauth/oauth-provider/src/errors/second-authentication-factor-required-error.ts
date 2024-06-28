import { OAuthError } from './oauth-error.js'

export class SecondAuthenticationFactorRequiredError extends OAuthError {
  constructor(
    public type: 'emailOtp',
    public hint: string,
    cause?: unknown,
  ) {
    const error = 'second_authentication_factor_required'
    super(
      error,
      `${type} authentication factor required (hint: ${hint})`,
      401,
      cause,
    )
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      hint: this.hint,
    } as const
  }
}
