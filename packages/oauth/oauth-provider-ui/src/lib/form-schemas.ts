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

/**
 * Email, handle (with at least one dot), or DID.
 *
 * @NOTE Identical to the `pattern` attribute the sign-in input has always
 * carried — kept as a regex here so react-hook-form reports it the same way it
 * reports every other field error.
 */
export const SIGN_IN_IDENTIFIER_PATTERN =
  /^([^@]+@[^@]+|[^.@]+(\.[^.@]+)+)|did:[a-z0-9]+:.+$/

export const signInSchema = z.object({
  // @NOTE `username` (not `identifier`) — the pds e2e suite selects
  // `input[name="username"]`, and with react-hook-form the field key is the
  // rendered name.
  username: z.string().min(1).regex(SIGN_IN_IDENTIFIER_PATTERN),
  password: z.string().min(1),
  remember: z.boolean().optional(),
  // Only required once the server has demanded a second factor; that condition
  // lives in component state, so it gates the submit button rather than the
  // schema.
  otp: otpCodeSchema.or(z.literal('')).optional(),
})

export type SignInValues = z.infer<typeof signInSchema>

export const emailOnlySchema = z.object({
  email: z.string().min(1).email(),
})

export type EmailOnlyValues = z.infer<typeof emailOnlySchema>

export const verifyEmailConfirmSchema = z.object({
  code: otpCodeSchema,
})

export type VerifyEmailConfirmValues = z.infer<typeof verifyEmailConfirmSchema>

export const updateEmailSchema = z.object({
  // @NOTE `newEmail`, not `email` — the dialog's request step owns
  // `input[name="email"]`, and this confirm step must not collide with it.
  newEmail: z.string().min(1).email(),
  code: otpCodeSchema,
})

export type UpdateEmailValues = z.infer<typeof updateEmailSchema>

export const updateHandleSchema = z.object({
  handle: z.string().min(1),
})

export type UpdateHandleValues = z.infer<typeof updateHandleSchema>

export const updateHandleCustomSchema = z.object({
  // @NOTE Field key is `domain` — the pds e2e suite types into
  // input[name="domain"] — even though the value is a full handle.
  domain: z.string().min(1),
})

export type UpdateHandleCustomValues = z.infer<typeof updateHandleCustomSchema>

export const signUpHandleSchema = z.object({
  // Composed by HandleField out of a segment plus a domain; it only publishes
  // a value once the whole handle is valid, so a non-empty string is enough.
  handle: z.string().min(1),
})

export type SignUpHandleValues = z.infer<typeof signUpHandleSchema>

/**
 * @NOTE Built per-render because whether an invite code is required is
 * deployment configuration (`inviteCodeRequired` from CustomizationData), not
 * a static property of the form.
 */
export function buildSignUpCredentialsSchema(inviteCodeRequired: boolean) {
  return z.object({
    email: z.string().min(1).email(),
    password: newPasswordSchema,
    inviteCode: inviteCodeRequired ? z.string().min(1) : z.string().optional(),
  })
}

export type SignUpCredentialsValues = z.infer<
  ReturnType<typeof buildSignUpCredentialsSchema>
>
