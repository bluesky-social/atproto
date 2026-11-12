import { z } from 'zod'
import { localeSchema } from '../lib/util/locale.js'
import { emailOtpSchema } from '../types/email-otp.js'
import { identifierSchema } from '../types/indentifier.js'
import { newPasswordSchema, oldPasswordSchema } from '../types/password.js'

export const signInDataSchema = z
  .object({
    locale: localeSchema,
    identifier: identifierSchema,
    password: z.union([oldPasswordSchema, newPasswordSchema]),
    emailOtp: emailOtpSchema.optional(),
    remember: z.boolean().optional(),
  })
  .strict()

export type SignInData = z.output<typeof signInDataSchema>
