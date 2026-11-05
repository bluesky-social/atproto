import { Plural, Trans } from '@lingui/react/macro'
import {
  ErrorNotice,
  type ErrorNoticeProps,
} from '#/components/feedback/error-notice.tsx'
import type { RateLimitExceededError } from '#/lib/api.ts'
import type { Override } from '#/lib/util.ts'

export type RetryAfterNoticeProps = Override<
  ErrorNoticeProps,
  {
    error: RateLimitExceededError
    /** Number of seconds left before retrying. */
    remaining: number
  }
>

/**
 * A rate limit error, along with how long to wait before retrying (when the
 * server told).
 */
export function RetryAfterNotice({
  remaining,
  error,
  ...props
}: RetryAfterNoticeProps) {
  return (
    <ErrorNotice {...props} error={error}>
      {error.retryAfter != null && (
        <p>
          {remaining > 0 ? (
            <Plural
              value={remaining}
              one="Please try again in # second."
              other="Please try again in # seconds."
            />
          ) : (
            <Trans>You can try again now.</Trans>
          )}
        </p>
      )}
    </ErrorNotice>
  )
}
