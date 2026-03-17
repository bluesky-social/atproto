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
} from '../src'

const interopValid = readLines(
  `${__dirname}/interop-files/datetime_syntax_valid.txt`,
)
const interopInvalidSyntax = readLines(
  `${__dirname}/interop-files/datetime_syntax_invalid.txt`,
)
const interopInvalidParse = readLines(
  `${__dirname}/interop-files/datetime_parse_invalid.txt`,
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

  it('normalizes datetimes with years 0-9', () => {
    expect(normalizeDatetime('0001-01-01T00:00:00+01:00')).toEqual(
      '0000-12-31T23:00:00.000Z',
    )
    expect(normalizeDatetime('0009-06-15T12:00:00Z')).toEqual(
      '0009-06-15T12:00:00.000Z',
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
})

describe(normalizeDatetimeAlways, () => {
  it('normalizes valid input', () => {
    expect(normalizeDatetimeAlways('1985-04-12T23:20:50Z')).toEqual(
      '1985-04-12T23:20:50.000Z',
    )
  })

  it('normalizes invalid input', () => {
    expect(normalizeDatetimeAlways('blah')).toEqual('1970-01-01T00:00:00.000Z')
    expect(normalizeDatetimeAlways('0000-01-01T00:00:00+01:00')).toEqual(
      '1970-01-01T00:00:00.000Z',
    )
  })

  describe('valid interop', () => {
    for (const dt of interopValid) {
      test(dt, () => {
        // @NOTE we can't test the returned value as some will normalize while others won't.
        expect(() => normalizeDatetimeAlways(dt)).not.toThrow()
      })
    }
  })

  describe('succeeds on interop (invalid syntax)', () => {
    for (const dt of interopInvalidSyntax) {
      test(dt, () => {
        // @NOTE we can't test the returned value as some will normalize while others won't.
        expect(() => normalizeDatetimeAlways(dt)).not.toThrow()
      })
    }
  })

  describe('succeeds on interop invalid parse', () => {
    for (const dt of interopInvalidParse) {
      test(dt, () => {
        expect(normalizeDatetimeAlways(dt)).toEqual('1970-01-01T00:00:00.000Z')
      })
    }
  })
})

describe(isAtprotoDate, () => {
  it('accepts years 0-9', () => {
    expect(isAtprotoDate(new Date('0001-01-01T00:00:00Z'))).toBe(true)
    expect(isAtprotoDate(new Date('0009-06-15T12:00:00Z'))).toBe(true)
  })

  it('accepts year 0000', () => {
    expect(isAtprotoDate(new Date('0000-01-01T00:00:00Z'))).toBe(true)
  })

  it('rejects negative years', () => {
    expect(isAtprotoDate(new Date('-000001-01-01T00:00:00Z'))).toBe(false)
  })

  it('rejects years past 9999', () => {
    expect(isAtprotoDate(new Date('+010000-01-01T00:00:00Z'))).toBe(false)
  })

  it('rejects invalid dates', () => {
    expect(isAtprotoDate(new Date('invalid'))).toBe(false)
  })
})

describe(toDatetimeString, () => {
  it('converts normal dates', () => {
    expect(toDatetimeString(new Date('2024-01-15T12:30:00Z'))).toEqual(
      '2024-01-15T12:30:00.000Z',
    )
  })

  it('handles dates near year 0000 boundary with positive offset', () => {
    // Date that is before 0000-01-01T00:00:00Z in UTC but representable with a positive offset
    const date = new Date('-000001-12-31T23:00:00Z')
    expect(toDatetimeString(date)).toEqual('0000-01-01T00:00:00.000+01:00')
  })

  it('handles dates near year 9999 boundary with negative offset', () => {
    expect(toDatetimeString(new Date('9999-12-31T23:59:59.999-01:00'))).toEqual(
      '9999-12-31T23:59:59.999-01:00',
    )

    expect(toDatetimeString(new Date('9999-12-31T23:59:59.999-23:59'))).toEqual(
      '9999-12-31T23:59:59.999-23:59',
    )
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
  })
})

function readLines(filePath: string): string[] {
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}
