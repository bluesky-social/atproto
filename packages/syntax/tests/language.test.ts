import { describe, expect, it, test } from 'vitest'
import { isValidLanguage, parseLanguageString } from '../src/index.js'
import { readInteropFile } from './_utils.ts'

describe('valid interop', () => {
  test.each(readInteropFile('language_syntax_valid.txt'))('%s', (value) => {
    expect(isValidLanguage(value)).toBe(true)
    expect(parseLanguageString(value)).not.toBeNull()
  })
})

describe('invalid interop', () => {
  test.each(readInteropFile('language_syntax_invalid.txt'))('%s', (value) => {
    expect(isValidLanguage(value)).toBe(false)
    expect(parseLanguageString(value)).toBeNull()
  })
})

describe('invalid parse interop', () => {
  test.each(readInteropFile('language_parse_invalid.txt'))('%s', (value) => {
    expect(isValidLanguage(value)).toBe(true)
    expect(parseLanguageString(value)).toBeNull()
  })
})

describe(isValidLanguage, () => {
  it('validates BCP 47', () => {
    // valid
    expect(isValidLanguage('de')).toEqual(true)
    expect(isValidLanguage('de-CH')).toEqual(true)
    expect(isValidLanguage('de-DE-1901')).toEqual(true)
    expect(isValidLanguage('es-419')).toEqual(true)
    expect(isValidLanguage('sl-IT-nedis')).toEqual(true)
    expect(isValidLanguage('mn-Cyrl-MN')).toEqual(true)
    expect(isValidLanguage('x-fr-CH')).toEqual(true)
    // private-use subtags are case-insensitive (RFC 5646 §2.1.1)
    expect(isValidLanguage('X-fr-CH')).toEqual(true)
    expect(isValidLanguage('de-X-foo')).toEqual(true)
    expect(
      isValidLanguage('en-GB-boont-r-extended-sequence-x-private'),
    ).toEqual(true)
    expect(isValidLanguage('sr-Cyrl')).toEqual(true)
    expect(isValidLanguage('hy-Latn-IT-arevela')).toEqual(true)
    expect(isValidLanguage('i-klingon')).toEqual(true)
    expect(isValidLanguage('sl-rozaj-biske')).toEqual(true)
    expect(isValidLanguage('en-u-co-phonebk-t-en-US')).toEqual(true)
    // duplicate variant / extension singleton subtags are well-formed
    // syntax (§2.1) — semantic rejection is left to parseLanguageString
    expect(isValidLanguage('de-DE-1901-1901')).toEqual(true)
    expect(isValidLanguage('en-a-foo-a-bar')).toEqual(true)
    // invalid
    expect(isValidLanguage('')).toEqual(false)
    expect(isValidLanguage('x')).toEqual(false)
    expect(isValidLanguage('de-CH-')).toEqual(false)
    expect(isValidLanguage('i-bad-grandfathered')).toEqual(false)
    // isValidLanguage checks well-formed syntax (§2.1) only and stays
    // permissive of legacy forms — an uppercase primary subtag (`JA`) and a
    // bare four-letter run (`jaja`) are still considered well-formed here.
    // Strict rejection of these is done by parseLanguageString.
    expect(isValidLanguage('JA')).toEqual(true)
    expect(isValidLanguage('jaja')).toEqual(true)
  })
})

describe(parseLanguageString, () => {
  it('parses BCP 47', () => {
    // valid
    expect(parseLanguageString('de')).toEqual({
      language: 'de',
    })
    expect(parseLanguageString('de-CH')).toEqual({
      language: 'de',
      region: 'CH',
    })
    expect(parseLanguageString('de-DE-1901')).toEqual({
      language: 'de',
      region: 'DE',
      variant: '1901',
    })
    expect(parseLanguageString('es-419')).toEqual({
      language: 'es',
      region: '419',
    })
    expect(parseLanguageString('sl-IT-nedis')).toEqual({
      language: 'sl',
      region: 'IT',
      variant: 'nedis',
    })
    expect(parseLanguageString('mn-Cyrl-MN')).toEqual({
      language: 'mn',
      script: 'Cyrl',
      region: 'MN',
    })
    expect(parseLanguageString('x-fr-CH')).toEqual({
      privateUse: 'x-fr-CH',
    })
    // private-use subtags are case-insensitive (RFC 5646 §2.1.1)
    expect(parseLanguageString('X-fr-CH')).toEqual({
      privateUse: 'X-fr-CH',
    })
    expect(parseLanguageString('de-X-foo')).toEqual({
      language: 'de',
      privateUse: 'X-foo',
    })
    expect(
      parseLanguageString('en-GB-boont-r-extended-sequence-x-private'),
    ).toEqual({
      language: 'en',
      region: 'GB',
      variant: 'boont',
      extension: 'r-extended-sequence',
      privateUse: 'x-private',
    })
    expect(parseLanguageString('sr-Cyrl')).toEqual({
      language: 'sr',
      script: 'Cyrl',
    })
    expect(parseLanguageString('hy-Latn-IT-arevela')).toEqual({
      language: 'hy',
      script: 'Latn',
      region: 'IT',
      variant: 'arevela',
    })
    expect(parseLanguageString('i-klingon')).toEqual({
      grandfathered: 'i-klingon',
    })
    expect(parseLanguageString('sl-rozaj-biske')).toEqual({
      language: 'sl',
      variant: 'biske',
    })
    expect(parseLanguageString('en-u-co-phonebk-t-en-US')).toEqual({
      language: 'en',
      extension: 't-en-US',
    })
    // invalid
    expect(parseLanguageString('')).toEqual(null)
    expect(parseLanguageString('x')).toEqual(null)
    expect(parseLanguageString('de-CH-')).toEqual(null)
    expect(parseLanguageString('i-bad-grandfathered')).toEqual(null)
    // the primary language subtag must be lowercase (RFC 5646 §2.1.1)
    expect(parseLanguageString('JA')).toEqual(null)
    // a bare 4-letter run is not a well-formed language tag
    expect(parseLanguageString('jaja')).toEqual(null)
    // duplicate variant / extension singleton subtags (RFC 5646 §4.1)
    expect(parseLanguageString('de-DE-1901-1901')).toEqual(null)
    expect(parseLanguageString('en-rozaj-ROZAJ')).toEqual(null)
    expect(parseLanguageString('en-a-foo-a-bar')).toEqual(null)
    expect(parseLanguageString('en-u-co-phonebk-U-ca-buddhist')).toEqual(null)
  })
})
