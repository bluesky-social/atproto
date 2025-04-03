import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { z } from 'zod'

export const emailSchema = z
  .string()
  .email()
  // @NOTE using @hapi/address here, in addition to the email() check to ensure
  // compatibility with the current email validation in the PDS's account
  // manager
  .refine(isEmailValid, {
    message: 'Invalid email address',
  })
  .refine((email) => !isDisposableEmail(email), {
    message: 'Disposable email addresses are not allowed',
  })
  .transform((value) => value.toLowerCase())
