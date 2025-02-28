import { z } from 'zod'
import { hcaptchaTokenSchema } from '../lib/hcaptcha.js'
import { createAccountDataSchema } from './account-store.js'

export const signUpDataSchema = createAccountDataSchema
  .extend({
    hcaptchaToken: hcaptchaTokenSchema.optional(),
  })
  .strict()

export type SignUpData = z.TypeOf<typeof signUpDataSchema>
