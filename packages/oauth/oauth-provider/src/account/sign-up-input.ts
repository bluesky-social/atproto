import { z } from 'zod'
import { hcaptchaTokenSchema } from '../lib/hcaptcha.js'
import { createAccountDataSchema } from './account-store.js'

export const signUpInputSchema = createAccountDataSchema
  .extend({
    hcaptchaToken: hcaptchaTokenSchema.optional(),
  })
  .strict()

export type SignUpInput = z.TypeOf<typeof signUpInputSchema>
