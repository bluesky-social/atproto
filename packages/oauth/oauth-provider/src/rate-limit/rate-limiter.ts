export type RateLimiterOptions = {
  /**
   * Stable and unique identifier of the limiter. Implementations typically use
   * it to namespace their storage keys, so it must not change across deploys.
   */
  name: string
  points: number
  durationMs: number
}

export type RateLimiterConsumeResult = {
  /**
   * `points` minus the points consumed in the current window, including the
   * ones just consumed. Must **not** be clamped to `0`: a negative value means
   * that the limit was exceeded.
   */
  remainingPoints: number
  msBeforeNext: number
}

/**
 * Backend implementation of a fixed window rate limiter, provided by the host
 * through a {@link RateLimiterFactory}.
 *
 * Backend failures (e.g. storage unavailable) are the implementation's concern:
 * it may either throw, causing the request being processed to fail (fail
 * closed), or swallow the error and report the key as not limited (fail open).
 */
export interface RateLimiter {
  /**
   * Consumes `points` for `key`. This method must **not**
   * throw when the limit is exceeded; it must return a negative
   * `remainingPoints` instead.
   */
  consume(key: string, points: number): Promise<RateLimiterConsumeResult>
}

export type RateLimiterFactory = (options: RateLimiterOptions) => RateLimiter
