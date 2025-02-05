import { z } from 'zod'
import { webUriSchema } from './uri.js'

export const oauthIssuerIdentifierSchema = webUriSchema.superRefine(
  (value, ctx) => {
    // Validate the issuer (MIX-UP attacks)

    if (value.endsWith('/')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not end with a slash',
      })
      return false
    }

    const url = new URL(value)

    if (url.username || url.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not contain a username or password',
      })
      return false
    }

    if (url.hash || url.search) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not contain a query or fragment',
      })
      return false
    }

    const canonicalValue = url.pathname === '/' ? url.origin : url.href
    if (value !== canonicalValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must be in the canonical form',
      })
      return false
    }

    return true
  },
)

export type OAuthIssuerIdentifier = z.infer<typeof oauthIssuerIdentifierSchema>
