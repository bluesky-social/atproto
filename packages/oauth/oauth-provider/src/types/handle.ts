import { z } from 'zod'
import {
  HandleString,
  ensureValidHandle,
  normalizeHandle,
} from '@atproto/syntax'

/**
 * @note Only validates again AT Protocol's syntax. Additional rules (specific
 * domains, slurs, etc.) may be imposed through the store implementation.
 */
export const handleSchema = z.string().transform((value, ctx): HandleString => {
  try {
    ensureValidHandle(value)
    return normalizeHandle(value)
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid handle',
    })
    return z.NEVER
  }
})
