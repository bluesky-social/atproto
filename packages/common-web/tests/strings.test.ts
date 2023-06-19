import { graphemeLen, parseLanguage, utf8Len } from '../src'

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

  describe('language tags', () => {
    it('parses BCP47', () => {
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
    })
  })
})
