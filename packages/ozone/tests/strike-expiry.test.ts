import { toDatetimeString } from '@atproto/lex'
import {
  expiryAfterDays,
  parseStrikeExpiryDays,
} from '../src/mod-service/strike-expiry.js'

describe('strike expiry duration', () => {
  it.each(['0', '-1', '180.5', '180days', '', 'Infinity', '36501'])(
    'rejects invalid environment value %s',
    (value) => {
      expect(() => parseStrikeExpiryDays(value)).toThrow(
        'OZONE_STRIKE_EXPIRY_DAYS',
      )
    },
  )

  it('accepts 365 and 180, defaults to severity durations, and uses exact UTC days', () => {
    expect(parseStrikeExpiryDays()).toBeUndefined()
    expect(parseStrikeExpiryDays('365')).toBe(365)
    expect(parseStrikeExpiryDays('180')).toBe(180)
    expect(
      expiryAfterDays(toDatetimeString('2025-01-01T00:00:00.000Z'), 180),
    ).toBe('2025-06-30T00:00:00.000Z')
    expect(
      expiryAfterDays(toDatetimeString('2025-01-01T00:00:00.000Z'), 365),
    ).toBe('2026-01-01T00:00:00.000Z')
  })
})
