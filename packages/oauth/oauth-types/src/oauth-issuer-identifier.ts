import { z } from 'zod'
import { ALLOW_UNSECURE_ORIGINS } from './constants.js'
import { safeUrl } from './util.js'

export const oauthIssuerIdentifierSchema = z
  .string()
  .superRefine((value, ctx) => {
    // Validate the issuer (MIX-UP attacks)

    if (value.endsWith('/')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not end with a slash',
      })
    }

    const url = safeUrl(value)
    if (!url) {
      return ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid url',
      })
    }

    if (url.protocol !== 'https:') {
      if (ALLOW_UNSECURE_ORIGINS && url.protocol === 'http:') {
        // We'll allow HTTP in development mode
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Issuer must be an HTTPS URL',
        })
      }
    }

    if (url.username || url.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not contain a username or password',
      })
    }

    if (url.hash || url.search) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not contain a query or fragment',
      })
    }

    const canonicalValue = url.pathname === '/' ? url.origin : url.href
    if (value !== canonicalValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must be in the canonical form',
      })
    }
  })
