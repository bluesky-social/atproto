import { OAuthError } from './oauth-error.js'

/**
 * The request carried no hCaptcha token: it must be retried with one.
 */
export class CaptchaRequiredError extends OAuthError {
  name = 'CaptchaRequiredError'

  constructor(
    error_description = 'Captcha verification required',
    cause?: unknown,
  ) {
    super('captcha_required', error_description, 400, cause)
  }
}
