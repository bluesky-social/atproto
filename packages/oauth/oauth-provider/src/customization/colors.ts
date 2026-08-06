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
    // lightness.
    contrastSaturation: z.number().min(0).max(100).optional(),

    // Only the primary colour gets a contrast pair (for --primary-foreground),
    // so it is the only colour that accepts an explicit contrast override or a
    // hue for deriving one.
    primaryContrast: rgbColorSchema.optional(),
    primaryHue: colorHueSchema.optional(),
  })
  .extend(
    Object.fromEntries(
      COLOR_NAMES.map((name) => [name, rgbColorSchema.optional()]),
    ) as Record<ColorName, z.ZodOptional<typeof rgbColorSchema>>,
  )

export type Colors = z.infer<typeof colorsSchema>
