import { z } from 'zod'
import { RgbColor, parseColor } from '../lib/util/color.js'

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

export const hueSchema = z.number().min(0).max(360)

export const COLOR_NAMES = ['primary', 'error', 'warning', 'success'] as const
export type ColorName = (typeof COLOR_NAMES)[number]

export type ContrastColorName = `${ColorName}Contrast`
export const contrastColorName = <T extends ColorName>(name: T) =>
  `${name}Contrast` as const satisfies ContrastColorName

export type HueColorName = `${ColorName}Hue`
export const hueColorName = <T extends ColorName>(name: T) =>
  `${name}Hue` as const satisfies HueColorName

export const colorsSchema = z
  .object(
    Object.fromEntries(
      [...COLOR_NAMES, 'light', 'dark'].map(
        (name) => [name, rgbColorSchema.optional()] as const,
      ),
    ) as Record<
      'light' | 'dark' | ColorName,
      z.ZodOptional<typeof rgbColorSchema>
    >,
  )
  .extend(
    Object.fromEntries(
      COLOR_NAMES.map(
        (name) => [contrastColorName(name), rgbColorSchema.optional()] as const,
      ),
    ) as Record<ContrastColorName, z.ZodOptional<typeof rgbColorSchema>>,
  )
  .extend(
    Object.fromEntries(
      COLOR_NAMES.map(
        (name) => [hueColorName(name), hueSchema.optional()] as const,
      ),
    ) as Record<HueColorName, z.ZodOptional<typeof hueSchema>>,
  )

export type Colors = z.infer<typeof colorsSchema>
