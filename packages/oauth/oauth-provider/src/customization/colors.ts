import { z } from 'zod'
import { COLOR_NAMES } from '@atproto/oauth-provider-ui'
import { RgbColor, parseColor } from '../lib/util/color.js'

export const colorsSchema = z.record(
  z.enum(COLOR_NAMES),
  z
    .string()
    .transform((value, ctx): RgbColor => {
      try {
        const parsed = parseColor(value)
        if ('a' in parsed && parsed.a !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Alpha values are not supported',
          })
        }
        return parsed
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof Error ? e.message : 'Invalid color value',
        })
        // Won't actually be used (since an issue was added):
        return { r: 0, g: 0, b: 0 }
      }
    })
    .optional(),
)

export type Colors = z.infer<typeof colorsSchema>
