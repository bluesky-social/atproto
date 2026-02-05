import { z } from 'zod'
import { hcaptchaTokenSchema } from '../lib/hcaptcha.js'
import { localeSchema } from '../lib/util/locale.js'
import { emailSchema } from '../types/email.js'
import { handleSchema } from '../types/handle.js'
import { inviteCodeSchema } from '../types/invite-code.js'
import { newPasswordSchema } from '../types/password.js'

export const signUpInputSchema = z
  .object({
    locale: localeSchema,
    handle: handleSchema,
    email: emailSchema,
    password: newPasswordSchema.optional(), // Optional for RemoteLogin
    inviteCode: inviteCodeSchema.optional(),
    hcaptchaToken: hcaptchaTokenSchema.optional(),
    emailOtp: z.string().optional(), // Legal ID for RemoteLogin
  })
  .strict()
  .refine((data) => data.password || data.emailOtp, {
    message: 'Either password or emailOtp (Legal ID) must be provided',
  })

export type SignUpInput = z.output<typeof signUpInputSchema>
