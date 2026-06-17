import { describe, expect, it } from 'vitest'
import { regexp } from './regexp.js'

describe('RegexpSchema', () => {
  describe('basic validation', () => {
    const schema = regexp(/^[a-z]+$/)

    it('validates strings matching the pattern', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates strings with different matching values', () => {
      const result = schema.safeParse('world')
      expect(result.success).toBe(true)
    })

    it('rejects strings not matching the pattern', () => {
      const result = schema.safeParse('Hello')
      expect(result.success).toBe(false)
    })

    it('rejects strings with numbers when pattern requires letters', () => {
      const result = schema.safeParse('hello123')
      expect(result.success).toBe(false)
    })

    it('rejects non-strings', () => {
      const result = schema.safeParse(123)
      expect(result.success).toBe(false)
    })

    it('rejects null', () => {
      const result = schema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('rejects undefined', () => {
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })

    it('rejects booleans', () => {
      const result = schema.safeParse(true)
      expect(result.success).toBe(false)
    })

    it('rejects arrays', () => {
      const result = schema.safeParse(['hello'])
      expect(result.success).toBe(false)
    })

    it('rejects plain objects', () => {
      const result = schema.safeParse({ value: 'hello' })
      expect(result.success).toBe(false)
    })
  })

  describe('numeric patterns', () => {
    const schema = regexp(/^\d+$/)

    it('validates numeric strings', () => {
      const result = schema.safeParse('12345')
      expect(result.success).toBe(true)
    })

    it('validates single digit strings', () => {
      const result = schema.safeParse('0')
      expect(result.success).toBe(true)
    })

    it('rejects strings with letters', () => {
      const result = schema.safeParse('123abc')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('email pattern', () => {
    const schema = regexp(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)

    it('validates simple email addresses', () => {
      const result = schema.safeParse('user@example.com')
      expect(result.success).toBe(true)
    })

    it('validates email with subdomain', () => {
      const result = schema.safeParse('user@mail.example.com')
      expect(result.success).toBe(true)
    })

    it('validates email with numbers and special characters', () => {
      const result = schema.safeParse('user.name+tag@example.com')
      expect(result.success).toBe(true)
    })

    it('rejects email without @', () => {
      const result = schema.safeParse('userexample.com')
      expect(result.success).toBe(false)
    })

    it('rejects email without domain', () => {
      const result = schema.safeParse('user@')
      expect(result.success).toBe(false)
    })

    it('rejects email without TLD', () => {
      const result = schema.safeParse('user@example')
      expect(result.success).toBe(false)
    })
  })

  describe('URL pattern', () => {
    const schema = regexp(/^https?:\/\/[^\s/$.?#].[^\s]*$/)

    it('validates HTTP URLs', () => {
      const result = schema.safeParse('http://example.com')
      expect(result.success).toBe(true)
    })

    it('validates HTTPS URLs', () => {
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(true)
    })

    it('validates URLs with paths', () => {
      const result = schema.safeParse('https://example.com/path/to/resource')
      expect(result.success).toBe(true)
    })

    it('validates URLs with query parameters', () => {
      const result = schema.safeParse('https://example.com?param=value')
      expect(result.success).toBe(true)
    })

    it('rejects URLs without protocol', () => {
      const result = schema.safeParse('example.com')
      expect(result.success).toBe(false)
    })

    it('rejects URLs with spaces', () => {
      const result = schema.safeParse('https://example.com/path with spaces')
      expect(result.success).toBe(false)
    })
  })

  describe('phone number pattern', () => {
    const schema = regexp(/^\+?[1-9]\d{1,14}$/)

    it('validates simple phone numbers', () => {
      const result = schema.safeParse('1234567890')
      expect(result.success).toBe(true)
    })

    it('validates phone numbers with plus prefix', () => {
      const result = schema.safeParse('+1234567890')
      expect(result.success).toBe(true)
    })

    it('validates international phone numbers', () => {
      const result = schema.safeParse('+441234567890')
      expect(result.success).toBe(true)
    })

    it('rejects phone numbers starting with zero', () => {
      const result = schema.safeParse('0123456789')
      expect(result.success).toBe(false)
    })

    it('rejects phone numbers with letters', () => {
      const result = schema.safeParse('123-456-ABCD')
      expect(result.success).toBe(false)
    })

    it('rejects phone numbers with special characters', () => {
      const result = schema.safeParse('123-456-7890')
      expect(result.success).toBe(false)
    })
  })

  describe('hex color pattern', () => {
    const schema = regexp(/^#[0-9A-Fa-f]{6}$/)

    it('validates 6-digit hex colors', () => {
      const result = schema.safeParse('#FF5733')
      expect(result.success).toBe(true)
    })

    it('validates lowercase hex colors', () => {
      const result = schema.safeParse('#ff5733')
      expect(result.success).toBe(true)
    })

    it('validates mixed case hex colors', () => {
      const result = schema.safeParse('#Ff5733')
      expect(result.success).toBe(true)
    })

    it('rejects hex colors without hash', () => {
      const result = schema.safeParse('FF5733')
      expect(result.success).toBe(false)
    })

    it('rejects 3-digit hex colors', () => {
      const result = schema.safeParse('#FFF')
      expect(result.success).toBe(false)
    })

    it('rejects hex colors with invalid characters', () => {
      const result = schema.safeParse('#GG5733')
      expect(result.success).toBe(false)
    })
  })

  describe('alphanumeric pattern', () => {
    const schema = regexp(/^[a-zA-Z0-9]+$/)

    it('validates alphanumeric strings', () => {
      const result = schema.safeParse('abc123')
      expect(result.success).toBe(true)
    })

    it('validates only letters', () => {
      const result = schema.safeParse('abcdef')
      expect(result.success).toBe(true)
    })

    it('validates only numbers', () => {
      const result = schema.safeParse('123456')
      expect(result.success).toBe(true)
    })

    it('rejects strings with spaces', () => {
      const result = schema.safeParse('abc 123')
      expect(result.success).toBe(false)
    })

    it('rejects strings with special characters', () => {
      const result = schema.safeParse('abc_123')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('case-insensitive pattern', () => {
    const schema = regexp(/^hello$/i)

    it('validates lowercase match', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('validates uppercase match', () => {
      const result = schema.safeParse('HELLO')
      expect(result.success).toBe(true)
    })

    it('validates mixed case match', () => {
      const result = schema.safeParse('HeLLo')
      expect(result.success).toBe(true)
    })

    it('rejects non-matching strings', () => {
      const result = schema.safeParse('world')
      expect(result.success).toBe(false)
    })
  })

  describe('multiline pattern', () => {
    const schema = regexp(/^line\d+$/m)

    it('validates single line matching pattern', () => {
      const result = schema.safeParse('line1')
      expect(result.success).toBe(true)
    })

    it('validates multiline string with matching line', () => {
      const result = schema.safeParse('line1\nline2')
      expect(result.success).toBe(true)
    })

    it('rejects strings without matching lines', () => {
      const result = schema.safeParse('hello\nworld')
      expect(result.success).toBe(false)
    })
  })

  describe('optional character pattern', () => {
    const schema = regexp(/^colou?r$/)

    it('validates with optional character present', () => {
      const result = schema.safeParse('colour')
      expect(result.success).toBe(true)
    })

    it('validates with optional character absent', () => {
      const result = schema.safeParse('color')
      expect(result.success).toBe(true)
    })

    it('rejects strings not matching pattern', () => {
      const result = schema.safeParse('colouur')
      expect(result.success).toBe(false)
    })
  })

  describe('character range pattern', () => {
    const schema = regexp(/^[0-5]+$/)

    it('validates strings within range', () => {
      const result = schema.safeParse('012345')
      expect(result.success).toBe(true)
    })

    it('validates single character in range', () => {
      const result = schema.safeParse('3')
      expect(result.success).toBe(true)
    })

    it('rejects strings with characters outside range', () => {
      const result = schema.safeParse('0123456')
      expect(result.success).toBe(false)
    })
  })

  describe('quantifier pattern', () => {
    const schema = regexp(/^a{3}$/)

    it('validates exact repetition count', () => {
      const result = schema.safeParse('aaa')
      expect(result.success).toBe(true)
    })

    it('rejects fewer repetitions', () => {
      const result = schema.safeParse('aa')
      expect(result.success).toBe(false)
    })

    it('rejects more repetitions', () => {
      const result = schema.safeParse('aaaa')
      expect(result.success).toBe(false)
    })
  })

  describe('range quantifier pattern', () => {
    const schema = regexp(/^a{2,4}$/)

    it('validates minimum repetition count', () => {
      const result = schema.safeParse('aa')
      expect(result.success).toBe(true)
    })

    it('validates middle repetition count', () => {
      const result = schema.safeParse('aaa')
      expect(result.success).toBe(true)
    })

    it('validates maximum repetition count', () => {
      const result = schema.safeParse('aaaa')
      expect(result.success).toBe(true)
    })

    it('rejects fewer than minimum repetitions', () => {
      const result = schema.safeParse('a')
      expect(result.success).toBe(false)
    })

    it('rejects more than maximum repetitions', () => {
      const result = schema.safeParse('aaaaa')
      expect(result.success).toBe(false)
    })
  })

  describe('alternation pattern', () => {
    const schema = regexp(/^(cat|dog|bird)$/)

    it('validates first alternative', () => {
      const result = schema.safeParse('cat')
      expect(result.success).toBe(true)
    })

    it('validates second alternative', () => {
      const result = schema.safeParse('dog')
      expect(result.success).toBe(true)
    })

    it('validates third alternative', () => {
      const result = schema.safeParse('bird')
      expect(result.success).toBe(true)
    })

    it('rejects strings not matching any alternative', () => {
      const result = schema.safeParse('fish')
      expect(result.success).toBe(false)
    })
  })

  describe('word boundary pattern', () => {
    const schema = regexp(/\bword\b/)

    it('validates word with boundaries', () => {
      const result = schema.safeParse('word')
      expect(result.success).toBe(true)
    })

    it('validates word within sentence', () => {
      const result = schema.safeParse('this is a word')
      expect(result.success).toBe(true)
    })

    it('rejects word as part of larger word', () => {
      const result = schema.safeParse('wording')
      expect(result.success).toBe(false)
    })
  })

  describe('lookahead pattern', () => {
    const schema = regexp(/^(?=.*[A-Z])(?=.*[0-9]).{8,}$/)

    it('validates string meeting all lookahead conditions', () => {
      const result = schema.safeParse('Password1')
      expect(result.success).toBe(true)
    })

    it('validates string with multiple uppercase and numbers', () => {
      const result = schema.safeParse('ABC12345')
      expect(result.success).toBe(true)
    })

    it('rejects string without uppercase', () => {
      const result = schema.safeParse('password1')
      expect(result.success).toBe(false)
    })

    it('rejects string without number', () => {
      const result = schema.safeParse('Password')
      expect(result.success).toBe(false)
    })

    it('rejects string too short', () => {
      const result = schema.safeParse('Pass1')
      expect(result.success).toBe(false)
    })
  })

  describe('unicode pattern', () => {
    const schema = regexp(/^[\u4e00-\u9fa5]+$/)

    it('validates Chinese characters', () => {
      const result = schema.safeParse('你好')
      expect(result.success).toBe(true)
    })

    it('validates multiple Chinese characters', () => {
      const result = schema.safeParse('世界')
      expect(result.success).toBe(true)
    })

    it('rejects non-Chinese characters', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(false)
    })

    it('rejects mixed Chinese and English', () => {
      const result = schema.safeParse('你好hello')
      expect(result.success).toBe(false)
    })
  })

  describe('empty string pattern', () => {
    const schema = regexp(/^$/)

    it('validates empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('rejects non-empty strings', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(false)
    })

    it('rejects whitespace strings', () => {
      const result = schema.safeParse(' ')
      expect(result.success).toBe(false)
    })
  })

  describe('wildcard pattern', () => {
    const schema = regexp(/^.*$/)

    it('validates empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('validates any string', () => {
      const result = schema.safeParse('anything goes here 123 !@#')
      expect(result.success).toBe(true)
    })

    it('validates strings with special characters', () => {
      const result = schema.safeParse('!@#$%^&*()')
      expect(result.success).toBe(true)
    })

    it('validates strings with unicode', () => {
      const result = schema.safeParse('Hello 世界 🌍')
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles pattern with escape sequences', () => {
      const schema = regexp(/^\d{3}\.\d{3}\.\d{3}\.\d{3}$/)
      const result = schema.safeParse('192.168.001.001')
      expect(result.success).toBe(true)
    })

    it('handles pattern with special regex characters', () => {
      const schema = regexp(/^\$\d+\.\d{2}$/)
      const result = schema.safeParse('$99.99')
      expect(result.success).toBe(true)
    })

    it('handles very long strings', () => {
      const schema = regexp(/^[a-z]+$/)
      const longString = 'a'.repeat(10000)
      const result = schema.safeParse(longString)
      expect(result.success).toBe(true)
    })

    it('handles strings with newlines', () => {
      const schema = regexp(/^hello\nworld$/)
      const result = schema.safeParse('hello\nworld')
      expect(result.success).toBe(true)
    })

    it('handles strings with tabs', () => {
      const schema = regexp(/^hello\tworld$/)
      const result = schema.safeParse('hello\tworld')
      expect(result.success).toBe(true)
    })

    it('handles emoji patterns', () => {
      const schema = regexp(/^[\u{1F600}-\u{1F64F}]+$/u)
      const result = schema.safeParse('😀😃😄')
      expect(result.success).toBe(true)
    })

    it('handles global flag in pattern', () => {
      const schema = regexp(/test/g)
      const result = schema.safeParse('test')
      expect(result.success).toBe(true)
    })

    it('handles pattern matching anywhere in string', () => {
      const schema = regexp(/test/)
      const result = schema.safeParse('this is a test string')
      expect(result.success).toBe(true)
    })

    it('handles complex nested groups', () => {
      const schema = regexp(/^((https?|ftp):\/\/)?([a-z0-9]+\.)+[a-z]{2,}$/)
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(true)
    })
  })
})
