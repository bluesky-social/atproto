import { z } from 'zod'

// try/catch to support running in a browser, including when process.env is
// shimmed (e.g. by webpack)
const ALLOW_INSECURE = (() => {
  try {
    const env = process.env.NODE_ENV
    return env === 'development' || env === 'test'
  } catch {
    return false
  }
})()

export const oauthIssuerIdentifierSchema = z
  .string()
  .url()
  .superRefine((value, ctx) => {
    // Validate the issuer (MIX-UP attacks)

    if (value.endsWith('/')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Issuer URL must not end with a slash',
      })
    }

    const url = new URL(value)

    if (url.protocol !== 'https:') {
      if (ALLOW_INSECURE && url.protocol === 'http:') {
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
