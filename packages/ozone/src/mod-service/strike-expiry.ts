import assert from 'node:assert'
import { DAY } from '@atproto/common'
import { type DatetimeString, toDatetimeString } from '@atproto/lex'

export function validExpiryDays(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 36500
  )
}

export function parseStrikeExpiryDays(value?: string): number | undefined {
  if (value === undefined) return undefined
  const days = Number(value)
  assert(
    /^\d+$/.test(value) && validExpiryDays(days),
    'OZONE_STRIKE_EXPIRY_DAYS must be an integer between 1 and 36500',
  )
  return days
}

export function expiryAfterDays(
  createdAt: DatetimeString,
  days: number,
): DatetimeString {
  const expiry = new Date(Date.parse(createdAt) + days * DAY)
  assert(
    Number.isFinite(expiry.getTime()) && expiry.getUTCFullYear() <= 9999,
    'Strike expiry exceeds the supported date range',
  )
  return toDatetimeString(expiry)
}
