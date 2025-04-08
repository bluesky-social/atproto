import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { z } from 'zod'

export const emailSchema = z
  .string()
  .email()
  // @NOTE Internally, `zod` uses a regexp for validating emails.. This
  // validation strategy *could* be less permissive in some (edge) cases than
  // `@hapi/address` as the latter uses an algorithm based on the spec. Truth
  // is, it is kinda hard to know if the set of emails allowed by
  // `@hapi/address` is covered by the set of emails allowed by `zod`.
  // Additionally, this could change with future changes in either libraries.
  //
  // Because of this uncertainty, and because other part of the Bluesky/ATProto
  // codebases rely solely on `zod`, this code only allows emails that are valid
  // according to both libraries ensuring that we never encounter a case where
  // an email allowed here is in a format that would be rejected by other parts
  // of our systems.
  .refine(isEmailValid, {
    message: 'Invalid email address',
  })
  .refine((email) => !isDisposableEmail(email), {
    message: 'Disposable email addresses are not allowed',
  })
  .transform((value) => value.toLowerCase())
