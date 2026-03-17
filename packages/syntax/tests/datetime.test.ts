import * as fs from 'node:fs'
import { describe, expect, it, test } from 'vitest'
import {
  InvalidDatetimeError,
  assertDatetimeString,
  isAtprotoDate,
  isValidDatetime,
  normalizeDatetime,
  normalizeDatetimeAlways,
  toDatetimeString,
} from '../src/datetime.js'

describe('interop', () => {
  describe('datetime_syntax_valid.txt', () => {
    for (const input of readLines(
      `${__dirname}/../../../interop-test-files/syntax/datetime_syntax_valid.txt`,
    )) {
      test(JSON.stringify(input), () => {
        expect(isValidDatetime(input)).toBe(true)
        expect(() => assertDatetimeString(input)).not.toThrow()

        // Ensure that values round-trip through Date without throwing
        expect(() => toDatetimeString(new Date(input))).not.toThrow()
      })
    }
  })

  describe('datetime_syntax_invalid.txt', () => {
    for (const input of readLines(
      `${__dirname}/../../../interop-test-files/syntax/datetime_syntax_invalid.txt`,
    )) {
      test(JSON.stringify(input), () => {
        expect(isValidDatetime(input)).toBe(false)
        expect(() => assertDatetimeString(input)).toThrow(InvalidDatetimeError)
      })
    }
  })

  describe('datetime_parse_invalid.txt', () => {
    for (const input of readLines(
      `${__dirname}/../../../interop-test-files/syntax/datetime_parse_invalid.txt`,
    )) {
      test(JSON.stringify(input), () => {
        expect(isValidDatetime(input)).toBe(false)
        expect(() => assertDatetimeString(input)).toThrow(InvalidDatetimeError)
      })
    }
  })
})

