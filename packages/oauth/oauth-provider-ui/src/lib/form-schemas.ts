import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from './password.ts'

/**
 * The OTP shape the provider issues: two groups of five RFC-4648 base32
 * characters (A–Z and 2–7, so no 0/1/8/9) separated by a hyphen.
 *
 * @NOTE Kept identical to the `pattern` attribute the token input has always
 * carried, so client-side validation does not become stricter or looser than
 * what the server accepts.
 */
export const OTP_CODE_PATTERN = /^[A-Z2-7]{5}-[A-Z2-7]{5}$/

export const otpCodeSchema = z.string().regex(OTP_CODE_PATTERN)

export const newPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH)

export const resetPasswordRequestSchema = z.object({
  email: z.string().min(1).email(),
})

export type ResetPasswordRequestValues = z.infer<
  typeof resetPasswordRequestSchema
>

export const resetPasswordConfirmSchema = z.object({
  // @NOTE The field key is `code`, not `token`, because react-hook-form derives
  // the rendered `name` attribute from it and the pds e2e suite selects
  // `input[name="code"]`. The view maps it to the API's `token` field.
  code: otpCodeSchema,
  password: newPasswordSchema,
})

export type ResetPasswordConfirmValues = z.infer<
  typeof resetPasswordConfirmSchema
>
