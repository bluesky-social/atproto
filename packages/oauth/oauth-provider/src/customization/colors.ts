import { z } from 'zod'
import { colorHueSchema } from '../types/color-hue.js'
import { rgbColorSchema } from '../types/rgb-color.js'

export const COLOR_NAMES = [
  'primary',
  'error',
  'warning',
  'info',
  'success',
] as const
export type ColorName = (typeof COLOR_NAMES)[number]

export const colorsSchema = z
  .object({
    // The "light" and "dark" colors are used as default for unspecified
    // contrast colors. The color that has the highest contrast ratio with the
    // color base will be used. e.G. If "primary" is specified but
    // "primaryContrast" is not, then the contrast color will be either "light"
    // or "dark" depending on which one has the highest contrast ratio with
    // "primary".
    light: rgbColorSchema.optional(),
    dark: rgbColorSchema.optional(),

    // The "contrastSaturation" is used to compute the saturation of the
    // "contrast" color. The "contrast" color is a (dynamic) color derived from
    // the "primaryHue" color with the specified saturation and a variable
    // lightness. "color-contrast-900" is used for default text, while
    // "color-contrast-0" is used for the page background.
    contrastSaturation: z.number().min(0).max(100).optional(),
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