describe(assertDatetimeString, () => {
  it('accepts boundary datetimes with offsets near year 0000', () => {
    expect(() =>
      assertDatetimeString('0000-01-01T00:00:00+23:59'),
    ).not.toThrow()
    expect(() => assertDatetimeString('0000-01-01T00:00:00Z')).not.toThrow()
  })

  it('accepts boundary datetimes with offsets near year 9999', () => {
    expect(() =>
      assertDatetimeString('9999-12-31T23:59:59.999-23:59'),
    ).not.toThrow()
    expect(() =>
      assertDatetimeString('9999-12-31T23:59:00-00:01'),
    ).not.toThrow()
  })

  it('accepts datetimes with years 0-9', () => {
    expect(() => assertDatetimeString('0001-01-01T00:00:00Z')).not.toThrow()
    expect(() => assertDatetimeString('0009-06-15T12:00:00Z')).not.toThrow()
  })

  it('accepts datetimes with fractional seconds', () => {
    expect(() => assertDatetimeString('2024-01-15T12:30:00.1Z')).not.toThrow()
    expect(() => assertDatetimeString('2024-01-15T12:30:00.12Z')).not.toThrow()
    expect(() => assertDatetimeString('2024-01-15T12:30:00.123Z')).not.toThrow()
    expect(() =>
      assertDatetimeString('2024-01-15T12:30:00.123456789Z'),
    ).not.toThrow()
  })

  it('accepts datetimes with no fractional seconds', () => {
    expect(() => assertDatetimeString('2024-01-15T12:30:00Z')).not.toThrow()
  })

  it('accepts datetimes with positive and negative offsets', () => {
    expect(() =>
      assertDatetimeString('2024-01-15T12:30:00+05:30'),
    ).not.toThrow()
    expect(() =>
      assertDatetimeString('2024-01-15T12:30:00-05:30'),
    ).not.toThrow()
    expect(() =>
      assertDatetimeString('2024-01-15T12:30:00+00:00'),
    ).not.toThrow()
  })

  it('rejects -00:00 offset', () => {
    expect(() => assertDatetimeString('2024-01-15T12:30:00-00:00')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects non-string input', () => {
    expect(() => assertDatetimeString(123)).toThrow(InvalidDatetimeError)
    expect(() => assertDatetimeString(null)).toThrow(InvalidDatetimeError)
    expect(() => assertDatetimeString(undefined)).toThrow(InvalidDatetimeError)
  })

  it('rejects strings that are too long', () => {
    expect(() =>
      assertDatetimeString('2024-01-15T12:30:00.' + '0'.repeat(50) + 'Z'),
    ).toThrow(InvalidDatetimeError)
  })

  it('rejects invalid month values', () => {
    expect(() => assertDatetimeString('2024-00-15T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => assertDatetimeString('2024-13-15T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects invalid day values', () => {
    expect(() => assertDatetimeString('2024-01-00T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => assertDatetimeString('2024-01-32T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects invalid hour values', () => {
    expect(() => assertDatetimeString('2024-01-15T24:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects invalid minute values', () => {
    expect(() => assertDatetimeString('2024-01-15T12:60:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects missing timezone', () => {
    expect(() => assertDatetimeString('2024-01-15T12:30:00')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects lowercase t separator', () => {
    expect(() => assertDatetimeString('2024-01-15t12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects lowercase z timezone', () => {
    expect(() => assertDatetimeString('2024-01-15T12:30:00z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects date-only strings', () => {
    expect(() => assertDatetimeString('2024-01-15')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects empty string', () => {
    expect(() => assertDatetimeString('')).toThrow(InvalidDatetimeError)
  })

  it('rejects leap second (not supported by Date parser)', () => {
    expect(() => assertDatetimeString('2016-12-31T23:59:60Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('accepts Feb 29 in leap years', () => {
    expect(() => assertDatetimeString('2024-02-29T00:00:00Z')).not.toThrow()
    expect(() => assertDatetimeString('2000-02-29T00:00:00Z')).not.toThrow()
    expect(() => assertDatetimeString('0400-02-29T00:00:00Z')).not.toThrow()
  })

  it('rejects Feb 29 in non-leap years', () => {
    expect(() => assertDatetimeString('2023-02-29T00:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => assertDatetimeString('1900-02-29T00:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => assertDatetimeString('2100-02-29T00:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })
})

describe(isValidDatetime, () => {
  it('accepts boundary datetimes with offsets near year 0000', () => {
    expect(isValidDatetime('0000-01-01T00:00:00+23:59')).toBe(true)
    expect(isValidDatetime('0000-01-01T00:00:00Z')).toBe(true)
  })

  it('accepts boundary datetimes with offsets near year 9999', () => {
    expect(isValidDatetime('9999-12-31T23:59:59.999-23:59')).toBe(true)
    expect(isValidDatetime('9999-12-31T23:59:00-00:01')).toBe(true)
  })

  it('accepts datetimes with years 0-9', () => {
    expect(isValidDatetime('0001-01-01T00:00:00Z')).toBe(true)
    expect(isValidDatetime('0009-06-15T12:00:00Z')).toBe(true)
  })

  it('accepts typical datetimes', () => {
    expect(isValidDatetime('2024-06-15T08:30:00Z')).toBe(true)
    expect(isValidDatetime('1970-01-01T00:00:00Z')).toBe(true)
    expect(isValidDatetime('2000-02-29T12:00:00Z')).toBe(true)
  })

  it('accepts datetimes with fractional seconds', () => {
    expect(isValidDatetime('2024-01-15T12:30:00.5Z')).toBe(true)
    expect(isValidDatetime('2024-01-15T12:30:00.123456Z')).toBe(true)
  })

  it('accepts datetimes with timezone offsets', () => {
    expect(isValidDatetime('2024-01-15T12:30:00+05:30')).toBe(true)
    expect(isValidDatetime('2024-01-15T12:30:00-12:00')).toBe(true)
    expect(isValidDatetime('2024-01-15T12:30:00+00:00')).toBe(true)
  })

  it('rejects -00:00 offset', () => {
    expect(isValidDatetime('2024-01-15T12:30:00-00:00')).toBe(false)
  })

  it('rejects missing timezone', () => {
    expect(isValidDatetime('2024-01-15T12:30:00')).toBe(false)
  })

  it('rejects non-datetime strings', () => {
    expect(isValidDatetime('')).toBe(false)
    expect(isValidDatetime('not a date')).toBe(false)
    expect(isValidDatetime('2024-01-15')).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(isValidDatetime(42)).toBe(false)
    expect(isValidDatetime(null)).toBe(false)
    expect(isValidDatetime(undefined)).toBe(false)
  })

  it('rejects day 32 and day 00', () => {
    expect(isValidDatetime('2024-01-32T00:00:00Z')).toBe(false)
    expect(isValidDatetime('2024-01-00T00:00:00Z')).toBe(false)
  })

  it('accepts Feb 29 in leap years', () => {
    // Divisible by 4 (common leap year)
    expect(isValidDatetime('2024-02-29T00:00:00Z')).toBe(true)
    // Divisible by 400 (century leap year)
    expect(isValidDatetime('2000-02-29T00:00:00Z')).toBe(true)
    expect(isValidDatetime('0400-02-29T00:00:00Z')).toBe(true)
  })

  it('rejects Feb 29 in non-leap years', () => {
    // Not divisible by 4
    expect(isValidDatetime('2023-02-29T00:00:00Z')).toBe(false)
    // Divisible by 100 but not 400
    expect(isValidDatetime('1900-02-29T00:00:00Z')).toBe(false)
    expect(isValidDatetime('2100-02-29T00:00:00Z')).toBe(false)
  })

  it('rejects lowercase t and z', () => {
    expect(isValidDatetime('2024-01-15t12:30:00Z')).toBe(false)
    expect(isValidDatetime('2024-01-15T12:30:00z')).toBe(false)
  })

  it('rejects space separator', () => {
    expect(isValidDatetime('2024-01-15 12:30:00Z')).toBe(false)
  })
})

describe(normalizeDatetime, () => {
  it('normalizes valid input', () => {
    expect(normalizeDatetime('1234-04-12T23:20:50Z')).toEqual(
      '1234-04-12T23:20:50.000Z',
    )
    expect(normalizeDatetime('1985-04-12T23:20:50Z')).toEqual(
      '1985-04-12T23:20:50.000Z',
    )
    expect(normalizeDatetime('1985-04-12T23:20:50.123')).toEqual(
      '1985-04-12T23:20:50.123Z',
    )
    expect(normalizeDatetime('1985-04-12 23:20:50.123')).toEqual(
      '1985-04-12T23:20:50.123Z',
    )
    expect(normalizeDatetime('1985-04-12T10:20:50.1+01:00')).toEqual(
      '1985-04-12T09:20:50.100Z',
    )
    expect(normalizeDatetime('Fri, 02 Jan 1999 12:34:56 GMT')).toEqual(
      '1999-01-02T12:34:56.000Z',
    )
  })

  it('normalizes datetimes with years 0-9', () => {
    expect(normalizeDatetime('0001-01-01T00:00:00+01:00')).toEqual(
      '0000-12-31T23:00:00.000Z',
    )
    expect(normalizeDatetime('0009-06-15T12:00:00Z')).toEqual(
      '0009-06-15T12:00:00.000Z',
    )
  })

  it('normalizes to millisecond precision with trailing Z', () => {
    expect(normalizeDatetime('2024-06-15T12:00:00Z')).toEqual(
      '2024-06-15T12:00:00.000Z',
    )
    expect(normalizeDatetime('2024-06-15T12:00:00.1Z')).toEqual(
      '2024-06-15T12:00:00.100Z',
    )
    expect(normalizeDatetime('2024-06-15T12:00:00.12Z')).toEqual(
      '2024-06-15T12:00:00.120Z',
    )
    expect(normalizeDatetime('2024-06-15T12:00:00.123Z')).toEqual(
      '2024-06-15T12:00:00.123Z',
    )
  })

  it('converts timezone offsets to UTC', () => {
    expect(normalizeDatetime('2024-06-15T12:00:00+05:30')).toEqual(
      '2024-06-15T06:30:00.000Z',
    )
    expect(normalizeDatetime('2024-06-15T00:00:00-08:00')).toEqual(
      '2024-06-15T08:00:00.000Z',
    )
  })

  it('normalizes datetime strings missing timezone', () => {
    // Without a timezone suffix, new Date() parses as local time first;
    // only if that fails does normalizeDatetime append Z and retry.
    // So we just verify it returns *something* valid rather than throwing.
    const result = normalizeDatetime('2024-06-15T12:00:00')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('normalizes epoch', () => {
    expect(normalizeDatetime('1970-01-01T00:00:00Z')).toEqual(
      '1970-01-01T00:00:00.000Z',
    )
  })

  it('throws on invalid input', () => {
    expect(() => normalizeDatetime('')).toThrow(InvalidDatetimeError)
    expect(() => normalizeDatetime('blah')).toThrow(InvalidDatetimeError)
    expect(() => normalizeDatetime('1999-19-39T23:20:50.123Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => normalizeDatetime('-000001-12-31T23:00:00.000Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => normalizeDatetime('0000-01-01T00:00:00+01:00')).toThrow(
      InvalidDatetimeError,
    )
    // 9999-12-31T23:59:00-00:01 normalizes to year 10000, out of isAtprotoDate range
    expect(() => normalizeDatetime('9999-12-31T23:59:00-00:01')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('throws on strings with trailing timezone suffix that are not parseable', () => {
    expect(() => normalizeDatetime('not-a-date GMT')).toThrow(
      InvalidDatetimeError,
    )
  })
})

describe(normalizeDatetimeAlways, () => {
  it('normalizes valid input', () => {
    expect(normalizeDatetimeAlways('1985-04-12T23:20:50Z')).toEqual(
      '1985-04-12T23:20:50.000Z',
    )
  })

  it('normalizes valid input with offsets', () => {
    expect(normalizeDatetimeAlways('2024-06-15T12:00:00+05:30')).toEqual(
      '2024-06-15T06:30:00.000Z',
    )
  })

  it('normalizes valid input without timezone', () => {
    const result = normalizeDatetimeAlways('2024-06-15T12:00:00')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('normalizes invalid input to epoch', () => {
    expect(normalizeDatetimeAlways('blah')).toEqual('1970-01-01T00:00:00.000Z')
    expect(normalizeDatetimeAlways('0000-01-01T00:00:00+01:00')).toEqual(
      '1970-01-01T00:00:00.000Z',
    )
    expect(normalizeDatetimeAlways('')).toEqual('1970-01-01T00:00:00.000Z')
    expect(normalizeDatetimeAlways('9999-12-31T23:59:00-00:01')).toEqual(
      '1970-01-01T00:00:00.000Z',
    )
  })

  it('always returns a string ending with Z', () => {
    const result = normalizeDatetimeAlways('anything invalid')
    expect(result).toMatch(/Z$/)
  })
})

describe(isAtprotoDate, () => {
  it('accepts years 0-9', () => {
    expect(isAtprotoDate(new Date('0000-01-01T00:00:00Z'))).toBe(true)
    expect(isAtprotoDate(new Date('0001-01-01T00:00:00Z'))).toBe(true)
    expect(isAtprotoDate(new Date('0009-06-15T12:00:00Z'))).toBe(true)
  })

  it('accepts year 0000', () => {
    expect(isAtprotoDate(new Date('0000-01-01T00:00:00Z'))).toBe(true)
  })

  it('accepts typical dates', () => {
    expect(isAtprotoDate(new Date('2024-06-15T12:00:00Z'))).toBe(true)
    expect(isAtprotoDate(new Date('1970-01-01T00:00:00Z'))).toBe(true)
  })

  it('accepts year 9999 boundary', () => {
    expect(isAtprotoDate(new Date('9999-12-31T23:59:59.999Z'))).toBe(true)
  })

  it('accepts dates constructed from timestamps', () => {
    expect(isAtprotoDate(new Date(0))).toBe(true)
    expect(isAtprotoDate(new Date(1718452800000))).toBe(true)
  })

  it('rejects negative years', () => {
    expect(isAtprotoDate(new Date('-000001-01-01T00:00:00Z'))).toBe(false)
  })

  it('rejects years past 9999', () => {
    expect(isAtprotoDate(new Date('+010000-01-01T00:00:00Z'))).toBe(false)
  })

  it('rejects invalid dates', () => {
    expect(isAtprotoDate(new Date('invalid'))).toBe(false)
    expect(isAtprotoDate(new Date(NaN))).toBe(false)
  })
})

describe(toDatetimeString, () => {
  it('converts normal dates', () => {
    expect(toDatetimeString(new Date('2024-01-15T12:30:00Z'))).toEqual(
      '2024-01-15T12:30:00.000Z',
    )
  })

  it('preserves milliseconds', () => {
    expect(toDatetimeString(new Date('2024-01-15T12:30:00.456Z'))).toEqual(
      '2024-01-15T12:30:00.456Z',
    )
  })

  it('pads milliseconds to 3 digits', () => {
    expect(toDatetimeString(new Date(0))).toEqual('1970-01-01T00:00:00.000Z')
  })

  it('converts epoch date', () => {
    expect(toDatetimeString(new Date(0))).toEqual('1970-01-01T00:00:00.000Z')
  })

  it('converts date from timestamp', () => {
    expect(toDatetimeString(new Date(1718452800000))).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
  })

  it('handles dates near year 0000 boundary with positive offset', () => {
    // Date that is before 0000-01-01T00:00:00Z in UTC but representable with a positive offset
    const date = new Date('-000001-12-31T23:00:00Z')
    expect(toDatetimeString(date)).toEqual('0000-01-01T00:00:00.000+01:00')
  })

  it('handles the exact start of year 0000 in UTC', () => {
    const date = new Date('0000-01-01T00:00:00Z')
    expect(toDatetimeString(date)).toEqual('0000-01-01T00:00:00.000Z')
  })

  it('handles the exact end of year 9999 in UTC', () => {
    const date = new Date('9999-12-31T23:59:59.999Z')
    expect(toDatetimeString(date)).toEqual('9999-12-31T23:59:59.999Z')
  })

  it('handles dates near year 9999 boundary with negative offset', () => {
    expect(toDatetimeString(new Date('9999-12-31T23:59:59.999-01:00'))).toEqual(
      '9999-12-31T23:59:59.999-01:00',
    )

    expect(toDatetimeString(new Date('9999-12-31T23:59:59.999-23:59'))).toEqual(
      '9999-12-31T23:59:59.999-23:59',
    )
  })

  it('returns valid datetime strings that round-trip through assertDatetimeString', () => {
    const dates = [
      new Date('2024-06-15T12:00:00Z'),
      new Date('0000-01-01T00:00:00Z'),
      new Date('9999-12-31T23:59:59.999Z'),
    ]
    for (const date of dates) {
      const str = toDatetimeString(date)
      expect(() => assertDatetimeString(str)).not.toThrow()
    }
  })

  it('throws for dates too far in the past', () => {
    expect(() => toDatetimeString(new Date('-000001-01-01T00:00:00Z'))).toThrow(
      InvalidDatetimeError,
    )
  })

  it('throws for dates too far in the future', () => {
    expect(() => toDatetimeString(new Date('+010000-06-01T00:00:00Z'))).toThrow(
      InvalidDatetimeError,
    )

    // 1ms too late
    expect(() =>
      toDatetimeString(
        new Date(new Date('9999-12-31T23:59:59.999-23:59').getTime() + 1),
      ),
    ).toThrow(InvalidDatetimeError)
  })

  it('throws for invalid dates', () => {
    expect(() => toDatetimeString(new Date('invalid'))).toThrow(
      InvalidDatetimeError,
    )
    expect(() => toDatetimeString(new Date(NaN))).toThrow(InvalidDatetimeError)
  })
})

function readLines(filePath: string): string[] {
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}
