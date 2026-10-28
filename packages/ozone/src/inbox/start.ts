import { type DatetimeString, currentDatetimeString } from '@atproto/lex'

/** Keep a future cutover closed even if stored source rows have future dates. */
export function inboxHasStarted(startAt?: DatetimeString): boolean {
  return !startAt || currentDatetimeString() >= startAt
}
