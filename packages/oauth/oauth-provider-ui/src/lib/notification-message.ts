import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { parseError } from '#/lib/error-parser.ts'

export type NotificationVariant = 'success' | 'warning' | 'error' | 'info'

export type NotificationMessage = {
  variant: NotificationVariant
  title: string | MessageDescriptor
  description?: string | MessageDescriptor
}

/**
 * Maps a caught error onto the fields a notification needs.
 *
 * @NOTE The precedence below is load-bearing and was moved here verbatim from
 * the notifications context: a description produced by the error parsers wins
 * over a caller-supplied one, because the parser's version is the typed,
 * user-facing OAuth message while the caller's is only a generic fallback.
 */
export function errorToNotification(
  err: unknown,
  overrides?: Partial<NotificationMessage>,
): NotificationMessage {
  const { description, message } = apiErrorParser(err) ?? parseError(err)

  return {
    variant: overrides?.variant ?? 'error',
    title: overrides?.title ?? msg`An error occurred`,
    description: description ?? overrides?.description ?? message,
  }
}
