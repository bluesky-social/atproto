import { describe, expect, it } from 'vitest'
import { string } from './string.js'
import { token } from './token.js'
import { withDefault } from './with-default.js'

describe('StringSchema', () => {
  describe('basic validation', () => {
    const schema = string()

    it('validates plain strings', () => {
      const result = schema.safeParse('hello world')
      expect(result.success).toBe(true)
    })

    it('validates empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
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

  describe('default values', () => {
    it('uses default value when no input provided', () => {
      const schema = withDefault(string(), 'default value')
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('default value')
      }
    })

    it('validates default value against constraints', () => {
      const schema = string({ default: 'hi', minLength: 5 })
      const result = schema.safeParse(undefined)
      expect(result.success).toBe(false)
    })
  })

  describe('minLength constraint', () => {
    const schema = string({ minLength: 5 })

    it('accepts strings meeting minimum length', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('accepts strings exceeding minimum length', () => {
      const result = schema.safeParse('hello world')
      expect(result.success).toBe(true)
    })

    it('rejects strings below minimum length', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('rejects empty strings when minLength is set', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('maxLength constraint', () => {
    const schema = string({ maxLength: 10 })

    it('accepts strings meeting maximum length', () => {
      const result = schema.safeParse('1234567890')
      expect(result.success).toBe(true)
    })

    it('accepts strings below maximum length', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects strings exceeding maximum length', () => {
      const result = schema.safeParse('hello world!')
      expect(result.success).toBe(false)
    })

    it('accepts empty strings', () => {
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('correctly handles UTF-8 multi-byte characters', () => {
      // Emoji takes 4 bytes in UTF-8
      const schema = string({ maxLength: 4 })
      const result = schema.safeParse('😀')
      expect(result.success).toBe(true)
    })

    it('rejects when multi-byte characters exceed maxLength', () => {
      const schema = string({ maxLength: 3 })
      const result = schema.safeParse('😀')
      expect(result.success).toBe(false)
    })
  })

  describe('combined min and max length', () => {
    const schema = string({ minLength: 3, maxLength: 10 })

    it('accepts strings within range', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('accepts strings at minimum boundary', () => {
      const result = schema.safeParse('abc')
      expect(result.success).toBe(true)
    })

    it('accepts strings at maximum boundary', () => {
      const result = schema.safeParse('1234567890')
      expect(result.success).toBe(true)
    })

    it('rejects strings below minimum', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(false)
    })

    it('rejects strings above maximum', () => {
      const result = schema.safeParse('hello world!')
      expect(result.success).toBe(false)
    })
  })

  describe('minGraphemes constraint', () => {
    const schema = string({ minGraphemes: 3 })

    it('accepts strings meeting minimum graphemes', () => {
      const result = schema.safeParse('abc')
      expect(result.success).toBe(true)
    })

    it('accepts strings exceeding minimum graphemes', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('rejects strings below minimum graphemes', () => {
      const result = schema.safeParse('ab')
      expect(result.success).toBe(false)
    })

    it('counts emoji as single graphemes', () => {
      const result = schema.safeParse('😀😀😀')
      expect(result.success).toBe(true)
    })

    it('rejects when emoji count is below minimum', () => {
      const result = schema.safeParse('😀😀')
      expect(result.success).toBe(false)
    })
  })

  describe('maxGraphemes constraint', () => {
    const schema = string({ maxGraphemes: 5 })

    it('accepts strings meeting maximum graphemes', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('accepts strings below maximum graphemes', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(true)
    })

    it('rejects strings exceeding maximum graphemes', () => {
      const result = schema.safeParse('hello world')
      expect(result.success).toBe(false)
    })

    it('counts emoji as single graphemes', () => {
      const result = schema.safeParse('😀😀😀😀😀')
      expect(result.success).toBe(true)
    })

    it('rejects when emoji count exceeds maximum', () => {
      const result = schema.safeParse('😀😀😀😀😀😀')
      expect(result.success).toBe(false)
    })
  })

  describe('combined grapheme constraints', () => {
    const schema = string({ minGraphemes: 2, maxGraphemes: 5 })

    it('accepts strings within grapheme range', () => {
      const result = schema.safeParse('hello')
      expect(result.success).toBe(true)
    })

    it('accepts strings at minimum boundary', () => {
      const result = schema.safeParse('hi')
      expect(result.success).toBe(true)
    })

    it('accepts strings at maximum boundary', () => {
      const result = schema.safeParse('world')
      expect(result.success).toBe(true)
    })

    it('rejects strings below minimum graphemes', () => {
      const result = schema.safeParse('a')
      expect(result.success).toBe(false)
    })

    it('rejects strings above maximum graphemes', () => {
      const result = schema.safeParse('hello!')
      expect(result.success).toBe(false)
    })
  })

  describe('format: datetime', () => {
    const schema = string({ format: 'datetime' })

    it('accepts valid ISO datetime strings', () => {
      const result = schema.safeParse('2023-12-25T12:00:00Z')
      expect(result.success).toBe(true)
    })

    it('accepts datetime with milliseconds', () => {
      const result = schema.safeParse('2023-12-25T12:00:00.123Z')
      expect(result.success).toBe(true)
    })

    it('rejects invalid datetime strings', () => {
      const result = schema.safeParse('not a date')
      expect(result.success).toBe(false)
    })

    it('rejects invalid date format', () => {
      const result = schema.safeParse('12/25/2023')
      expect(result.success).toBe(false)
    })
  })

  describe('format: uri', () => {
    const schema = string({ format: 'uri' })

    it('accepts valid HTTP URIs', () => {
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(true)
    })

    it('accepts valid URIs with paths', () => {
      const result = schema.safeParse('https://example.com/path/to/resource')
      expect(result.success).toBe(true)
    })

    it('accepts URIs with different schemes', () => {
      const result = schema.safeParse('ftp://files.example.com')
      expect(result.success).toBe(true)
    })

    it('rejects invalid URIs', () => {
      const result = schema.safeParse('not a uri')
      expect(result.success).toBe(false)
    })

    it('rejects URIs without scheme', () => {
      const result = schema.safeParse('example.com')
      expect(result.success).toBe(false)
    })
  })

  describe('format: at-uri', () => {
    const schema = string({ format: 'at-uri' })

    it('accepts valid AT URI', () => {
      const result = schema.safeParse(
        'at://did:plc:abc123/app.bsky.feed.post/xyz',
      )
      expect(result.success).toBe(true)
    })

    it('rejects invalid AT URI', () => {
      const result = schema.safeParse('https://example.com')
      expect(result.success).toBe(false)
    })

    it('rejects plain strings', () => {
      const result = schema.safeParse('not an at-uri')
      expect(result.success).toBe(false)
    })
  })

  describe('format: did', () => {
    const schema = string({ format: 'did' })

    it('accepts valid DID with plc method', () => {
      const result = schema.safeParse('did:plc:abc123')
      expect(result.success).toBe(true)
    })

    it('accepts valid DID with web method', () => {
      const result = schema.safeParse('did:web:example.com')
      expect(result.success).toBe(true)
    })

    it('rejects invalid DID format', () => {
      const result = schema.safeParse('not-a-did')
      expect(result.success).toBe(false)
    })

    it('rejects DID without method', () => {
      const result = schema.safeParse('did:')
      expect(result.success).toBe(false)
    })
  })

  describe('format: handle', () => {
    const schema = string({ format: 'handle' })

    it('accepts valid handle', () => {
      const result = schema.safeParse('user.bsky.social')
      expect(result.success).toBe(true)
    })

    it('accepts handle with subdomain', () => {
      const result = schema.safeParse('alice.test.example.com')
      expect(result.success).toBe(true)
    })

    it('rejects invalid handle format', () => {
      const result = schema.safeParse('invalid handle!')
      expect(result.success).toBe(false)
    })

    it('rejects handle with spaces', () => {
      const result = schema.safeParse('user name.bsky.social')
      expect(result.success).toBe(false)
    })
  })

  describe('format: at-identifier', () => {
    const schema = string({ format: 'at-identifier' })

    it('accepts valid DID as at-identifier', () => {
      const result = schema.safeParse('did:plc:abc123')
      expect(result.success).toBe(true)
    })

    it('accepts valid handle as at-identifier', () => {
      const result = schema.safeParse('user.bsky.social')
      expect(result.success).toBe(true)
    })

    it('rejects invalid at-identifier', () => {
      const result = schema.safeParse('invalid!')
      expect(result.success).toBe(false)
    })
  })

  describe('format: nsid', () => {
    const schema = string({ format: 'nsid' })

    it('accepts valid NSID', () => {
      const result = schema.safeParse('app.bsky.feed.post')
      expect(result.success).toBe(true)
    })

    it('accepts NSID with multiple segments', () => {
      const result = schema.safeParse('com.example.app.feature.action')
      expect(result.success).toBe(true)
    })

    it('rejects invalid NSID format', () => {
      const result = schema.safeParse('not-an-nsid')
      expect(result.success).toBe(false)
    })

    it('rejects NSID with invalid characters', () => {
      const result = schema.safeParse('app.bsky.feed!')
      expect(result.success).toBe(false)
    })
  })

  describe('format: cid', () => {
    const schema = string({ format: 'cid' })

    it('accepts valid CID v1', () => {
      const result = schema.safeParse(
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      )
      expect(result.success).toBe(true)
    })

    it('rejects invalid CID format', () => {
      const result = schema.safeParse('not-a-cid')
      expect(result.success).toBe(false)
    })

    it('rejects plain strings', () => {
      const result = schema.safeParse('abc123')
      expect(result.success).toBe(false)
    })
  })

  describe('format: language', () => {
    const schema = string({ format: 'language' })

    it('accepts valid BCP 47 language code', () => {
      const result = schema.safeParse('en')
      expect(result.success).toBe(true)
    })

    it('accepts language code with region', () => {
      const result = schema.safeParse('en-US')
      expect(result.success).toBe(true)
    })

    it('accepts language code with script and region', () => {
      const result = schema.safeParse('zh-Hans-CN')
      expect(result.success).toBe(true)
    })

    it('rejects invalid language code', () => {
      const result = schema.safeParse('not valid')
      expect(result.success).toBe(false)
    })
  })

  describe('format: tid', () => {
    const schema = string({ format: 'tid' })

    it('accepts valid TID', () => {
      const result = schema.safeParse('3jzfcijpj2z2a')
      expect(result.success).toBe(true)
    })

    it('rejects invalid TID format', () => {
      const result = schema.safeParse('not-a-tid')
      expect(result.success).toBe(false)
    })

    it('rejects TID with invalid characters', () => {
      const result = schema.safeParse('3jzfcijpj2z2!')
      expect(result.success).toBe(false)
    })
  })

  describe('format: record-key', () => {
    const schema = string({ format: 'record-key' })

    it('accepts valid record key', () => {
      const result = schema.safeParse('3jzfcijpj2z2a')
      expect(result.success).toBe(true)
    })

    it('accepts alphanumeric record key', () => {
      const result = schema.safeParse('myRecordKey123')
      expect(result.success).toBe(true)
    })

    it('rejects record key with invalid characters', () => {
      const result = schema.safeParse('invalid/key')
      expect(result.success).toBe(false)
    })

    it('rejects record key with spaces', () => {
      const result = schema.safeParse('invalid key')
      expect(result.success).toBe(false)
    })
  })

  describe('type coercion', () => {
    const schema = string()

    it('coerces Date objects to ISO strings', () => {
      const date = new Date('2023-12-25T12:00:00Z')
      const result = schema.safeParse(date)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('2023-12-25T12:00:00.000Z')
      }
    })

    it('rejects invalid Date objects', () => {
      const invalidDate = new Date('invalid')
      const result = schema.safeParse(invalidDate)
      expect(result.success).toBe(false)
    })

    it('coerces URL objects to strings', () => {
      const url = new URL('https://example.com/path')
      const result = schema.safeParse(url)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('https://example.com/path')
      }
    })

    it('coerces String objects to primitive strings', () => {
      const stringObj = new String('hello')
      const result = schema.safeParse(stringObj)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('hello')
      }
    })

    it('coerces TokenSchema instances to strings', () => {
      const result = schema.safeParse(token('my.to.ken', 'main'))
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe('my.to.ken')
      }
    })
  })

  describe('combined constraints and format', () => {
    const schema = string({
      format: 'handle',
      minLength: 5,
      maxLength: 50,
    })

    it('validates both format and length constraints', () => {
      const result = schema.safeParse('user.bsky.social')
      expect(result.success).toBe(true)
    })

    it('rejects when length is valid but format is invalid', () => {
      const result = schema.safeParse('invalid handle!')
      expect(result.success).toBe(false)
    })

    it('rejects when format is valid but length is too short', () => {
      const result = schema.safeParse('a.bc')
      expect(result.success).toBe(false)
    })

    it('rejects when format is valid but length is too long', () => {
      const longHandle =
        'very.long.subdomain.name.that.exceeds.maximum.length.example.com'
      const result = schema.safeParse(longHandle)
      expect(result.success).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles strings with special characters', () => {
      const schema = string()
      const result = schema.safeParse('hello\nworld\ttab')
      expect(result.success).toBe(true)
    })

    it('handles strings with unicode characters', () => {
      const schema = string()
      const result = schema.safeParse('Hello 世界 🌍')
      expect(result.success).toBe(true)
    })

    it('handles very long strings', () => {
      const schema = string({ maxLength: 10000 })
      const longString = 'a'.repeat(10000)
      const result = schema.safeParse(longString)
      expect(result.success).toBe(true)
    })

    it('rejects very long strings exceeding maxLength', () => {
      const schema = string({ maxLength: 100 })
      const longString = 'a'.repeat(101)
      const result = schema.safeParse(longString)
      expect(result.success).toBe(false)
    })

    it('handles zero as minLength', () => {
      const schema = string({ minLength: 0 })
      const result = schema.safeParse('')
      expect(result.success).toBe(true)
    })

    it('handles complex emoji sequences', () => {
      const schema = string({ maxGraphemes: 5 })
      // Family emoji is a single grapheme cluster
      const result = schema.safeParse('👨‍👩‍👧‍👦')
      expect(result.success).toBe(true)
    })
  })
})
