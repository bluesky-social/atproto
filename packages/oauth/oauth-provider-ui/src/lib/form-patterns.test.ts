import { describe, expect, it } from 'vitest'
import {
  OTP_CODE_PATTERN,
  SIGN_IN_IDENTIFIER_PATTERN,
  formatOtpCode,
  normalizeSignInIdentifier,
} from './form-patterns.ts'

describe(formatOtpCode, () => {
  const matchesPattern = (value: string) =>
    new RegExp(`^(?:${OTP_CODE_PATTERN})$`).test(value)

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
    expect(matchesPattern(formatOtpCode('abcde23456'))).toBe(true)
    expect(matchesPattern(formatOtpCode('abcde2345'))).toBe(false)
  })
})

describe(normalizeSignInIdentifier, () => {
  const domains = ['.bsky.social']
  // Browsers compile `pattern` with the `v` flag and anchor it.
  const matchesPattern = (value: string) =>
    new RegExp(`^(?:${SIGN_IN_IDENTIFIER_PATTERN})$`, 'v').test(value)

  it.each([
    ['alice', 'alice.bsky.social'],
    ['@alice', 'alice.bsky.social'],
    ['@alice.bsky.social', 'alice.bsky.social'],
    ['Alice.Bsky.Social', 'alice.bsky.social'],
    [' alice ', 'alice.bsky.social'],
    ['alice.example.com', 'alice.example.com'],
    ['Alice@Example.com', 'alice@example.com'],
    ['did:plc:abc123', 'did:plc:abc123'],
  ])('normalises %j to %j', (input, expected) => {
    expect(normalizeSignInIdentifier(input, domains)).toBe(expected)
  })

  it('leaves a bare name alone when no domain is available', () => {
    expect(normalizeSignInIdentifier('alice', [])).toBe('alice')
  })

  it.each([
    'alice',
    '@alice',
    '@alice.bsky.social',
    'Alice.Bsky.Social',
    'alice@example.com',
    'did:plc:abc123',
  ])('pattern accepts what a password manager may fill: %j', (value) => {
    expect(matchesPattern(value)).toBe(true)
  })

  it.each(['a@@b', 'alice..bsky.social', '.alice'])(
    'pattern still rejects %j',
    (value) => {
      expect(matchesPattern(value)).toBe(false)
    },
  )
})
