import { OAuthError } from './oauth-error.js'

/**
 * The request's hCaptcha token failed verification (e.g. it expired, its score
 * was too high, or hCaptcha could not be reached): the request must be retried
 * with a new token.
 */
export class CaptchaRejectedError extends OAuthError {
  name = 'CaptchaRejectedError'

  constructor(
    error_description = 'hCaptcha verification failed',
    cause?: unknown,
  ) {
    super('captcha_rejected', error_description, 400, cause)
  }

  static from(err: unknown, message?: string): OAuthError {
    if (err instanceof OAuthError) return err
    return new CaptchaRejectedError(message, err)
  }
}
