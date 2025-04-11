import { z } from 'zod'
import { RgbColor, parseColor } from '../lib/util/color.js'

export const COLOR_NAMES = ['primary', 'error', 'warning', 'success'] as const

export const rgbColorSchema = z.string().transform((value, ctx): RgbColor => {
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
    return z.NEVER
  }
})

export const colorsSchema = z.record(
  z.enum(COLOR_NAMES),
  rgbColorSchema.optional(),
)

export type Colors = z.infer<typeof colorsSchema>
