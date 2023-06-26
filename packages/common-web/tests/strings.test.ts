import { graphemeLen, parseLanguage, utf8Len, validateLanguage } from '../src'

describe('string', () => {
  it('calculates utf8 string length', () => {
    expect(utf8Len('a')).toBe(1)
    expect(utf8Len('~')).toBe(1)
    expect(utf8Len('ö')).toBe(2)
    expect(utf8Len('ñ')).toBe(2)
    expect(utf8Len('©')).toBe(2)
    expect(utf8Len('⽘')).toBe(3)
    expect(utf8Len('☎')).toBe(3)
    expect(utf8Len('𓋓')).toBe(4)
    expect(utf8Len('😀')).toBe(4)
    expect(utf8Len('👨‍👩‍👧‍👧')).toBe(25)
  })

  it('calculates grapheme length', () => {
    expect(graphemeLen('a')).toBe(1)
    expect(graphemeLen('~')).toBe(1)
    expect(graphemeLen('ö')).toBe(1)
    expect(graphemeLen('ñ')).toBe(1)
    expect(graphemeLen('©')).toBe(1)
    expect(graphemeLen('⽘')).toBe(1)
    expect(graphemeLen('☎')).toBe(1)
    expect(graphemeLen('𓋓')).toBe(1)
    expect(graphemeLen('😀')).toBe(1)
    expect(graphemeLen('👨‍👩‍👧‍👧')).toBe(1)
    expect(graphemeLen('a~öñ©⽘☎𓋓😀👨‍👩‍👧‍👧')).toBe(10)
  })

  describe('languages', () => {
    it('validates BCP 47', () => {
      // valid
      expect(validateLanguage('de')).toEqual(true)
      expect(validateLanguage('de-CH')).toEqual(true)
      expect(validateLanguage('de-DE-1901')).toEqual(true)
      expect(validateLanguage('es-419')).toEqual(true)
      expect(validateLanguage('sl-IT-nedis')).toEqual(true)
      expect(validateLanguage('mn-Cyrl-MN')).toEqual(true)
      expect(validateLanguage('x-fr-CH')).toEqual(true)
      expect(
        validateLanguage('en-GB-boont-r-extended-sequence-x-private'),
      ).toEqual(true)
      expect(validateLanguage('sr-Cyrl')).toEqual(true)
      expect(validateLanguage('hy-Latn-IT-arevela')).toEqual(true)
      expect(validateLanguage('i-klingon')).toEqual(true)
      // invalid
      expect(validateLanguage('')).toEqual(false)
      expect(validateLanguage('x')).toEqual(false)
      expect(validateLanguage('de-CH-')).toEqual(false)
      expect(validateLanguage('i-bad-grandfathered')).toEqual(false)
    })

    it('parses BCP 47', () => {
      // valid
      expect(parseLanguage('de')).toEqual({
        language: 'de',
      })
      expect(parseLanguage('de-CH')).toEqual({
        language: 'de',
        region: 'CH',
      })
      expect(parseLanguage('de-DE-1901')).toEqual({
        language: 'de',
        region: 'DE',
        variant: '1901',
      })
      expect(parseLanguage('es-419')).toEqual({
        language: 'es',
        region: '419',
      })
      expect(parseLanguage('sl-IT-nedis')).toEqual({
        language: 'sl',
        region: 'IT',
        variant: 'nedis',
      })
      expect(parseLanguage('mn-Cyrl-MN')).toEqual({
        language: 'mn',
        script: 'Cyrl',
        region: 'MN',
      })
      expect(parseLanguage('x-fr-CH')).toEqual({
        privateUse: 'x-fr-CH',
      })
      expect(
        parseLanguage('en-GB-boont-r-extended-sequence-x-private'),
      ).toEqual({
        language: 'en',
        region: 'GB',
        variant: 'boont',
        extension: 'r-extended-sequence',
        privateUse: 'x-private',
      })
      expect(parseLanguage('sr-Cyrl')).toEqual({
        language: 'sr',
        script: 'Cyrl',
      })
      expect(parseLanguage('hy-Latn-IT-arevela')).toEqual({
        language: 'hy',
        script: 'Latn',
        region: 'IT',
        variant: 'arevela',
      })
      expect(parseLanguage('i-klingon')).toEqual({
        grandfathered: 'i-klingon',
      })
      // invalid
      expect(parseLanguage('')).toEqual(null)
      expect(parseLanguage('x')).toEqual(null)
      expect(parseLanguage('de-CH-')).toEqual(null)
      expect(parseLanguage('i-bad-grandfathered')).toEqual(null)
    })
  })
})
