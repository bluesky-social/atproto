import * as fs from 'node:fs'
import { describe, expect, it, test } from 'vitest'
import {
  InvalidDatetimeError,
  ensureValidDatetime,
  isAtprotoDate,
  isValidDatetime,
  normalizeDatetime,
  normalizeDatetimeAlways,
  toDatetimeString,
} from '../src/datetime.js'

const interopValid = readLines(
  `${__dirname}/../../../interop-test-files/syntax/datetime_syntax_valid.txt`,
)
const interopInvalidSyntax = readLines(
  `${__dirname}/../../../interop-test-files/syntax/datetime_syntax_invalid.txt`,
)
const interopInvalidParse = readLines(
  `${__dirname}/../../../interop-test-files/syntax/datetime_parse_invalid.txt`,
)

describe(ensureValidDatetime, () => {
  describe('valid interop', () => {
    for (const dt of interopValid) {
      test(dt, () => {
        expect(() => ensureValidDatetime(dt)).not.toThrow()
      })
    }
  })

  describe('fails on interop (invalid syntax)', () => {
    for (const dt of interopInvalidSyntax) {
      test(dt, () => {
        expect(() => ensureValidDatetime(dt)).toThrow(InvalidDatetimeError)
      })
    }
  })

  describe('fails on interop (invalid parse)', () => {
    for (const dt of interopInvalidParse) {
      test(dt, () => {
        expect(() => ensureValidDatetime(dt)).toThrow(InvalidDatetimeError)
      })
    }
  })

  it('accepts boundary datetimes with offsets near year 0000', () => {
    expect(() => ensureValidDatetime('0000-01-01T00:00:00+23:59')).not.toThrow()
    expect(() => ensureValidDatetime('0000-01-01T00:00:00Z')).not.toThrow()
  })

  it('accepts boundary datetimes with offsets near year 9999', () => {
    expect(() =>
      ensureValidDatetime('9999-12-31T23:59:59.999-23:59'),
    ).not.toThrow()
    expect(() => ensureValidDatetime('9999-12-31T23:59:00-00:01')).not.toThrow()
  })

  it('accepts datetimes with years 0-9', () => {
    expect(() => ensureValidDatetime('0001-01-01T00:00:00Z')).not.toThrow()
    expect(() => ensureValidDatetime('0009-06-15T12:00:00Z')).not.toThrow()
  })

  it('accepts datetimes with fractional seconds', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:30:00.1Z')).not.toThrow()
    expect(() => ensureValidDatetime('2024-01-15T12:30:00.12Z')).not.toThrow()
    expect(() => ensureValidDatetime('2024-01-15T12:30:00.123Z')).not.toThrow()
    expect(() =>
      ensureValidDatetime('2024-01-15T12:30:00.123456789Z'),
    ).not.toThrow()
  })

  it('accepts datetimes with no fractional seconds', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:30:00Z')).not.toThrow()
  })

  it('accepts datetimes with positive and negative offsets', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:30:00+05:30')).not.toThrow()
    expect(() => ensureValidDatetime('2024-01-15T12:30:00-05:30')).not.toThrow()
    expect(() => ensureValidDatetime('2024-01-15T12:30:00+00:00')).not.toThrow()
  })

  it('rejects -00:00 offset', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:30:00-00:00')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects non-string input', () => {
    expect(() => ensureValidDatetime(123)).toThrow(InvalidDatetimeError)
    expect(() => ensureValidDatetime(null)).toThrow(InvalidDatetimeError)
    expect(() => ensureValidDatetime(undefined)).toThrow(InvalidDatetimeError)
  })

  it('rejects strings that are too long', () => {
    expect(() =>
      ensureValidDatetime('2024-01-15T12:30:00.' + '0'.repeat(50) + 'Z'),
    ).toThrow(InvalidDatetimeError)
  })

  it('rejects invalid month values', () => {
    expect(() => ensureValidDatetime('2024-00-15T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => ensureValidDatetime('2024-13-15T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects invalid day values', () => {
    expect(() => ensureValidDatetime('2024-01-00T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => ensureValidDatetime('2024-01-32T12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects invalid hour values', () => {
    expect(() => ensureValidDatetime('2024-01-15T24:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects invalid minute values', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:60:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects missing timezone', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:30:00')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects lowercase t separator', () => {
    expect(() => ensureValidDatetime('2024-01-15t12:30:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects lowercase z timezone', () => {
    expect(() => ensureValidDatetime('2024-01-15T12:30:00z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects date-only strings', () => {
    expect(() => ensureValidDatetime('2024-01-15')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('rejects empty string', () => {
    expect(() => ensureValidDatetime('')).toThrow(InvalidDatetimeError)
  })

  it('rejects leap second (not supported by Date parser)', () => {
    expect(() => ensureValidDatetime('2016-12-31T23:59:60Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('accepts Feb 29 in leap years', () => {
    expect(() => ensureValidDatetime('2024-02-29T00:00:00Z')).not.toThrow()
    expect(() => ensureValidDatetime('2000-02-29T00:00:00Z')).not.toThrow()
    expect(() => ensureValidDatetime('0400-02-29T00:00:00Z')).not.toThrow()
  })

  it('rejects Feb 29 in non-leap years', () => {
    expect(() => ensureValidDatetime('2023-02-29T00:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => ensureValidDatetime('1900-02-29T00:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
    expect(() => ensureValidDatetime('2100-02-29T00:00:00Z')).toThrow(
      InvalidDatetimeError,
    )
  })

  it('allows datetime that normalizes past year 9999 due to negative offset', () => {
    // 9999-12-31T23:59:00-00:01 is syntactically valid, but normalizing to
    // UTC advances it to 10000-01-01T00:00:00Z, which is out of range
    expect(() => ensureValidDatetime('9999-12-31T23:59:00-00:01')).not.toThrow(
      InvalidDatetimeError,
    )
  })
})

describe(isValidDatetime, () => {
  describe('valid interop', () => {
    for (const dt of interopValid) {
      test(dt, () => {
        expect(isValidDatetime(dt)).toBe(true)
      })
    }
  })

  describe('fails on interop (invalid syntax)', () => {
    for (const dt of interopInvalidSyntax) {
      test(dt, () => {
        expect(isValidDatetime(dt)).toBe(false)
      })
    }
  })

  describe('fails on interop (invalid parse)', () => {
    for (const dt of interopInvalidParse) {
      test(dt, () => {
        expect(isValidDatetime(dt)).toBe(false)
      })
    }
  })

  it('accepts boundary datetimes with offsets near year 0000', () => {
    expect(isValidDatetime('0000-01-01T00:00:00+23:59')).toBe(true)
    expect(isValidDatetime('0000-01-01T00:00:00+00:01')).toBe(true)
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
  describe('valid interop', () => {
    for (const dt of interopValid) {
      test(dt, () => {
        expect(() => normalizeDatetime(dt)).not.toThrow()
      })
    }
  })

  // @NOTE Normalize will actually succeed on some of the invalid syntax cases,
  // because it is more lenient than the regex validation.

  // describe('fails on interop (invalid syntax)', () => {
  //   for (const dt of interopInvalidSyntax) {
  //     test(dt, () => {
  //       expect(() => normalizeDatetime(dt)).toThrow(InvalidDatetimeError)
  //     })
  //   }
  // })

  describe('fails on interop (invalid parse)', () => {
    for (const dt of interopInvalidParse) {
      test(dt, () => {
        expect(() => normalizeDatetime(dt)).toThrow(InvalidDatetimeError)
      })
    }
  })

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
    expect(normalizeDatetime('2024-06-15T12:00:00')).toEqual(
      '2024-06-15T12:00:00.000Z',
    )
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

  it('normalizes datetimes with years 0-9', () => {
    expect(normalizeDatetime('0001-01-01T00:00:00+01:00')).toEqual(
      '0000-12-31T23:00:00.000Z',
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

  describe('datetime_syntax_valid.txt', () => {
    for (const dt of interopValid) {
      test(dt, () => {
        // @NOTE we can't test the returned value as some will normalize while others won't.
        expect(() => normalizeDatetimeAlways(dt)).not.toThrow()
      })
    }
  })

  describe('datetime_syntax_invalid.txt', () => {
    for (const dt of interopInvalidSyntax) {
      test(dt, () => {
        // @NOTE we can't test the returned value as some will normalize while others won't.
        expect(() => normalizeDatetimeAlways(dt)).not.toThrow()
      })
    }
  })

  describe('datetime_parse_invalid.txt', () => {
    for (const dt of interopInvalidParse) {
      test(dt, () => {
        expect(normalizeDatetimeAlways(dt)).toEqual('1970-01-01T00:00:00.000Z')
      })
    }
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
  describe('datetime_syntax_valid.txt', () => {
    for (const input of interopValid) {
      test(JSON.stringify(input), () => {
        expect(isValidDatetime(input)).toBe(true)
        expect(() => ensureValidDatetime(input)).not.toThrow()

        // Ensure that values round-trip through Date without throwing
        expect(() => toDatetimeString(new Date(input))).not.toThrow()
      })
    }
  })

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

  it('returns valid datetime strings that round-trip through ensureValidDatetime', () => {
    const dates = [
      new Date('2024-06-15T12:00:00Z'),
      new Date('0000-01-01T00:00:00Z'),
      new Date('9999-12-31T23:59:59.999Z'),
    ]
    for (const date of dates) {
      const str = toDatetimeString(date)
      expect(() => ensureValidDatetime(str)).not.toThrow()
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
