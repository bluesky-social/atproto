import { z } from 'zod'
import { localeSchema } from '../lib/util/locale.js'
import { emailOtpSchema } from '../types/email-otp.js'
import { newPasswordSchema, oldPasswordSchema } from '../types/password.js'

export const signInDataSchema = z
  .object({
    locale: localeSchema,
    username: z.string(),
    password: z.union([oldPasswordSchema, newPasswordSchema]),
    emailOtp: emailOtpSchema.optional(),
    /**
     * If false, the account must not be returned from
     * {@link AccountStore.listDeviceAccounts}. Note that this only makes sense when
     * used with a device ID.
     */
    remember: z.boolean().optional().default(false),
  })
  .strict()

export type SignInData = z.output<typeof signInDataSchema>
