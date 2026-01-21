import { describe, expect, it } from 'vitest'
import { isLanguageString, parseLanguageString } from './language'

describe('string', () => {
  describe('languages', () => {
    it('validates BCP 47', () => {
      // valid
      expect(isLanguageString('de')).toEqual(true)
      expect(isLanguageString('de-CH')).toEqual(true)
      expect(isLanguageString('de-DE-1901')).toEqual(true)
      expect(isLanguageString('es-419')).toEqual(true)
      expect(isLanguageString('sl-IT-nedis')).toEqual(true)
      expect(isLanguageString('mn-Cyrl-MN')).toEqual(true)
      expect(isLanguageString('x-fr-CH')).toEqual(true)
      expect(
        isLanguageString('en-GB-boont-r-extended-sequence-x-private'),
      ).toEqual(true)
      expect(isLanguageString('sr-Cyrl')).toEqual(true)
      expect(isLanguageString('hy-Latn-IT-arevela')).toEqual(true)
      expect(isLanguageString('i-klingon')).toEqual(true)
      // invalid
      expect(isLanguageString('')).toEqual(false)
      expect(isLanguageString('x')).toEqual(false)
      expect(isLanguageString('de-CH-')).toEqual(false)
      expect(isLanguageString('i-bad-grandfathered')).toEqual(false)
    })

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
})
