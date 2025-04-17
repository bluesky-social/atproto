import { z } from 'zod'
import { RgbColor, parseColor } from '../lib/util/color.js'

export const hueSchema = z.number().min(0).max(360)
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

export const COLOR_NAMES = ['primary', 'error', 'warning', 'success'] as const
export type ColorName = (typeof COLOR_NAMES)[number]

export const colorsSchema = z
  .object({
    light: rgbColorSchema.optional(),
    dark: rgbColorSchema.optional(),
  })
  .extend(
    Object.fromEntries(
      COLOR_NAMES.map((name) => [name, rgbColorSchema.optional()]),
    ) as Record<ColorName, z.ZodOptional<typeof rgbColorSchema>>,
  )
  .extend(
    Object.fromEntries(
      COLOR_NAMES.map((name) => [`${name}Contrast`, rgbColorSchema.optional()]),
    ) as Record<`${ColorName}Contrast`, z.ZodOptional<typeof rgbColorSchema>>,
  )
  .extend(
    Object.fromEntries(
      COLOR_NAMES.map((name) => [`${name}Hue`, hueSchema.optional()]),
    ) as Record<`${ColorName}Hue`, z.ZodOptional<typeof hueSchema>>,
  )

export type Colors = z.infer<typeof colorsSchema>
