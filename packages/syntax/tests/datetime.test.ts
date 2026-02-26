import * as fs from 'node:fs'
import { describe, expect, it, test } from 'vitest'
import {
  InvalidDatetimeError,
  ensureValidDatetime,
  isValidDatetime,
  normalizeDatetime,
  normalizeDatetimeAlways,
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
    expect(() => normalizeDatetime('0001-01-01T00:00:00+01:00')).toThrow(
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

  describe('fails on interop (invalid syntax)', () => {
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

function readLines(filePath: string): string[] {
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#') && line.length > 0)
}
