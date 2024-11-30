import {
  isValidDatetime,
  ensureValidDatetime,
  normalizeDatetime,
  normalizeDatetimeAlways,
  InvalidDatetimeError,
} from '../src'
import * as readline from 'readline'
import * as fs from 'fs'

describe('datetime validation', () => {
  const expectValid = (h: string) => {
    ensureValidDatetime(h)
    normalizeDatetime(h)
    normalizeDatetimeAlways(h)
  }
  const expectInvalid = (h: string) => {
    expect(() => ensureValidDatetime(h)).toThrow(InvalidDatetimeError)
  }

  it('conforms to interop valid datetimes', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/datetime_syntax_valid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      if (!isValidDatetime(line)) {
        console.log(line)
      }
      expectValid(line)
    })
  })

  it('conforms to interop invalid datetimes', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/datetime_syntax_invalid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      expectInvalid(line)
    })
  })

  it('conforms to interop invalid parse (semantics) datetimes', () => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(
        `${__dirname}/interop-files/datetime_parse_invalid.txt`,
      ),
      terminal: false,
    })
    lineReader.on('line', (line) => {
      if (line.startsWith('#') || line.length === 0) {
        return
      }
      expectInvalid(line)
    })
  })
})

describe('normalization', () => {
  it('normalizes datetimes', () => {
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

  it('throws on invalid normalized datetimes', () => {
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

  it('normalizes datetimes always', () => {
    expect(normalizeDatetimeAlways('1985-04-12T23:20:50Z')).toEqual(
      '1985-04-12T23:20:50.000Z',
    )
    expect(normalizeDatetimeAlways('blah')).toEqual('1970-01-01T00:00:00.000Z')
    expect(normalizeDatetimeAlways('0000-01-01T00:00:00+01:00')).toEqual(
      '1970-01-01T00:00:00.000Z',
    )
  })
})
