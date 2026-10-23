import { describe, expect, it } from 'vitest'
import {
  IDENTIFIER_REGEX,
  OTP_CODE_REGEX,
  formatOtpCode,
  normalizeIdentifier,
} from './form-patterns.ts'

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
    expect(IDENTIFIER_REGEX.test(value)).toBe(true)
  })

  it.each(['a@@b', 'alice..bsky.social', '.alice', 'alice', '@alice'])(
    'pattern rejects %j',
    (value) => {
      expect(IDENTIFIER_REGEX.test(value)).toBe(false)
    },
  )
})
