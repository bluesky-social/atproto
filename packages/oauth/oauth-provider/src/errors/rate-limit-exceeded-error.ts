import { OAuthError } from './oauth-error.js'

export class RateLimitExceededError extends OAuthError {
  name = 'RateLimitExceededError'

  /**
   * Number of seconds after which the request may be retried, suitable for use
   * as `Retry-After` header value.
   */
  public readonly retryAfter: number

  constructor(
    msBeforeNext: number,
    error_description = 'Too many requests, please try again later',
    cause?: unknown,
  ) {
    super('rate_limit_exceeded', error_description, 429, cause)
    this.retryAfter = Math.max(0, Math.ceil(msBeforeNext / 1e3))
  }

  *getResponseHeaders(): Generator<[name: string, val: string], void, unknown> {
    yield* super.getResponseHeaders()

    // https://datatracker.ietf.org/doc/html/rfc9126#section-2.3
    yield ['Retry-After', String(this.retryAfter)]
  }
}
