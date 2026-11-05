import { describe, expect, it } from 'vitest'
import {
  DID_PATTERN,
  DOMAIN_LESS_IDENTIFIER_PATTERN,
  EMAIL_PATTERN,
  HANDLE_PATTERN,
  HANDLE_SEGMENT_PATTERN,
  IDENTIFIER_PATTERN,
  OTP_CODE_PATTERN,
  OTP_CODE_REGEX,
  formatOtpCode,
  isIdentifier,
  normalizeIdentifier,
} from './form-patterns.ts'

// Browsers compile a `pattern` attribute as `^(?:…)$` with the `v` flag, and
// silently drop the constraint when that fails to compile.
describe('pattern attribute sources', () => {
  it.each(
    Object.entries({
      DID_PATTERN,
      DOMAIN_LESS_IDENTIFIER_PATTERN,
      EMAIL_PATTERN,
      HANDLE_PATTERN,
      HANDLE_SEGMENT_PATTERN,
      IDENTIFIER_PATTERN,
      OTP_CODE_PATTERN,
    }),
  )('%s compiles under the "v" flag', (_name, source) => {
    expect(() => new RegExp(`^(?:${source})$`, 'v')).not.toThrow()
  })
})

describe(isIdentifier, () => {
  it.each([
    'a.example.com',
    'x.bsky.social',
    'a.b.c.test',
    'Alice.Example.com',
    'alice@example.com',
    'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
    'did:web:example.com',
  ])('accepts %j', (value) => {
    expect(isIdentifier(value)).toBe(true)
  })

  it.each([
    '-a.example.com',
    'a-.example.com',
    'a..example.com',
    'example.1com',
    'alice',
    'a@@b',
  ])('rejects %j', (value) => {
    expect(isIdentifier(value)).toBe(false)
  })
})

describe(formatOtpCode, () => {
  it('uppercases and inserts the hyphen', () => {
    expect(formatOtpCode('abcde23456')).toBe('ABCDE-23456')
  })

  it('leaves a well-formed code untouched', () => {
    expect(formatOtpCode('ABCDE-23456')).toBe('ABCDE-23456')
  })

  it('does not insert the hyphen before the sixth character', () => {
    expect(formatOtpCode('abc')).toBe('ABC')
    expect(formatOtpCode('abcde')).toBe('ABCDE')
    expect(formatOtpCode('abcde-')).toBe('ABCDE')
  })

  it('strips characters outside the base32 alphabet', () => {
    expect(formatOtpCode(' abc de - 234 56 ')).toBe('ABCDE-23456')
    expect(formatOtpCode('a0b1c8d9e2')).toBe('ABCDE-2')
  })

  it('truncates to ten characters', () => {
    expect(formatOtpCode('ABCDE-23456-ZZZZZ')).toBe('ABCDE-23456')
  })

  it('produces values accepted by the pattern once complete', () => {
    expect(OTP_CODE_REGEX.test(formatOtpCode('abcde23456'))).toBe(true)
    expect(OTP_CODE_REGEX.test(formatOtpCode('abcde2345'))).toBe(false)
  })
})

describe(normalizeIdentifier, () => {
  const domains = ['.bsky.social']

  it.each([
    ['alice', 'alice.bsky.social'],
    ['@alice', 'alice.bsky.social'],
    ['@alice.bsky.social', 'alice.bsky.social'],
    ['Alice.Bsky.Social', 'alice.bsky.social'],
    [' alice ', 'alice.bsky.social'],
    ['alice.example.com', 'alice.example.com'],
    ['Alice@Example.com', 'alice@example.com'],
    ['  did:plc:abc123', 'did:plc:abc123'],
  ])('normalises %j to %j', (input, expected) => {
    expect(normalizeIdentifier(input, domains)).toBe(expected)
  })

  it('leaves a bare name alone when no domain is available', () => {
    expect(normalizeIdentifier('alice', [])).toBe('alice')
  })

  it.each([
    '@alice.bsky.social',
    '@alice.example.com',
    'alice.bsky.social',
    'alice@example.com',
    'did:plc:ewvi7nxzyoun6zhxrhs64oiz', // did:plc:[a-z2-7]{24}
  ])('pattern accepts what a password manager may fill: %j', (value) => {
    expect(isIdentifier(value)).toBe(true)
  })

  it.each(['a@@b', 'alice..bsky.social', '.alice', 'alice', '@alice'])(
    'pattern rejects %j',
    (value) => {
      expect(isIdentifier(value)).toBe(false)
    },
  )
})
