import { describe, expect, it } from 'vitest'
import {
  OTP_CODE_PATTERN,
  resetPasswordConfirmSchema,
  resetPasswordRequestSchema,
} from './form-schemas.ts'
import { MIN_PASSWORD_LENGTH } from './password.ts'

describe('resetPasswordRequestSchema', () => {
  it('accepts a well-formed email address', () => {
    const result = resetPasswordRequestSchema.safeParse({
      email: 'alice@test.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty email', () => {
    expect(resetPasswordRequestSchema.safeParse({ email: '' }).success).toBe(
      false,
    )
  })

  it('rejects a string that is not an email address', () => {
    expect(
      resetPasswordRequestSchema.safeParse({ email: 'alice.test' }).success,
    ).toBe(false)
  })

  it('rejects a missing email', () => {
    expect(resetPasswordRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('OTP_CODE_PATTERN', () => {
  it.each(['ABCDE-23456', 'AAAAA-BBBBB', '22222-77777'])(
    'accepts %s',
    (code) => {
      expect(OTP_CODE_PATTERN.test(code)).toBe(true)
    },
  )

  it.each([
    'ABCDE23456', // missing separator
    'ABCD-23456', // too short
    'ABCDEF-23456', // too long
    'ABCDE-2345', // too short after separator
    'abcde-23456', // lowercase
    'ABCD1-23456', // 1 is not in the base32 alphabet
    'ABCD8-23456', // 8 is not in the base32 alphabet
    '',
  ])('rejects %s', (code) => {
    expect(OTP_CODE_PATTERN.test(code)).toBe(false)
  })
})

describe('resetPasswordConfirmSchema', () => {
  const validCode = 'ABCDE-23456'
  const validPassword = 'a'.repeat(MIN_PASSWORD_LENGTH)

  it('accepts a valid code and password', () => {
    const result = resetPasswordConfirmSchema.safeParse({
      code: validCode,
      password: validPassword,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed code', () => {
    expect(
      resetPasswordConfirmSchema.safeParse({
        code: 'nope',
        password: validPassword,
      }).success,
    ).toBe(false)
  })

  it(`rejects a password shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(
      resetPasswordConfirmSchema.safeParse({
        code: validCode,
        password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
      }).success,
    ).toBe(false)
  })

  it(`accepts a password of exactly ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(
      resetPasswordConfirmSchema.safeParse({
        code: validCode,
        password: 'a'.repeat(MIN_PASSWORD_LENGTH),
      }).success,
    ).toBe(true)
  })
})
