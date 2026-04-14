import { describe, expect, it } from 'vitest'
import { isValidLanguage, parseLanguageString } from '../src'

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
    expect(
      isValidLanguage('en-GB-boont-r-extended-sequence-x-private'),
    ).toEqual(true)
    expect(isValidLanguage('sr-Cyrl')).toEqual(true)
    expect(isValidLanguage('hy-Latn-IT-arevela')).toEqual(true)
    expect(isValidLanguage('i-klingon')).toEqual(true)
    // invalid
    expect(isValidLanguage('')).toEqual(false)
    expect(isValidLanguage('x')).toEqual(false)
    expect(isValidLanguage('de-CH-')).toEqual(false)
    expect(isValidLanguage('i-bad-grandfathered')).toEqual(false)
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
    // invalid
    expect(parseLanguageString('')).toEqual(null)
    expect(parseLanguageString('x')).toEqual(null)
    expect(parseLanguageString('de-CH-')).toEqual(null)
    expect(parseLanguageString('i-bad-grandfathered')).toEqual(null)
  })
})
