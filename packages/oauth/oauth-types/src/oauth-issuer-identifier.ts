import { z } from 'zod'
import { safeUrl } from './util.js'

export const oauthIssuerIdentifierSchema = z
  .string()
  .superRefine((value, ctx): value is `${'http' | 'https'}://${string}` => {
    // Validate the issuer (MIX-UP attacks)

    if (value.endsWith('/')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not end with a slash',
      })
      return false
    }

    const url = safeUrl(value)
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid url',
      })
      return false
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid issuer URL protocol "${url.protocol}"`,
      })
      return false
    }

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
  })

export type OAuthIssuerIdentifier = z.infer<typeof oauthIssuerIdentifierSchema>
