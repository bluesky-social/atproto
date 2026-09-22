import { describe, expect, it } from 'vitest'
import { OTP_CODE_PATTERN, formatOtpCode } from './form-patterns.ts'

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
