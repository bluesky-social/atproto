import { z } from 'zod'
import { colorHueSchema } from '../types/color-hue.js'
import { rgbColorSchema } from '../types/rgb-color.js'

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
      COLOR_NAMES.map((name) => [`${name}Hue`, colorHueSchema.optional()]),
    ) as Record<`${ColorName}Hue`, z.ZodOptional<typeof colorHueSchema>>,
  )

export type Colors = z.infer<typeof colorsSchema>
