import { isValidEncoding, normalizeMime } from '../src/util'

describe('isValidEncoding', () => {
  const validTests: [string, string][] = [
    ['application/json', 'json'], // MK : this should not be valid...
    ['application/json', 'application/json'],
    ['application/json', 'application/json; charset=utf-8'],
    ['application/json; charset=utf-8', 'application/json; charset=utf-8'],
  ]

  for (const [possible, value] of validTests) {
    it(`should return true if the encoding is valid: ${possible} == ${value}`, () => {
      expect(isValidEncoding(possible, value)).toBe(true)
    })
  }

  const invalidTests: [string, string][] = [
    ['json', 'application/json'],
    ['application', 'application/json'],
    ['application/json', 'application'],
    ['application/json', 'application/*'],
    ['application/json', '*/json'],
    ['application/json', '*/*'],
    ['application/json; charset=utf-8', 'application/json'],
    ['application/json', 'application/ld+json'],
    ['application/ld+json', 'application/json'],
    ['application/ld+json', 'json'], // MK: ...because THESE are not valid...
    ['application/ld+json', '+json'],
    ['application/ld+json', 'ld+json'],
  ]

  for (const [possible, value] of invalidTests) {
    it(`should return false if the encoding is invalid: ${possible} != ${value}`, () => {
      expect(isValidEncoding(possible, value)).toBe(false)
    })
  }
})

describe('normalizeMime', () => {
  const validTests: [string, string | false][] = [
    ['application/json', 'application/json'],
    ['application/json; charset=utf-8', 'application/json'],
    ['json', 'application/json'],
    ['dog', false],
    ['dog/json', 'dog/json'],
    ['dog/jason', 'dog/jason'],
    ['dog/ld+json', 'dog/ld+json'],
    ['dog/ld+jsoon', 'dog/ld+jsoon'],
    ['', false],
    ['*/*', '*/*'],
    ['application/*', 'application/*'],
    ['application/*+json', 'application/*+json'],
    ['application/ld+json', 'application/ld+json'],
  ]

  for (const [value, expected] of validTests) {
    it(`should return the normalized value, or false if invalid: ${value}: ${normalizeMime(value)} -> ${expected}`, () => {
      expect(normalizeMime(value)).toBe(expected)
    })
  }
})
